// Workflow graphiste (GD) : À faire → En cours → En validation technique → En validation client → Validée
// Chaque refus (technique ou client) renvoie la tâche dans la partie Modification du GD.
const router = require('express').Router();
const { q, one } = require('../db');
const { allow } = require('../auth');
const { notify, notifyRole, ymd, remainingWorkdays, isWorkday, wrap, HttpError } = require('../util');

const OPEN = ['a_faire', 'en_cours', 'modification_demandee'];
const PROD_ROLES = ['graphiste', 'photographe', 'developpeur', 'community_manager', 'media_buyer'];

async function log(taskId, userId, action, status, note = null) {
  await q('INSERT INTO task_history (task_id, user_id, action, status, note) VALUES (?,?,?,?,?)', [taskId, userId, action, status, note]);
}

async function getTask(id) {
  const t = await one(
    `SELECT t.*, p.name AS client_name, p.client_user_id FROM tasks t JOIN prospects p ON p.id=t.prospect_id WHERE t.id=?`, [id]);
  if (!t) throw new HttpError(404, 'Tâche introuvable');
  return t;
}

// ───────── Génération des tâches du jour à partir du quota mensuel ─────────
let lastGeneration = null;
async function generateDailyTasks(date = new Date()) {
  if (!isWorkday(date)) return 0;
  const day = ymd(date);
  const monthStart = day.slice(0, 8) + '01';
  const clients = await q(
    `SELECT p.id, p.name, p.priority, o.posts_month, o.stories_month, ca.user_id AS gd_id,
       (SELECT d.id FROM dossiers d WHERE d.prospect_id=p.id AND d.status NOT IN ('signe') ORDER BY d.id DESC LIMIT 1) AS dossier_id
     FROM prospects p JOIN offers o ON o.id=p.offer_id
     JOIN client_assignments ca ON ca.prospect_id=p.id AND ca.role='graphiste'
     WHERE p.label='client'`);
  const daysLeft = remainingWorkdays(date);
  let created = 0;
  for (const c of clients) {
    if (!c.dossier_id) continue; // pas de production sans paiement confirmé
    for (const [type, quota] of [['conception', c.posts_month], ['story', c.stories_month]]) {
      if (!quota) continue;
      const already = await one(
        `SELECT COUNT(*) n, SUM(due_date=?) today FROM tasks WHERE prospect_id=? AND type=? AND part='creation'
         AND reassigned_from IS NULL AND due_date BETWEEN ? AND LAST_DAY(?)`, [day, c.id, type, monthStart, monthStart]);
      if (Number(already.today) > 0) continue; // déjà généré aujourd'hui
      const remaining = quota - already.n;
      if (remaining <= 0) continue;
      const n = Math.ceil(remaining / Math.max(daysLeft, 1));
      for (let i = 0; i < n; i++) {
        const r = await q(
          `INSERT INTO tasks (prospect_id, dossier_id, assigned_to, type, part, theme, priority, due_date, status)
           VALUES (?,?,?,?, 'creation', ?, ?, ?, 'a_faire')`,
          [c.id, c.dossier_id, c.gd_id, type, `${type === 'story' ? 'Story' : 'Conception'} ${already.n + i + 1}/${quota} — ${c.name}`, c.priority, day]);
        await log(r.insertId, null, 'generation', 'a_faire');
        created++;
      }
    }
  }
  await checkLateAlerts();
  return created;
}

async function ensureGenerated() {
  const today = ymd();
  if (lastGeneration === today) return;
  lastGeneration = today;
  await generateDailyTasks();
}

// Retard cumulé ≥ 3 jours de travail (en volume) → notification au responsable technique
async function checkLateAlerts() {
  const rows = await q(
    `SELECT u.id, u.name, u.daily_capacity, COUNT(t.id) late FROM users u
     JOIN tasks t ON t.assigned_to=u.id AND t.status IN (?) AND t.due_date < CURDATE()
     WHERE u.role='graphiste' GROUP BY u.id HAVING late >= u.daily_capacity * 3`, [OPEN]);
  for (const r of rows) {
    const msg = `Retard cumulé ≥ 3 jours pour ${r.name} (${r.late} tâches)`;
    const exists = await one('SELECT id FROM notifications WHERE message=? AND DATE(created_at)=CURDATE()', [msg]);
    if (!exists) await notifyRole('responsable_technique', msg, '/dashboard/equipe-gd');
  }
}

