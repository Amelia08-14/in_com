// Univers · Reporting · Deals · Calendrier — workflows commercial sédentaire & terrain
const router = require('express').Router();
const { q, one } = require('../db');
const { allow, COMMERCIAL } = require('../auth');
const { notify, notifyRole, wrap, HttpError } = require('../util');

const MANAGERS = ['admin', 'responsable_commercial'];
const isManager = (u) => MANAGERS.includes(u.role);

async function userSectorIds(userId) {
  return (await q('SELECT sector_id FROM user_sectors WHERE user_id=?', [userId])).map((r) => r.sector_id);
}

// Le commercial terrain ne voit que les prospects de ses secteurs
async function scopeProspect(user, prospectId) {
  const p = await one('SELECT * FROM prospects WHERE id=?', [prospectId]);
  if (!p) throw new HttpError(404, 'Fiche introuvable');
  if (user.role === 'commercial_terrain') {
    const sectors = await userSectorIds(user.id);
    if (!sectors.includes(p.sector_id)) throw new HttpError(403, 'Prospect hors de vos secteurs');
  }
  return p;
}

const PROSPECT_STATS = `
  (SELECT COUNT(*) FROM reports r WHERE r.prospect_id=p.id AND r.channel='visite') AS visits,
  (SELECT COUNT(*) FROM reports r WHERE r.prospect_id=p.id AND r.reason LIKE 'relance%') AS relances,
  (SELECT COUNT(*) FROM deals d WHERE d.prospect_id=p.id) AS deals_count,
  (SELECT MAX(r.created_at) FROM reports r WHERE r.prospect_id=p.id) AS last_contact`;

