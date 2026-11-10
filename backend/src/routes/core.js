// Auth · Utilisateurs · Notifications · Tableau de bord · Public (landing page)
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { q, one } = require('../db');
const { sign, auth, allow, ROLES } = require('../auth');
const { notifyRole, wrap, HttpError } = require('../util');

// ───────── Public ─────────
router.get('/public/offers', wrap(async (req, res) => res.json(await q('SELECT * FROM offers ORDER BY price_month'))));

router.post('/public/contact', wrap(async (req, res) => {
  const { name, company, phone, email, offer, message } = req.body;
  if (!name || (!phone && !email)) throw new HttpError(400, 'Nom et téléphone ou e-mail obligatoires');
  // Le formulaire du site alimente directement l'Univers (pipeline « site »)
  const p = await q("INSERT INTO prospects (name, contact_name, phone, email, source) VALUES (?,?,?,?, 'site')", [company || name, name, phone, email]);
  await q('INSERT INTO contact_requests (name, company, phone, email, offer, message, prospect_id) VALUES (?,?,?,?,?,?,?)',
    [name, company, phone, email, offer, message, p.insertId]);
  await notifyRole(['commercial_sedentaire', 'responsable_commercial'], `Nouvelle demande via le site : ${company || name}`, '/espace/univers');
  res.json({ ok: true });
}));

router.post('/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  const u = await one('SELECT * FROM users WHERE email=? AND active=1', [String(email || '').toLowerCase().trim()]);
  if (!u || !(await bcrypt.compare(password || '', u.password_hash))) throw new HttpError(401, 'Identifiants incorrects');
  res.json({ token: sign(u), user: { id: u.id, name: u.name, role: u.role, email: u.email } });
}));

// ───────── Authentifié ─────────
router.use(auth);

router.get('/auth/me', wrap(async (req, res) => {
  const u = await one('SELECT id, name, email, role, phone FROM users WHERE id=?', [req.user.id]);
  res.json({ ...u, role_label: ROLES[u.role] });
}));

router.get('/roles', (req, res) => res.json(ROLES));

router.get('/users', wrap(async (req, res) => {
  const { role } = req.query;
  const roles = role ? String(role).split(',') : null;
  const rows = await q(
    `SELECT u.id, u.name, u.email, u.role, u.phone, u.daily_capacity, u.active,
       (SELECT GROUP_CONCAT(s.name SEPARATOR ', ') FROM user_sectors us JOIN sectors s ON s.id=us.sector_id WHERE us.user_id=u.id) AS sectors
     FROM users u WHERE ${roles ? 'u.role IN (?)' : "u.role<>'client'"} ORDER BY u.role, u.name`, roles ? [roles] : []);
  res.json(rows);
}));

router.post('/users', allow('admin'), wrap(async (req, res) => {
  const { name, email, password, role, phone, daily_capacity, prospect_id } = req.body;
  if (!name || !email || !password || !ROLES[role]) throw new HttpError(400, 'Champs obligatoires manquants');
  const r = await q('INSERT INTO users (name, email, password_hash, role, phone, daily_capacity) VALUES (?,?,?,?,?,?)',
    [name, email.toLowerCase().trim(), await bcrypt.hash(password, 10), role, phone || null, daily_capacity || 6]);
  if (role === 'client' && prospect_id) await q('UPDATE prospects SET client_user_id=? WHERE id=?', [r.insertId, prospect_id]);
  res.json({ id: r.insertId });
}));