// ───────── Liste des tâches ─────────
router.get('/', wrap(async (req, res) => {
  await ensureGenerated();
  const u = req.user;
  const { part, client_id, status, type, scope } = req.query;
  const where = ['1=1'];
  const params = [];
  if (u.role === 'community_manager') {
    where.push("t.status IN ('validee','publiee') AND EXISTS (SELECT 1 FROM client_assignments ca WHERE ca.prospect_id=t.prospect_id AND ca.user_id=?)"); params.push(u.id);
  } else if (PROD_ROLES.includes(u.role)) {
    where.push('t.assigned_to=?'); params.push(u.id);
    if (scope !== 'all') { where.push('(t.due_date<=CURDATE() AND t.status IN (?))'); params.push(OPEN); }
  } else if (u.role === 'charge_clientele') {
    where.push("t.status IN ('validation_client','validee') AND EXISTS (SELECT 1 FROM client_assignments ca WHERE ca.prospect_id=t.prospect_id AND ca.user_id=?)"); params.push(u.id);
  } else if (u.role === 'client') {
    where.push("p.client_user_id=? AND t.status IN ('validation_client','validee','publiee')"); params.push(u.id);
  }
  if (req.query.assigned_to) { where.push('t.assigned_to=?'); params.push(req.query.assigned_to); }
  if (part) { where.push('t.part=?'); params.push(part); }
  if (client_id) { where.push('t.prospect_id=?'); params.push(client_id); }
  if (status) { where.push('t.status=?'); params.push(status); }
  if (type) { where.push('t.type=?'); params.push(type); }
  // Classement par défaut : modifications en retard, clients en retard sur quota, priorité client, deadline
  const rows = await q(
    `SELECT t.*, p.name AS client_name, u.name AS assigned_name, (t.due_date < CURDATE() AND t.status IN (?)) AS late,
       (SELECT file_url FROM task_versions v WHERE v.task_id=t.id ORDER BY version DESC LIMIT 1) AS last_file,
       (SELECT MAX(version) FROM task_versions v WHERE v.task_id=t.id) AS version
     FROM tasks t JOIN prospects p ON p.id=t.prospect_id JOIN users u ON u.id=t.assigned_to
     WHERE ${where.join(' AND ')}
     ORDER BY (t.part='modification' AND t.due_date<CURDATE()) DESC, (t.due_date<CURDATE()) DESC, t.priority ASC, t.due_date ASC, t.id
     LIMIT 500`, [OPEN, ...params]);
  res.json(rows);
}));

router.get('/:id(\\d+)', wrap(async (req, res) => {
  const t = await getTask(req.params.id);
  const versions = await q('SELECT v.*, u.name AS author FROM task_versions v LEFT JOIN users u ON u.id=v.created_by WHERE task_id=? ORDER BY version DESC', [t.id]);
  const history = await q('SELECT h.*, u.name AS user_name FROM task_history h LEFT JOIN users u ON u.id=h.user_id WHERE task_id=? ORDER BY h.created_at DESC', [t.id]);
  const client = await one('SELECT p.name, p.specialty, p.documents_url, o.name AS offer FROM prospects p LEFT JOIN offers o ON o.id=p.offer_id WHERE p.id=?', [t.prospect_id]);
  res.json({ ...t, versions, history, client });
}));

// Créer une tâche manuellement (resp. technique / resp. communication)
router.post('/', allow('responsable_technique', 'responsable_communication'), wrap(async (req, res) => {
  const { prospect_id, assigned_to, type = 'conception', theme, brief, priority = 2, due_date } = req.body;
  if (!prospect_id || !assigned_to) throw new HttpError(400, 'Client et intervenant obligatoires');
  const r = await q('INSERT INTO tasks (prospect_id, assigned_to, type, theme, brief, priority, due_date) VALUES (?,?,?,?,?,?,?)',
    [prospect_id, assigned_to, type, theme, brief, priority, due_date || ymd()]);
  await log(r.insertId, req.user.id, 'creation_manuelle', 'a_faire');
  await notify(assigned_to, `Nouvelle tâche : ${theme || type}`, '/dashboard/taches');
  res.json({ id: r.insertId });
}));

