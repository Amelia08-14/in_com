// Workflow graphiste (GD) : À faire → En cours → En validation technique → En validation client → Validée
// Chaque refus (technique ou client) renvoie la tâche dans la partie Modification du GD.
const router = require('express').Router();
const { q, one } = require('../db');
const { allow } = require('../auth');
const { notify, notifyRole, ymd, remainingWorkdays, isWorkday, wrap, HttpError } = require('../util');
const { cartStep, createServiceTask, reopenDossier, checkDeliveryForProspect, fmt } = require('../flow');

const OPEN = ['a_faire', 'en_cours', 'modification_demandee'];
const PROD_ROLES = ['graphiste', 'photographe', 'developpeur', 'community_manager', 'media_buyer'];

async function log(taskId, userId, action, status, note = null) {
  await q('INSERT INTO task_history (task_id, user_id, action, status, note) VALUES (?,?,?,?,?)', [taskId, userId, action, status, note]);
}

async function getTask(id) {
  const t = await one(
    `SELECT t.*, p.name AS client_name, p.client_user_id, u.name AS assigned_name
     FROM tasks t JOIN prospects p ON p.id=t.prospect_id LEFT JOIN users u ON u.id=t.assigned_to WHERE t.id=?`, [id]);
  if (!t) throw new HttpError(404, 'Tâche introuvable');
  return t;
}

// ───────── Génération des tâches du jour à partir du quota mensuel ─────────
let lastGeneration = null;
// prospectId : ne générer que pour ce client (lancement de production juste après le paiement)
async function generateDailyTasks(date = new Date(), prospectId = null) {
  if (!isWorkday(date)) return 0;
  const day = ymd(date);
  const monthStart = day.slice(0, 8) + '01';
  const clients = await q(
    `SELECT p.id, p.name, p.priority, o.posts_month, o.stories_month, o.reels_month, ca.user_id AS gd_id,
       (SELECT d.id FROM dossiers d WHERE d.prospect_id=p.id AND d.status NOT IN ('signe') AND d.payment_status<>'non_paye' ORDER BY d.id DESC LIMIT 1) AS dossier_id
     FROM prospects p JOIN offers o ON o.id=p.offer_id
     JOIN client_assignments ca ON ca.prospect_id=p.id AND ca.role='graphiste'
     WHERE p.label='client' ${prospectId ? 'AND p.id=?' : ''}`, prospectId ? [prospectId] : []);
  const daysLeft = remainingWorkdays(date);
  let created = 0;
  for (const c of clients) {
    if (!c.dossier_id) continue; // pas de production sans paiement confirmé
    const before = created;
    for (const [type, quota] of [['conception', c.posts_month], ['story', c.stories_month], ['reel', c.reels_month]]) {
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
          [c.id, c.dossier_id, c.gd_id, type, `${{ story: 'Story', reel: 'Reel' }[type] || 'Conception'} ${already.n + i + 1}/${quota} — ${c.name}`, c.priority, day]);
        await log(r.insertId, null, 'generation', 'a_faire');
        created++;
      }
    }
    // Nouveau mois d'abonnement : le dossier livré le mois dernier repasse en production
    if (created > before) await reopenDossier(c.dossier_id, 'Nouveau mois de production');
  }
  if (!prospectId) await checkLateAlerts();
  return created;
}

// ───────── Lancement automatique de la production dès le paiement ─────────
// Équipe nécessaire selon la prestation. Chaque rôle manquant est confié au collaborateur le moins chargé
// (tâches ouvertes et clients suivis), y compris ceux qui ont ce rôle en rôle supplémentaire.
const TEAM_BY_SERVICE = {
  abonnement: ['charge_clientele', 'graphiste', 'community_manager'],
  graphisme: ['charge_clientele', 'graphiste'],
  photo_video: ['charge_clientele', 'photographe'],
  developpement: ['charge_clientele', 'developpeur'],
  media_buying: ['charge_clientele', 'media_buyer'],
  evenementiel: ['charge_clientele'],
};
const ROLE_NAME = { charge_clientele: 'chargé de clientèle', graphiste: 'graphiste', community_manager: 'community manager', photographe: 'photographe', developpeur: 'développeur', media_buyer: 'media buyer' };