router.patch('/users/:id', allow('admin'), wrap(async (req, res) => {
  const { name, role, phone, daily_capacity, active, password } = req.body;
  await q('UPDATE users SET name=COALESCE(?,name), role=COALESCE(?,role), phone=COALESCE(?,phone), daily_capacity=COALESCE(?,daily_capacity), active=COALESCE(?,active) WHERE id=?',
    [name ?? null, role ?? null, phone ?? null, daily_capacity ?? null, active ?? null, req.params.id]);
  if (password) await q('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(password, 10), req.params.id]);
  res.json({ ok: true });
}));

router.get('/offers', wrap(async (req, res) => res.json(await q('SELECT * FROM offers ORDER BY price_month'))));

router.get('/clients', wrap(async (req, res) => {
  res.json(await q("SELECT p.id, p.name, o.name AS offer FROM prospects p LEFT JOIN offers o ON o.id=p.offer_id WHERE p.label='client' ORDER BY p.name"));
}));

router.get('/notifications', wrap(async (req, res) => {
  res.json(await q('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50', [req.user.id]));
}));

router.post('/notifications/read', wrap(async (req, res) => {
  await q('UPDATE notifications SET read_at=NOW() WHERE user_id=? AND read_at IS NULL', [req.user.id]);
  res.json({ ok: true });
}));

router.get('/contact-requests', allow('responsable_commercial', 'commercial_sedentaire'), wrap(async (req, res) => {
  res.json(await q('SELECT * FROM contact_requests ORDER BY created_at DESC LIMIT 200'));
}));

// ───────── Tableau de bord par rôle ─────────
const count = async (sql, p = []) => Number((await one(sql, p))?.n || 0);

router.get('/dashboard', wrap(async (req, res) => {
  const u = req.user;
  const id = u.id;
  const kpis = [];
  const add = (label, value, hint, tone) => kpis.push({ label, value, hint, tone });

  if (['admin', 'responsable_communication'].includes(u.role)) {
    const pipe = await q('SELECT status, COUNT(*) n FROM dossiers GROUP BY status');
    const by = Object.fromEntries(pipe.map((r) => [r.status, r.n]));
    add('Clients actifs', await count("SELECT COUNT(*) n FROM prospects WHERE label='client'"));
    add('Revenu récurrent', (await count("SELECT COALESCE(SUM(o.price_month),0) n FROM prospects p JOIN offers o ON o.id=p.offer_id WHERE p.label='client'")).toLocaleString('fr-FR') + ' DA', 'HT / mois');
    add('Paiements à vérifier', by.signe || 0, 'Statut Signé', by.signe ? 'warn' : null);
    add('Création en cours', by.creation_en_cours || 0);
    add('En attente de validation', by.en_attente_validation || 0, 'relance sous 48h');
    add('Modifications demandées', by.modification_demandee || 0, null, by.modification_demandee ? 'warn' : null);
    add('Validation du 1er coup', await firstTimeRate(), 'tâches validées sans modification');
    return res.json({ kpis, pipeline: pipe });
  }
  if (u.role === 'responsable_commercial') {
    add('Deals à attribuer', await count("SELECT COUNT(*) n FROM deals WHERE status='a_attribuer'"), null, 'warn');
    add('Appels / visites du jour', await count('SELECT COUNT(*) n FROM reports WHERE DATE(created_at)=CURDATE()'));
    add('Signés ce mois', await count("SELECT COUNT(*) n FROM dossiers WHERE DATE_FORMAT(created_at,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m')"));
    add('Demandes site (7 j)', await count('SELECT COUNT(*) n FROM contact_requests WHERE created_at>=NOW()-INTERVAL 7 DAY'));
    add('Tickets SAV ouverts', await count("SELECT COUNT(*) n FROM tickets WHERE department='commercial' AND status<>'resolu'"));
    const team = await q(
      `SELECT u.name, u.role, SUM(DATE(r.created_at)=CURDATE()) today, COUNT(r.id) month
       FROM users u LEFT JOIN reports r ON r.user_id=u.id AND r.created_at>=DATE_FORMAT(CURDATE(),'%Y-%m-01')
       WHERE u.role IN ('commercial_sedentaire','commercial_terrain') GROUP BY u.id ORDER BY month DESC`);
    return res.json({ kpis, team });
  }
  if (['commercial_sedentaire', 'commercial_terrain'].includes(u.role)) {
    add(u.role === 'commercial_terrain' ? 'Visites du jour' : 'Appels du jour', await count('SELECT COUNT(*) n FROM reports WHERE user_id=? AND DATE(created_at)=CURDATE()', [id]));
    add('RDV aujourd\'hui', await count("SELECT COUNT(*) n FROM deals WHERE assigned_to=? AND status='programme' AND DATE(scheduled_at)=CURDATE()", [id]), null, 'accent');
    add('Deals à programmer', await count("SELECT COUNT(*) n FROM deals WHERE assigned_to=? AND status='attribue'", [id]));
    add('À relancer', await count("SELECT COUNT(*) n FROM deals WHERE (assigned_to=? OR created_by=?) AND status='a_relancer'", [id, id]));
    add('Signés ce mois', await count("SELECT COUNT(*) n FROM dossiers WHERE signed_by=? AND DATE_FORMAT(created_at,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m')", [id]));
    if (u.role === 'commercial_sedentaire') add('Commandes à valider', await count("SELECT COUNT(*) n FROM orders WHERE status='en_attente'"));
    const today = await q(
      `SELECT d.id, d.scheduled_at, d.kind, p.name AS prospect_name, p.phone, p.address FROM deals d JOIN prospects p ON p.id=d.prospect_id
       WHERE d.assigned_to=? AND d.status='programme' AND DATE(d.scheduled_at)=CURDATE() ORDER BY d.scheduled_at`, [id]);
    return res.json({ kpis, today });
  }
  if (u.role === 'charge_clientele') {
    add('Clients suivis', await count('SELECT COUNT(DISTINCT prospect_id) n FROM dossiers WHERE cc_id=?', [id]));
    add('À présenter', await count("SELECT COUNT(*) n FROM tasks t WHERE t.status='validation_client' AND EXISTS (SELECT 1 FROM client_assignments ca WHERE ca.prospect_id=t.prospect_id AND ca.user_id=?)", [id]), null, 'accent');
    add('En attente client > 48h', await count("SELECT COUNT(*) n FROM dossiers WHERE cc_id=? AND status='en_attente_validation' AND validated_at IS NULL AND updated_at < NOW()-INTERVAL 48 HOUR", [id]), 'relancer par un 2e canal', 'warn');
    add('Modifications en cours', await count("SELECT COUNT(*) n FROM dossiers WHERE cc_id=? AND status='modification_demandee'", [id]));
    return res.json({ kpis });
  }
  if (u.role === 'responsable_technique') {
    add('À valider (technique)', await count("SELECT COUNT(*) n FROM tasks WHERE status='validation_technique'"), null, 'accent');
    add('Tâches en retard', await count("SELECT COUNT(*) n FROM tasks WHERE status IN ('a_faire','en_cours','modification_demandee') AND due_date<CURDATE()"), null, 'warn');
    add('Validées ce mois', await count("SELECT COUNT(*) n FROM tasks WHERE status IN ('validee','publiee') AND DATE_FORMAT(updated_at,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m')"));
    add('Validation du 1er coup', await firstTimeRate());
    return res.json({ kpis });
  }
  if (u.role === 'community_manager') {
    add('Contenus à publier', await count("SELECT COUNT(*) n FROM tasks t WHERE t.status='validee' AND EXISTS (SELECT 1 FROM client_assignments ca WHERE ca.prospect_id=t.prospect_id AND ca.user_id=?)", [id]), null, 'accent');
    add('Publiés ce mois', await count("SELECT COUNT(*) n FROM task_history WHERE user_id=? AND action='publication' AND DATE_FORMAT(created_at,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m')", [id]));
    add('Clients gérés', await count('SELECT COUNT(*) n FROM client_assignments WHERE user_id=?', [id]));
    return res.json({ kpis });
  }
  if (u.role === 'recouvrement') {
    add('Commandes à encaisser', await count("SELECT COUNT(*) n FROM orders WHERE status='recouvrement'"), null, 'accent');
    add('Montant à encaisser', (await count("SELECT COALESCE(SUM(price),0) n FROM orders WHERE status='recouvrement'")).toLocaleString('fr-FR') + ' DA');
    add('Encaissées ce mois', await count("SELECT COUNT(*) n FROM orders WHERE status='payee' AND DATE_FORMAT(created_at,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m')"));
    return res.json({ kpis });
  }
  if (u.role === 'client') {
    const p = await one('SELECT p.*, o.name AS offer FROM prospects p LEFT JOIN offers o ON o.id=p.offer_id WHERE client_user_id=?', [id]);
    if (!p) return res.json({ kpis });
    add('Formule', p.offer || '—');
    add('À valider', await count("SELECT COUNT(*) n FROM tasks WHERE prospect_id=? AND status='validation_client'", [p.id]), null, 'accent');
    add('Publiés ce mois', await count("SELECT COUNT(*) n FROM tasks WHERE prospect_id=? AND status='publiee' AND DATE_FORMAT(updated_at,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m')", [p.id]));
    add('Tickets ouverts', await count("SELECT COUNT(*) n FROM tickets WHERE prospect_id=? AND status<>'resolu'", [p.id]));
    return res.json({ kpis, client: p });
  }
  // Production (graphiste, photographe, développeur, media buyer)
  add('Tâches du jour', await count("SELECT COUNT(*) n FROM tasks WHERE assigned_to=? AND due_date<=CURDATE() AND status IN ('a_faire','en_cours','modification_demandee')", [id]), null, 'accent');
  add('Modifications', await count("SELECT COUNT(*) n FROM tasks WHERE assigned_to=? AND status='modification_demandee'", [id]), null, 'warn');
  add('En retard', await count("SELECT COUNT(*) n FROM tasks WHERE assigned_to=? AND due_date<CURDATE() AND status IN ('a_faire','en_cours','modification_demandee')", [id]));
  add('Validées ce mois', await count("SELECT COUNT(*) n FROM tasks WHERE assigned_to=? AND status IN ('validee','publiee') AND DATE_FORMAT(updated_at,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m')", [id]));
  res.json({ kpis });
}));

async function firstTimeRate() {
  const r = await one("SELECT COUNT(*) total, SUM(modif_count=0) ok FROM tasks WHERE status IN ('validee','publiee')");
  return r.total ? Math.round((Number(r.ok) / r.total) * 100) + ' %' : '—';
}

module.exports = router;