router.patch('/:id/brief', allow('responsable_technique', 'responsable_communication', 'charge_clientele'), wrap(async (req, res) => {
  await q('UPDATE tasks SET theme=COALESCE(?, theme), brief=COALESCE(?, brief), priority=COALESCE(?, priority) WHERE id=?',
    [req.body.theme ?? null, req.body.brief ?? null, req.body.priority ?? null, req.params.id]);
  res.json({ ok: true });
}));

// GD ouvre la tâche → En cours
router.post('/:id/open', wrap(async (req, res) => {
  const t = await getTask(req.params.id);
  if (t.assigned_to !== req.user.id) throw new HttpError(403, 'Tâche non attribuée');
  if (t.status === 'a_faire') {
    await q("UPDATE tasks SET status='en_cours' WHERE id=?", [t.id]);
    await log(t.id, req.user.id, 'ouverture', 'en_cours');
  }
  res.json({ ok: true });
}));

// GD « Ajouter » (création) ou « Modification terminée » → En validation technique
router.post('/:id/submit', wrap(async (req, res) => {
  const t = await getTask(req.params.id);
  if (t.assigned_to !== req.user.id) throw new HttpError(403, 'Tâche non attribuée');
  if (!OPEN.includes(t.status)) throw new HttpError(400, 'Tâche déjà soumise');
  const { file_url, comment } = req.body;
  if (!file_url) throw new HttpError(400, 'Lien de la conception obligatoire');
  const v = await one('SELECT COALESCE(MAX(version),0)+1 AS n FROM task_versions WHERE task_id=?', [t.id]);
  await q('INSERT INTO task_versions (task_id, version, file_url, comment, created_by) VALUES (?,?,?,?,?)', [t.id, v.n, file_url, comment || null, req.user.id]);
  await q("UPDATE tasks SET status='validation_technique', completed_at=NOW() WHERE id=?", [t.id]);
  // Ligne de reporting automatique : création ou modification
  await log(t.id, req.user.id, t.part === 'modification' ? 'modification' : 'creation', 'validation_technique', comment);
  await notifyRole('responsable_technique', `Nouvelle conception à valider : ${t.client_name} (V${v.n})`, '/dashboard/validation');
  res.json({ ok: true, version: v.n });
}));

async function sendToModification(t, userId, note, by) {
  if (!note) throw new HttpError(400, 'Note obligatoire');
  await q("UPDATE tasks SET status='modification_demandee', part='modification', modif_count=modif_count+1, last_note=?, due_date=CURDATE(), completed_at=NULL WHERE id=?", [note, t.id]);
  await log(t.id, userId, `refus_${by}`, 'modification_demandee', note);
  await notify(t.assigned_to, `Modification à faire (${t.client_name}) : ${note}`, '/dashboard/taches');
}

// Responsable technique : validation interne
router.post('/:id/tech-review', allow('responsable_technique'), wrap(async (req, res) => {
  const t = await getTask(req.params.id);
  if (t.status !== 'validation_technique') throw new HttpError(400, 'Pas en validation technique');
  if (t.assigned_to === req.user.id) throw new HttpError(403, 'On ne valide jamais sa propre conception');
  if (req.body.decision === 'valider') {
    await q("UPDATE tasks SET status='validation_client' WHERE id=?", [t.id]);
    await log(t.id, req.user.id, 'validation_technique', 'validation_client', req.body.note);
    const ccs = await q("SELECT user_id FROM client_assignments WHERE prospect_id=? AND role='charge_clientele'", [t.prospect_id]);
    await notify([...ccs.map((c) => c.user_id), t.client_user_id], `Conception prête pour validation : ${t.client_name}`, '/dashboard/validation');
  } else {
    await sendToModification(t, req.user.id, req.body.note, 'technique');
  }
  res.json({ ok: true });
}));