async function leastLoaded(role) {
  return one(
    `SELECT u.id, u.name,
       (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to=u.id AND t.status IN (?)) + 3 * (SELECT COUNT(*) FROM client_assignments ca WHERE ca.user_id=u.id) AS charge
     FROM users u WHERE u.active=1 AND (u.role=? OR FIND_IN_SET(?, u.extra_roles)) ORDER BY charge ASC, u.id LIMIT 1`, [OPEN, role, role]);
}

async function launchProduction(dossierId, byUserId) {
  const d = await one(
    `SELECT d.*, p.name AS client_name, p.client_user_id, p.offer_id AS p_offer, p.drive_url
     FROM dossiers d JOIN prospects p ON p.id=d.prospect_id WHERE d.id=?`, [dossierId]);
  if (!d) throw new HttpError(404, 'Dossier introuvable');
  // La formule du dossier fixe les quotas de production du client
  if (d.offer_id && d.offer_id !== d.p_offer) await q('UPDATE prospects SET offer_id=? WHERE id=?', [d.offer_id, d.prospect_id]);
  const offer = await one('SELECT * FROM offers WHERE id=?', [d.offer_id || d.p_offer]);
  const team = await q('SELECT user_id, role FROM client_assignments WHERE prospect_id=?', [d.prospect_id]);
  const added = [];
  const missing = [];
  for (const role of TEAM_BY_SERVICE[d.service_type] || ['charge_clientele']) {
    if (team.some((t) => t.role === role)) continue;
    const u = await leastLoaded(role);
    if (!u) { missing.push(ROLE_NAME[role] || role); continue; }
    await q('INSERT IGNORE INTO client_assignments (prospect_id, user_id, role, assigned_by) VALUES (?,?,?,?)', [d.prospect_id, u.id, role, byUserId]);
    if (role === 'charge_clientele' && !d.cc_id) await q('UPDATE dossiers SET cc_id=? WHERE id=?', [u.id, d.id]);
    added.push({ ...u, role });
  }
  const starting = ['signe', 'paiement_confirme'].includes(d.status);
  if (starting) {
    await q("UPDATE dossiers SET status='creation_en_cours' WHERE id=?", [d.id]);
    await log2(d.id, byUserId, 'creation_en_cours', `Production lancée automatiquement${added.length ? ` · équipe : ${added.map((a) => `${a.name} (${ROLE_NAME[a.role]})`).join(', ')}` : ''}`);
  }
  let created = await generateDailyTasks(new Date(), d.prospect_id);
  if (starting) {
    // Services ponctuels du devis ou de l'offre personnalisée : une tâche chacun
    for (const it of await q('SELECT label, quantity FROM dossier_items WHERE dossier_id=?', [d.id])) {
      if (await createServiceTask({ prospectId: d.prospect_id, dossierId: d.id, label: it.label, quantity: it.quantity, byUserId, origin: 'Service du dossier' })) created++;
    }
    await cartStep(d.id, 'en_production', 'Paiement reçu : la production a démarré');
    if (d.signed_by && d.signed_by !== byUserId) {
      await notify(d.signed_by, `Paiement reçu pour ${d.client_name} (${fmt(d.amount)}) : la production démarre. Rien à faire de votre côté.`, '/dashboard/dossiers');
    }
    if (!d.drive_url) {
      await notifyRole('responsable_technique', `${d.client_name} a payé : créez son dossier Drive de références et collez le lien dans son dossier.`, '/dashboard/dossiers');
    }
  }
  const quota = offer ? [offer.posts_month && `${offer.posts_month} posts`, offer.stories_month && `${offer.stories_month} stories`, offer.reels_month && `${offer.reels_month} reels`].filter(Boolean).join(', ') : '';
  for (const a of added) {
    const what = a.role === 'graphiste' && quota ? ` · ${quota} par mois, découpés en tâches quotidiennes` : '';
    const todo = a.role === 'charge_clientele' ? ' Appelez le client sous 24 h pour vous présenter.' : ' Vos tâches arrivent dans Mes tâches.';
    await notify(a.id, `Nouveau client : ${d.client_name}${offer ? ` (formule ${offer.name})` : ''}${what}.${todo}`, a.role === 'charge_clientele' ? '/dashboard/dossiers' : '/dashboard/taches');
  }
  if (d.client_user_id) {
    await notify(d.client_user_id, `Paiement reçu : la production de votre projet démarre. Vous validerez chaque contenu dans « À valider »${d.drive_url ? ' ; déposez vos références dans votre dossier partagé' : ''}.`, '/espace-client/projets');
  }
  if (missing.length) {
    await notifyRole(['responsable_communication', 'admin'], `Production de ${d.client_name} : aucun ${missing.join(', ')} disponible, attribuez-le dans le dossier`, '/dashboard/dossiers');
  }
  if (!offer && (TEAM_BY_SERVICE[d.service_type] || []).includes('graphiste')) {
    await notifyRole(['responsable_communication', 'admin'], `Production de ${d.client_name} : aucune formule choisie, les tâches ne peuvent pas être réparties`, '/dashboard/dossiers');
  }
  return { added, missing, created };
}