// ───────── Univers ─────────
router.get('/prospects', allow(...COMMERCIAL, 'responsable_communication', 'charge_clientele', 'responsable_technique'), wrap(async (req, res) => {
  const { label, sector_id, search, source } = req.query;
  const where = ['1=1'];
  const params = [];
  if (req.user.role === 'commercial_terrain') {
    const s = await userSectorIds(req.user.id);
    where.push(s.length ? 'p.sector_id IN (?)' : '0');
    if (s.length) params.push(s);
  }
  if (label) { where.push('p.label=?'); params.push(label); }
  if (sector_id) { where.push('p.sector_id=?'); params.push(sector_id); }
  if (source) { where.push('p.source=?'); params.push(source); }
  if (search) { where.push('(p.name LIKE ? OR p.phone LIKE ? OR p.specialty LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  const rows = await q(
    `SELECT p.*, s.name AS sector, o.name AS offer, ${PROSPECT_STATS}
     FROM prospects p LEFT JOIN sectors s ON s.id=p.sector_id LEFT JOIN offers o ON o.id=p.offer_id
     WHERE ${where.join(' AND ')} ORDER BY p.updated_at DESC LIMIT 500`, params);
  res.json(rows);
}));

// Recherche rapide par nom (formulaire de reporting)
router.get('/prospects/lookup', allow(...COMMERCIAL), wrap(async (req, res) => {
  const name = (req.query.name || '').trim();
  if (name.length < 2) return res.json([]);
  const rows = await q(
    `SELECT p.id, p.name, p.phone, p.label, s.name AS sector, p.sector_id, ${PROSPECT_STATS}
     FROM prospects p LEFT JOIN sectors s ON s.id=p.sector_id WHERE p.name LIKE ? ORDER BY p.name LIMIT 8`, [`%${name}%`]);
  res.json(rows);
}));

router.get('/prospects/:id', allow(...COMMERCIAL, 'responsable_communication', 'charge_clientele', 'responsable_technique'), wrap(async (req, res) => {
  await scopeProspect(req.user, req.params.id);
  const p = await one(
    `SELECT p.*, s.name AS sector, o.name AS offer, ${PROSPECT_STATS}
     FROM prospects p LEFT JOIN sectors s ON s.id=p.sector_id LEFT JOIN offers o ON o.id=p.offer_id WHERE p.id=?`, [req.params.id]);
  const history = await q(
    `SELECT r.*, u.name AS user_name, u.role AS user_role FROM reports r JOIN users u ON u.id=r.user_id
     WHERE r.prospect_id=? ORDER BY r.created_at DESC`, [req.params.id]);
  const deals = await q(
    `SELECT d.*, c.name AS created_by_name, a.name AS assigned_name FROM deals d
     JOIN users c ON c.id=d.created_by LEFT JOIN users a ON a.id=d.assigned_to WHERE d.prospect_id=? ORDER BY d.created_at DESC`, [req.params.id]);
  const team = await q(
    `SELECT ca.role, u.id, u.name FROM client_assignments ca JOIN users u ON u.id=ca.user_id WHERE ca.prospect_id=?`, [req.params.id]);
  res.json({ ...p, history, deals, team });
}));

// Modification d'une fiche : le commercial ne touche ni au statut, ni à l'offre, ni aux documents
router.patch('/prospects/:id', allow(...COMMERCIAL), wrap(async (req, res) => {
  await scopeProspect(req.user, req.params.id);
  const editable = ['name', 'contact_name', 'specialty', 'phone', 'email', 'maps_url', 'address', 'sector_id', 'priority'];
  if (isManager(req.user)) editable.push('label', 'offer_id', 'documents_url');
  const fields = Object.keys(req.body).filter((k) => editable.includes(k));
  if (!fields.length) throw new HttpError(400, 'Aucun champ modifiable');
  await q(`UPDATE prospects SET ${fields.map((f) => `${f}=?`).join(', ')} WHERE id=?`, [...fields.map((f) => req.body[f]), req.params.id]);
  res.json({ ok: true });
}));

// Reprise des dossiers d'un ancien commercial sur un secteur (resp. commercial)
router.post('/sectors/assign', allow('responsable_commercial'), wrap(async (req, res) => {
  const { user_id, sector_ids } = req.body;
  await q('DELETE FROM user_sectors WHERE user_id=?', [user_id]);
  for (const s of sector_ids || []) await q('INSERT INTO user_sectors VALUES (?,?)', [user_id, s]);
  res.json({ ok: true });
}));

router.get('/sectors', wrap(async (req, res) => {
  res.json(await q('SELECT * FROM sectors ORDER BY name'));
}));

// ───────── Reporting quotidien ─────────
async function createDossierFromSignature(prospectId, userId, documentsUrl) {
  const p = await one('SELECT * FROM prospects WHERE id=?', [prospectId]);
  await q("UPDATE prospects SET label='client', documents_url=COALESCE(?, documents_url) WHERE id=?", [documentsUrl, prospectId]);
  const offer = p.offer_id ? await one('SELECT * FROM offers WHERE id=?', [p.offer_id]) : null;
  const r = await q(
    "INSERT INTO dossiers (prospect_id, offer_id, title, signed_by, status, amount, payment_mode) VALUES (?,?,?,?, 'signe', ?, ?)",
    [prospectId, p.offer_id, `${p.name} — ${offer ? 'Formule ' + offer.name : 'Prestation'}`, userId, offer ? offer.price_month : 0,
      (await one('SELECT role FROM users WHERE id=?', [userId])).role === 'commercial_terrain' ? 'terrain' : 'bureau']);
  await q("INSERT INTO dossier_history (dossier_id, user_id, status, note) VALUES (?,?, 'signe', 'Signature commerciale')", [r.insertId, userId]);
  await notifyRole('responsable_communication', `Nouveau dossier signé : ${p.name} — paiement à vérifier`, '/espace/dossiers');
  return r.insertId;
}

router.post('/reports', allow('commercial_sedentaire', 'commercial_terrain', 'responsable_commercial'), wrap(async (req, res) => {
  const u = req.user;
  const { prospect_id, prospect, reason, notes, documents_url } = req.body;
  const channel = u.role === 'commercial_terrain' ? 'visite' : 'appel';
  if (!reason) throw new HttpError(400, 'Raison obligatoire');
  if (reason === 'signe' && !documents_url) throw new HttpError(400, 'Documents obligatoires pour un signé (lien Drive ou photos : contrat, registre de commerce, agrément)');

  let pid = prospect_id;
  let isNew = false;
  if (!pid) {
    // Nouveau prospect : le commercial remplit les informations nécessaires
    if (!prospect?.name) throw new HttpError(400, 'Nom du prospect obligatoire');
    const r = await q(
      'INSERT INTO prospects (name, contact_name, specialty, phone, maps_url, address, sector_id, source, created_by) VALUES (?,?,?,?,?,?,?,?,?)',
      [prospect.name, prospect.contact_name, prospect.specialty, prospect.phone, prospect.maps_url, prospect.address, prospect.sector_id || null,
        u.role === 'commercial_terrain' ? 'terrain' : (prospect.source || 'sedentaire'), u.id]);
    pid = r.insertId;
    isNew = true;
  } else {
    await scopeProspect(u, pid);
  }

  const before = await one('SELECT * FROM prospects WHERE id=?', [pid]);
  const priorByOthers = await one('SELECT COUNT(*) n FROM reports WHERE prospect_id=? AND user_id<>?', [pid, u.id]);

  await q('INSERT INTO reports (user_id, prospect_id, channel, reason, notes, documents_url) VALUES (?,?,?,?,?,?)',
    [u.id, pid, channel, reason, notes || null, documents_url || null]);

  const effects = [];
  // Règles automatiques du CRM
  if (reason === 'prospect' && !isNew && priorByOthers.n > 0 && before.label === 'prospect') {
    await q("UPDATE prospects SET label='qualifie' WHERE id=?", [pid]);
    effects.push('Déjà prospecté par un autre commercial : passé en Qualifié');
  }
  const visits = await one("SELECT COUNT(*) n FROM reports WHERE prospect_id=? AND channel='visite'", [pid]);
  if (visits.n > 2 && ['prospect'].includes(before.label)) {
    await q("UPDATE prospects SET label='qualifie' WHERE id=?", [pid]);
    effects.push('Plus de 2 visites : passé en Qualifié');
  }
  if (reason === 'promesse') { await q("UPDATE prospects SET label='promesse' WHERE id=?", [pid]); effects.push('Label : Promesse de signature'); }
  if (reason === 'a_eviter') { await q("UPDATE prospects SET label='a_eviter' WHERE id=?", [pid]); effects.push('Label : À éviter'); }
  if (reason === 'deal_terrain') {
    const d = await q("INSERT INTO deals (prospect_id, type, created_by, status, notes) VALUES (?, 'terrain', ?, 'a_attribuer', ?)", [pid, u.id, notes || null]);
    await q("INSERT INTO deal_history (deal_id, user_id, action) VALUES (?,?, 'creation')", [d.insertId, u.id]);
    await notifyRole('responsable_commercial', `Deal terrain à attribuer : ${before.name}`, '/espace/deals');
    effects.push('Deal terrain créé : transmis au responsable pour attribution');
  }
  if (reason === 'deal_bureau') {
    const d = await q("INSERT INTO deals (prospect_id, type, created_by, assigned_to, status, kind, notes) VALUES (?, 'bureau', ?, ?, 'attribue', 'passage_bureau', ?)", [pid, u.id, u.id, notes || null]);
    await q("INSERT INTO deal_history (deal_id, user_id, action) VALUES (?,?, 'creation')", [d.insertId, u.id]);
    effects.push('Deal bureau créé et attribué : à programmer');
  }
  if (reason === 'signe') {
    await createDossierFromSignature(pid, u.id, documents_url);
    effects.push('Signé : dossier transmis au responsable communication');
  }
  res.json({ ok: true, prospect_id: pid, effects });
}));

router.get('/reports', allow(...COMMERCIAL), wrap(async (req, res) => {
  const { from, to, reason, entry_type, name, user_id } = req.query;
  const where = ['1=1'];
  const params = [];
  if (isManager(req.user)) { if (user_id) { where.push('r.user_id=?'); params.push(user_id); } }
  else { where.push('r.user_id=?'); params.push(req.user.id); }
  if (from) { where.push('DATE(r.created_at)>=?'); params.push(from); }
  if (to) { where.push('DATE(r.created_at)<=?'); params.push(to); }
  if (reason) { where.push('r.reason=?'); params.push(reason); }
  if (entry_type) { where.push('r.entry_type=?'); params.push(entry_type); }
  if (name) { where.push('p.name LIKE ?'); params.push(`%${name}%`); }
  res.json(await q(
    `SELECT r.*, p.name AS prospect_name, p.label, u.name AS user_name FROM reports r
     JOIN prospects p ON p.id=r.prospect_id JOIN users u ON u.id=r.user_id
     WHERE ${where.join(' AND ')} ORDER BY r.created_at DESC LIMIT 500`, params));
}));

// ───────── Deals ─────────
router.get('/deals', allow(...COMMERCIAL), wrap(async (req, res) => {
  const { status, type } = req.query;
  const where = ['1=1'];
  const params = [];
  if (!isManager(req.user)) {
    // Deals attribués + deals à relancer qui reviennent chez le créateur
    where.push("(d.assigned_to=? OR (d.created_by=? AND d.status='a_relancer'))");
    params.push(req.user.id, req.user.id);
  }
  if (status) { where.push('d.status=?'); params.push(status); }
  if (type) { where.push('d.type=?'); params.push(type); }
  res.json(await q(
    `SELECT d.*, p.name AS prospect_name, p.phone, p.maps_url, p.address, s.name AS sector,
      c.name AS created_by_name, a.name AS assigned_name,
      (SELECT COUNT(*) FROM reports r WHERE r.prospect_id=p.id AND r.channel='visite') AS visits
     FROM deals d JOIN prospects p ON p.id=d.prospect_id LEFT JOIN sectors s ON s.id=p.sector_id
     JOIN users c ON c.id=d.created_by LEFT JOIN users a ON a.id=d.assigned_to
     WHERE ${where.join(' AND ')} ORDER BY FIELD(d.status,'a_attribuer','attribue','a_relancer','programme','gagne','perdu'), d.created_at DESC`, params));
}));

router.post('/deals/:id/assign', allow('responsable_commercial'), wrap(async (req, res) => {
  const { user_id } = req.body;
  const deal = await one('SELECT d.*, p.name FROM deals d JOIN prospects p ON p.id=d.prospect_id WHERE d.id=?', [req.params.id]);
  if (!deal) throw new HttpError(404, 'Deal introuvable');
  await q("UPDATE deals SET assigned_to=?, status='attribue' WHERE id=?", [user_id, deal.id]);
  await q("INSERT INTO deal_history (deal_id, user_id, action, detail) VALUES (?,?, 'attribution', ?)", [deal.id, req.user.id, `→ utilisateur ${user_id}`]);
  await notify(user_id, `Nouveau deal attribué : ${deal.name}`, '/espace/deals');
  res.json({ ok: true });
}));

router.post('/deals/:id/schedule', allow(...COMMERCIAL), wrap(async (req, res) => {
  const { scheduled_at, kind } = req.body;
  if (!scheduled_at) throw new HttpError(400, 'Date obligatoire');
  const deal = await one('SELECT * FROM deals WHERE id=?', [req.params.id]);
  if (!deal) throw new HttpError(404, 'Deal introuvable');
  if (!isManager(req.user) && deal.assigned_to !== req.user.id && deal.created_by !== req.user.id) throw new HttpError(403, 'Deal non attribué');
  await q("UPDATE deals SET scheduled_at=?, status='programme', assigned_to=COALESCE(assigned_to, ?), kind=COALESCE(?, kind) WHERE id=?",
    [scheduled_at.replace('T', ' '), req.user.id, kind || null, deal.id]);
  await q("INSERT INTO deal_history (deal_id, user_id, action, detail) VALUES (?,?, 'programmation', ?)", [deal.id, req.user.id, scheduled_at]);
  res.json({ ok: true });
}));

// Issue : reprogrammer · gagne · perdu · a_relancer — crée une copie dans le reporting du jour marquée « deal »
router.post('/deals/:id/outcome', allow(...COMMERCIAL), wrap(async (req, res) => {
  const { outcome, scheduled_at, notes, documents_url } = req.body;
  const deal = await one('SELECT * FROM deals WHERE id=?', [req.params.id]);
  if (!deal) throw new HttpError(404, 'Deal introuvable');
  if (!isManager(req.user) && deal.assigned_to !== req.user.id) throw new HttpError(403, 'Deal non attribué');
  if (!['reprogrammer', 'gagne', 'perdu', 'a_relancer'].includes(outcome)) throw new HttpError(400, 'Issue invalide');
  if (outcome === 'gagne' && !documents_url) throw new HttpError(400, 'Documents obligatoires pour un deal gagné');
  if (outcome === 'reprogrammer') {
    if (!scheduled_at) throw new HttpError(400, 'Nouvelle date obligatoire');
    await q("UPDATE deals SET scheduled_at=?, status='programme' WHERE id=?", [scheduled_at.replace('T', ' '), deal.id]);
  } else {
    await q('UPDATE deals SET status=? WHERE id=?', [outcome, deal.id]);
  }
  await q("INSERT INTO deal_history (deal_id, user_id, action, detail) VALUES (?,?, 'issue', ?)", [deal.id, req.user.id, outcome]);
  const channel = req.user.role === 'commercial_terrain' ? 'visite' : 'appel';
  await q("INSERT INTO reports (user_id, prospect_id, channel, reason, entry_type, outcome, notes, documents_url) VALUES (?,?,?, 'issue_deal', 'deal', ?, ?, ?)",
    [req.user.id, deal.prospect_id, channel, outcome, notes || null, documents_url || null]);
  if (outcome === 'gagne') await createDossierFromSignature(deal.prospect_id, req.user.id, documents_url);
  if (outcome === 'a_relancer' && deal.created_by !== req.user.id) {
    await notify(deal.created_by, 'Un deal revient chez vous à relancer', '/espace/deals');
  }
  res.json({ ok: true });
}));

// ───────── Calendrier ─────────
router.get('/calendar', allow(...COMMERCIAL), wrap(async (req, res) => {
  const { from, to } = req.query;
  const where = ['d.scheduled_at IS NOT NULL'];
  const params = [];
  if (!isManager(req.user)) { where.push('d.assigned_to=?'); params.push(req.user.id); }
  if (from) { where.push('DATE(d.scheduled_at)>=?'); params.push(from); }
  if (to) { where.push('DATE(d.scheduled_at)<=?'); params.push(to); }
  res.json(await q(
    `SELECT d.*, p.name AS prospect_name, p.phone, p.address, p.maps_url, a.name AS assigned_name
     FROM deals d JOIN prospects p ON p.id=d.prospect_id LEFT JOIN users a ON a.id=d.assigned_to
     WHERE ${where.join(' AND ')} ORDER BY d.scheduled_at`, params));
}));

module.exports = router;
module.exports.createDossierFromSignature = createDossierFromSignature;