// CC ou client : validation finale
router.post('/:id/client-review', allow('charge_clientele', 'client'), wrap(async (req, res) => {
  const t = await getTask(req.params.id);
  if (t.status !== 'validation_client') throw new HttpError(400, 'Pas en validation client');
  if (req.user.role === 'client' && t.client_user_id !== req.user.id) throw new HttpError(403, 'Accès refusé');
  if (req.body.decision === 'valider') {
    await q("UPDATE tasks SET status='validee' WHERE id=?", [t.id]);
    await log(t.id, req.user.id, 'validation_client', 'validee', req.body.note);
    await notify(t.assigned_to, `Bravo, conception validée ! (${t.client_name})`, '/dashboard/taches');
    const cms = await q("SELECT user_id FROM client_assignments WHERE prospect_id=? AND role='community_manager'", [t.prospect_id]);
    await notify(cms.map((c) => c.user_id), `Contenu validé à programmer : ${t.client_name}`, '/dashboard/validation');
  } else {
    await sendToModification(t, req.user.id, req.body.note, req.user.role === 'client' ? 'client' : 'cc');
  }
  res.json({ ok: true });
}));

// CM : publication d'un contenu validé
router.post('/:id/publish', allow('community_manager'), wrap(async (req, res) => {
  const t = await getTask(req.params.id);
  if (t.status !== 'validee') throw new HttpError(400, 'Contenu non validé');
  await q("UPDATE tasks SET status='publiee' WHERE id=?", [t.id]);
  await log(t.id, req.user.id, 'publication', 'publiee');
  res.json({ ok: true });
}));

// Responsable technique : réattribution forcée en cas critique de retard
router.post('/:id/reassign', allow('responsable_technique'), wrap(async (req, res) => {
  const t = await getTask(req.params.id);
  const { user_id } = req.body;
  if (!user_id || Number(user_id) === t.assigned_to) throw new HttpError(400, 'Choisir un autre graphiste');
  await q('UPDATE tasks SET assigned_to=?, reassigned_from=? WHERE id=?', [user_id, t.assigned_to, t.id]);
  await log(t.id, req.user.id, 'reattribution', t.status, `De ${t.assigned_to} vers ${user_id}`);
  await notify(user_id, `Tâche réattribuée : ${t.theme || t.client_name}`, '/dashboard/taches');
  res.json({ ok: true });
}));

router.post('/generate', allow('responsable_technique'), wrap(async (req, res) => {
  const n = await generateDailyTasks();
  res.json({ created: n });
}));

// ───────── Reporting & diagnostic GD ─────────
async function gdStats(userId, from, to) {
  const u = await one('SELECT id, name, daily_capacity FROM users WHERE id=?', [userId]);
  const a = await one(
    `SELECT SUM(action='creation') creations, SUM(action='modification') modifications
     FROM task_history WHERE user_id=? AND DATE(created_at) BETWEEN ? AND ?`, [userId, from, to]);
  const today = await one(
    `SELECT COUNT(*) planned,
       SUM(status NOT IN (?)) done,
       SUM(status IN (?) AND due_date<CURDATE()) late
     FROM tasks WHERE assigned_to=? AND (due_date<=CURDATE() AND (status IN (?) OR DATE(completed_at)=CURDATE()))`,
    [OPEN, OPEN, userId, OPEN]);
  const reassigned = await one('SELECT COUNT(*) n FROM tasks WHERE reassigned_from=? AND status IN (?)', [userId, OPEN.concat(['validation_technique'])]);
  const creations = Number(a.creations || 0);
  const modifications = Number(a.modifications || 0);
  const ratio = creations ? modifications / creations : 0;
  const planned = Number(today.planned || 0);
  const done = Number(today.done || 0);
  const occupation = u.daily_capacity ? planned / u.daily_capacity : 0;
  let alert = 'vert';
  if (ratio >= 0.3) alert = 'orange';
  else if (occupation < 0.6) alert = 'rouge';
  let diagnostic = 'Performance normale';
  const reached = planned === 0 || done >= planned;
  if (ratio >= 0.3 && !reached) diagnostic = 'Temps perdu en corrections : qualité des conceptions ou briefs flous';
  else if (occupation < 0.6 && !reached) diagnostic = "Pas assez de tâches reçues : problème d'attribution";
  else if (occupation < 0.6) diagnostic = 'Sous-charge de tâches';
  return {
    user: u, creations, modifications, ratio, occupation, alert, diagnostic,
    today: { planned, done, late: Number(today.late || 0), progress: planned ? done / planned : 1 },
    reassigned_out: reassigned.n,
  };
}