async function log2(dossierId, userId, status, note) {
  await q('INSERT INTO dossier_history (dossier_id, user_id, status, note) VALUES (?,?,?,?)', [dossierId, userId, status, note]);
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
     WHERE (u.role='graphiste' OR FIND_IN_SET('graphiste', u.extra_roles)) GROUP BY u.id HAVING late >= u.daily_capacity * 3`, [OPEN]);
  for (const r of rows) {
    const msg = `Retard cumulé ≥ 3 jours pour ${r.name} (${r.late} tâches)`;
    const exists = await one('SELECT id FROM notifications WHERE message=? AND DATE(created_at)=CURDATE()', [msg]);
    if (!exists) await notifyRole(['responsable_technique', 'admin'], msg, '/dashboard/equipe-gd');
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
  const client = await one('SELECT p.name, p.specialty, p.documents_url, p.drive_url, o.name AS offer FROM prospects p LEFT JOIN offers o ON o.id=p.offer_id WHERE p.id=?', [t.prospect_id]);
  res.json({ ...t, versions, history, client });
}));

// Créer une tâche manuellement (resp. technique / resp. communication)
// Consigne précise donnée à un collaborateur, avec échéance (depuis Tâches ou depuis un dossier client)
router.post('/', allow('responsable_technique', 'responsable_communication'), wrap(async (req, res) => {
  const { assigned_to, type = 'conception', theme, brief, priority = 2, due_date, dossier_id } = req.body;
  let { prospect_id } = req.body;
  if (dossier_id && !prospect_id) prospect_id = (await one('SELECT prospect_id FROM dossiers WHERE id=?', [dossier_id]))?.prospect_id;
  if (!prospect_id || !assigned_to) throw new HttpError(400, 'Client et intervenant obligatoires');
  if (!String(theme || '').trim()) throw new HttpError(400, 'Indiquez l’intitulé de la tâche');
  const who = await one('SELECT id, name FROM users WHERE id=? AND active=1', [assigned_to]);
  if (!who) throw new HttpError(400, 'Intervenant invalide');
  const client = await one('SELECT name FROM prospects WHERE id=?', [prospect_id]);
  const r = await q('INSERT INTO tasks (prospect_id, dossier_id, assigned_to, type, theme, brief, priority, due_date) VALUES (?,?,?,?,?,?,?,?)',
    [prospect_id, dossier_id || null, assigned_to, type, theme, brief || null, priority, due_date || ymd()]);
  await log(r.insertId, req.user.id, 'creation_manuelle', 'a_faire', brief || null);
  // Le collaborateur est toujours attaché au client, pour voir sa fiche et ses coordonnées
  const role = (await one('SELECT role FROM users WHERE id=?', [assigned_to])).role;
  await q('INSERT IGNORE INTO client_assignments (prospect_id, user_id, role, assigned_by) VALUES (?,?,?,?)', [prospect_id, assigned_to, role, req.user.id]);
  await notify(assigned_to, `Nouvelle tâche (${client?.name || 'client'}) : ${theme}${due_date ? ` · pour le ${String(due_date).split('-').reverse().join('/')}` : ''}`, '/dashboard/taches');
  res.json({ id: r.insertId });
}));

// Suppression d'une tâche : réservée à la direction (historique et versions partent avec)
router.delete('/:id(\\d+)', allow(), wrap(async (req, res) => {
  const t = await getTask(req.params.id);
  await q('DELETE FROM tasks WHERE id=?', [t.id]);
  res.json({ ok: true });
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
  await notifyRole('responsable_technique', `À valider : ${t.theme || t.client_name} (V${v.n}). Validez ou demandez une modification avec une note.`, '/dashboard/validation');
  res.json({ ok: true, version: v.n });
}));

async function sendToModification(t, userId, note, by) {
  if (!note) throw new HttpError(400, 'Note obligatoire');
  await q("UPDATE tasks SET status='modification_demandee', part='modification', modif_count=modif_count+1, last_note=?, due_date=CURDATE(), completed_at=NULL WHERE id=?", [note, t.id]);
  await log(t.id, userId, `refus_${by}`, 'modification_demandee', note);
  await notify(t.assigned_to, `Modification à faire (${t.client_name}) : ${note}. Déposez la version corrigée dans Mes tâches.`, '/dashboard/taches');
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
    await notify(ccs.map((c) => c.user_id), `À faire valider par le client : ${t.theme || t.client_name}. Relancez-le s'il n'a pas répondu sous 48 h.`, '/dashboard/validation');
    if (t.client_user_id) await notify(t.client_user_id, 'Un contenu vous attend : validez-le ou demandez une modification dans « À valider ».', '/espace-client/a-valider');
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
    await notify(t.assigned_to, `Bravo, validé par le client ! (${t.theme || t.client_name}). Rien d'autre à faire sur cette tâche.`, '/dashboard/taches');
    const cms = await q("SELECT user_id FROM client_assignments WHERE prospect_id=? AND role='community_manager'", [t.prospect_id]);
    if (t.type !== 'dev') await notify(cms.map((c) => c.user_id), `À publier : ${t.theme || t.client_name}, validé par le client. Publiez-le puis marquez-le publié.`, '/dashboard/validation');
    await checkDeliveryForProspect(t.prospect_id);
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
  await checkDeliveryForProspect(t.prospect_id);
  res.json({ ok: true });
}));

