// SAV (tickets) · Commandes client (cross-sell) · Services
const router = require('express').Router();
const { q, one } = require('../db');
const { allow } = require('../auth');
const { notify, notifyRole, wrap, HttpError } = require('../util');

async function clientProspect(user) {
  const p = await one('SELECT * FROM prospects WHERE client_user_id=?', [user.id]);
  if (!p) throw new HttpError(404, 'Aucune fiche client liée à ce compte');
  return p;
}

const DEPT_ROLES = {
  commercial: ['responsable_commercial', 'commercial_sedentaire'],
  communication: ['responsable_communication', 'charge_clientele'],
  technique: ['responsable_technique', 'developpeur'],
  facturation: ['recouvrement'],
};

// ───────── SAV ─────────
router.get('/tickets', wrap(async (req, res) => {
  const u = req.user;
  const where = ['1=1'];
  const params = [];
  if (u.role === 'client') { where.push('p.client_user_id=?'); params.push(u.id); }
  else if (u.role === 'commercial_sedentaire') { where.push("t.department='commercial' AND (t.assigned_to=? OR t.assigned_to IS NULL)"); params.push(u.id); }
  else if (u.role !== 'admin') {
    const depts = Object.entries(DEPT_ROLES).filter(([, r]) => r.includes(u.role)).map(([d]) => d);
    where.push(depts.length ? 't.department IN (?)' : '0');
    if (depts.length) params.push(depts);
  }
  if (req.query.status) { where.push('t.status=?'); params.push(req.query.status); }
  res.json(await q(
    `SELECT t.*, p.name AS client_name, a.name AS assigned_name FROM tickets t JOIN prospects p ON p.id=t.prospect_id
     LEFT JOIN users a ON a.id=t.assigned_to WHERE ${where.join(' AND ')} ORDER BY FIELD(t.status,'ouvert','en_cours','resolu'), t.created_at DESC`, params));
}));

router.post('/tickets', wrap(async (req, res) => {
  const u = req.user;
  const { subject, message, department = 'commercial' } = req.body;
  if (!subject) throw new HttpError(400, 'Sujet obligatoire');
  const prospectId = u.role === 'client' ? (await clientProspect(u)).id : req.body.prospect_id;
  if (!prospectId) throw new HttpError(400, 'Client obligatoire');
  let assigned = null;
  if (department === 'commercial') {
    // Attribué au sédentaire qui a traité le dossier (relance ou deal) ; sinon / si plusieurs → resp. commercial
    const handlers = await q(
      `SELECT DISTINCT r.user_id FROM reports r JOIN users u ON u.id=r.user_id
       WHERE r.prospect_id=? AND u.role='commercial_sedentaire'`, [prospectId]);
    if (handlers.length === 1) assigned = handlers[0].user_id;
  }
  const r = await q('INSERT INTO tickets (prospect_id, department, subject, message, assigned_to, created_by) VALUES (?,?,?,?,?,?)',
    [prospectId, department, subject, message || null, assigned, u.id]);
  if (assigned) await notify(assigned, `Nouveau ticket SAV : ${subject}`, '/dashboard/sav');
  else await notifyRole(DEPT_ROLES[department]?.[0] || 'admin', `Ticket SAV à attribuer : ${subject}`, '/dashboard/sav');
  res.json({ id: r.insertId });
}));

router.post('/tickets/:id/take', allow('commercial_sedentaire', 'responsable_commercial', 'charge_clientele', 'responsable_communication', 'responsable_technique', 'developpeur', 'recouvrement'), wrap(async (req, res) => {
  const assignee = req.body.user_id && req.user.role.startsWith('responsable') ? req.body.user_id : req.user.id;
  await q("UPDATE tickets SET assigned_to=?, status='en_cours' WHERE id=?", [assignee, req.params.id]);
  if (assignee !== req.user.id) await notify(assignee, 'Un ticket SAV vous a été attribué', '/dashboard/sav');
  res.json({ ok: true });
}));

router.post('/tickets/:id/resolve', wrap(async (req, res) => {
  const t = await one('SELECT t.*, p.client_user_id FROM tickets t JOIN prospects p ON p.id=t.prospect_id WHERE t.id=?', [req.params.id]);
  if (!t) throw new HttpError(404, 'Ticket introuvable');
  await q("UPDATE tickets SET status='resolu' WHERE id=?", [t.id]);
  if (t.client_user_id) await notify(t.client_user_id, `Ticket résolu : ${t.subject}`, '/espace-client/support');
  res.json({ ok: true });
}));

// ───────── Services & commandes ─────────
router.get('/services', wrap(async (req, res) => res.json(await q('SELECT * FROM services ORDER BY name'))));

router.get('/orders', wrap(async (req, res) => {
  const u = req.user;
  const where = ['1=1'];
  const params = [];
  if (u.role === 'client') { where.push('p.client_user_id=?'); params.push(u.id); }
  else if (u.role === 'recouvrement') where.push("o.status IN ('recouvrement','payee')");
  if (req.query.status) { where.push('o.status=?'); params.push(req.query.status); }
  res.json(await q(
    `SELECT o.*, s.name AS service, p.name AS client_name, p.phone, v.name AS validated_by_name
     FROM orders o JOIN services s ON s.id=o.service_id JOIN prospects p ON p.id=o.prospect_id LEFT JOIN users v ON v.id=o.validated_by
     WHERE ${where.join(' AND ')} ORDER BY o.created_at DESC`, params));
}));

router.post('/orders', allow('client'), wrap(async (req, res) => {
  const p = await clientProspect(req.user);
  const s = await one('SELECT * FROM services WHERE id=?', [req.body.service_id]);
  if (!s) throw new HttpError(400, 'Service invalide');
  const qty = Math.max(1, Number(req.body.quantity) || 1);
  const r = await q('INSERT INTO orders (prospect_id, service_id, quantity, price, note) VALUES (?,?,?,?,?)', [p.id, s.id, qty, s.price * qty, req.body.note || null]);
  await notifyRole(['commercial_sedentaire', 'responsable_commercial'], `Commande extra : ${p.name} — ${s.name}`, '/dashboard/commandes');
  res.json({ id: r.insertId });
}));

// Le commercial valide la commande (pas le prix, fixé dans le CRM) → part au recouvrement
router.post('/orders/:id/validate', allow('commercial_sedentaire', 'responsable_commercial'), wrap(async (req, res) => {
  const o = await one('SELECT o.*, p.name FROM orders o JOIN prospects p ON p.id=o.prospect_id WHERE o.id=?', [req.params.id]);
  if (!o || o.status !== 'en_attente') throw new HttpError(400, 'Commande non valide');
  await q("UPDATE orders SET status='recouvrement', validated_by=? WHERE id=?", [req.user.id, o.id]);
  await notifyRole('recouvrement', `Commande validée, client prêt à payer : ${o.name} (${o.price} DA)`, '/dashboard/commandes');
  res.json({ ok: true });
}));

router.post('/orders/:id/cancel', allow('commercial_sedentaire', 'responsable_commercial', 'client'), wrap(async (req, res) => {
  await q("UPDATE orders SET status='annulee' WHERE id=? AND status='en_attente'", [req.params.id]);
  res.json({ ok: true });
}));

router.post('/orders/:id/paid', allow('recouvrement'), wrap(async (req, res) => {
  await q("UPDATE orders SET status='payee' WHERE id=? AND status='recouvrement'", [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