router.get('/stats/me', wrap(async (req, res) => {
  const from = req.query.from || ymd(new Date(Date.now() - 29 * 864e5));
  const to = req.query.to || ymd();
  const stats = await gdStats(req.user.id, from, to);
  const byClient = await q(
    `SELECT p.name, SUM(h.action='creation') creations, SUM(h.action='modification') modifications
     FROM task_history h JOIN tasks t ON t.id=h.task_id JOIN prospects p ON p.id=t.prospect_id
     WHERE h.user_id=? AND DATE(h.created_at) BETWEEN ? AND ? AND h.action IN ('creation','modification') GROUP BY p.id`, [req.user.id, from, to]);
  const daily = await q(
    `SELECT DATE(created_at) day, SUM(action='creation') creations, SUM(action='modification') modifications
     FROM task_history WHERE user_id=? AND DATE(created_at) BETWEEN ? AND ? AND action IN ('creation','modification') GROUP BY day ORDER BY day`, [req.user.id, from, to]);
  res.json({ ...stats, byClient, daily });
}));

router.get('/stats/team', allow('responsable_technique', 'responsable_communication'), wrap(async (req, res) => {
  const from = req.query.from || ymd(new Date(Date.now() - 29 * 864e5));
  const to = req.query.to || ymd();
  const gds = await q("SELECT id FROM users WHERE role='graphiste' AND active=1");
  res.json(await Promise.all(gds.map((g) => gdStats(g.id, from, to))));
}));

// Quotas par client (réalisé / restant dans le mois)
router.get('/quotas', wrap(async (req, res) => {
  const u = req.user;
  const params = [];
  let filter = '';
  if (PROD_ROLES.includes(u.role)) { filter = 'AND EXISTS (SELECT 1 FROM client_assignments ca WHERE ca.prospect_id=p.id AND ca.user_id=?)'; params.push(u.id); }
  res.json(await q(
    `SELECT p.id, p.name, p.priority, o.name AS offer, o.posts_month, o.stories_month, p.documents_url,
       (SELECT COUNT(*) FROM tasks t WHERE t.prospect_id=p.id AND t.type='conception' AND t.status IN ('validee','publiee','validation_client','validation_technique') AND DATE_FORMAT(t.due_date,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m')) AS posts_done,
       (SELECT COUNT(*) FROM tasks t WHERE t.prospect_id=p.id AND t.type='story' AND t.status IN ('validee','publiee','validation_client','validation_technique') AND DATE_FORMAT(t.due_date,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m')) AS stories_done,
       (SELECT GROUP_CONCAT(CONCAT(u.name,' (',ca.role,')') SEPARATOR ', ') FROM client_assignments ca JOIN users u ON u.id=ca.user_id WHERE ca.prospect_id=p.id) AS team
     FROM prospects p LEFT JOIN offers o ON o.id=p.offer_id WHERE p.label='client' ${filter} ORDER BY p.priority, p.name`, params));
}));

// Responsable technique : attribuer un client à un GD
router.post('/clients/:id/assign', allow('responsable_technique', 'responsable_communication'), wrap(async (req, res) => {
  const { user_id, role = 'graphiste' } = req.body;
  if (role === 'graphiste') await q("DELETE FROM client_assignments WHERE prospect_id=? AND role='graphiste'", [req.params.id]);
  await q('INSERT IGNORE INTO client_assignments (prospect_id, user_id, role, assigned_by) VALUES (?,?,?,?)', [req.params.id, user_id, role, req.user.id]);
  await q("UPDATE tasks SET assigned_to=? WHERE prospect_id=? AND status IN (?) AND ? = 'graphiste'", [user_id, req.params.id, OPEN, role]);
  await notify(user_id, 'Un nouveau client vous a été attribué', '/dashboard/clients');
  res.json({ ok: true });
}));

module.exports = router;
module.exports.generateDailyTasks = generateDailyTasks;