// Responsable technique : réattribution forcée en cas critique de retard
router.post('/:id/reassign', allow('responsable_technique'), wrap(async (req, res) => {
  const t = await getTask(req.params.id);
  const { user_id } = req.body;
  if (!user_id || Number(user_id) === t.assigned_to) throw new HttpError(400, 'Choisir un autre graphiste');
  await q('UPDATE tasks SET assigned_to=?, reassigned_from=? WHERE id=?', [user_id, t.assigned_to, t.id]);
  await log(t.id, req.user.id, 'reattribution', t.status, `De ${t.assigned_to} vers ${user_id}`);
  await notify(user_id, `Tâche qui vous est confiée : ${t.theme || t.client_name}. Elle est dans Mes tâches.`, '/dashboard/taches');
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
  const gds = await q("SELECT id FROM users WHERE (role='graphiste' OR FIND_IN_SET('graphiste', extra_roles)) AND active=1");
  res.json(await Promise.all(gds.map((g) => gdStats(g.id, from, to))));
}));

// Quotas par client (réalisé / restant dans le mois)
router.get('/quotas', wrap(async (req, res) => {
  const u = req.user;
  const params = [];
  let filter = '';
  if (PROD_ROLES.includes(u.role)) { filter = 'AND EXISTS (SELECT 1 FROM client_assignments ca WHERE ca.prospect_id=p.id AND ca.user_id=?)'; params.push(u.id); }
  res.json(await q(
    `SELECT p.id, p.name, p.priority, o.name AS offer, o.posts_month, o.stories_month, p.documents_url, p.drive_url,
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
module.exports.launchProduction = launchProduction;
