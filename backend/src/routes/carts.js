// Paniers du site : le visiteur compose son panier (formule, services, prestations sur devis),
// l'envoie, reçoit un code de suivi (IC-XXXXXX) et suit l'avancement sur /suivi/<code>.
// Les prix sont recalculés ici depuis la base : le navigateur n'envoie que des références.
const crypto = require('crypto');
const { q, one } = require('../db');
const { auth, allow } = require('../auth');
const { notify, notifyRole, wrap, HttpError } = require('../util');

// Prestations sur devis (pas de prix public)
const DEVIS = {
  strategie: 'Stratégie marketing',
  media_physique: 'Media buying physique',
  identite: 'Design et identité visuelle',
  audiovisuel: 'Production audiovisuelle',
  evenementiel: 'Événementiel et grands spectacles',
  meta_ads: 'Campagnes Meta Ads (gestion mensuelle)',
};

const STATUS = ['recue', 'contactee', 'devis_envoye', 'confirmee', 'en_production', 'livree', 'annulee'];
const STAFF = ['admin', 'responsable_commercial', 'commercial_sedentaire'];

// Code lisible au téléphone : pas de 0/O ni de 1/I
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  const b = crypto.randomBytes(6);
  return 'IC-' + [...b].map((x) => ALPHA[x % ALPHA.length]).join('');
}

async function priceItems(raw) {
  if (!Array.isArray(raw) || raw.length === 0) throw new HttpError(400, 'Le panier est vide');
  if (raw.length > 30) throw new HttpError(400, 'Panier trop volumineux');
  const items = [];
  for (const it of raw) {
    const qty = Math.min(50, Math.max(1, parseInt(it.quantity, 10) || 1));
    if (it.kind === 'offer') {
      const o = await one('SELECT * FROM offers WHERE code=?', [String(it.ref)]);
      if (!o) throw new HttpError(400, 'Formule inconnue');
      const months = [3, 6].includes(Number(it.months)) ? Number(it.months) : 6;
      items.push({ kind: 'offer', ref: o.code, label: `Formule ${o.name}, ${months} mois`, months, quantity: 1, unit_price: o.price_month, total: o.price_month * months });
    } else if (it.kind === 'service') {
      const s = await one('SELECT * FROM services WHERE id=?', [Number(it.ref)]);
      if (!s) throw new HttpError(400, 'Service inconnu');
      items.push({ kind: 'service', ref: String(s.id), label: s.name, months: null, quantity: qty, unit_price: s.price, total: s.price * qty });
    } else if (it.kind === 'devis') {
      if (!DEVIS[it.ref]) throw new HttpError(400, 'Prestation inconnue');
      items.push({ kind: 'devis', ref: it.ref, label: DEVIS[it.ref], months: null, quantity: 1, unit_price: 0, total: 0 });
    } else throw new HttpError(400, 'Article invalide');
  }
  if (items.filter((i) => i.kind === 'offer').length > 1) throw new HttpError(400, 'Une seule formule par panier');
  return items;
}

async function cartDetail(where, params) {
  const c = await one(
    `SELECT c.*, u.name AS assigned_name, u.phone AS assigned_phone
     FROM carts c LEFT JOIN users u ON u.id=c.assigned_to WHERE ${where}`, params);
  if (!c) return null;
  c.items = await q('SELECT * FROM cart_items WHERE cart_id=? ORDER BY id', [c.id]);
  c.events = await q(
    `SELECT e.status, e.note, e.created_at, u.name AS user_name FROM cart_events e
     LEFT JOIN users u ON u.id=e.user_id WHERE e.cart_id=? ORDER BY e.created_at, e.id`, [c.id]);
  return c;
}

// ───────── Public ─────────
const pub = require('express').Router();

pub.get('/public/services', wrap(async (req, res) => res.json(await q('SELECT id, name, price, unit FROM services ORDER BY price'))));
pub.get('/public/devis', (req, res) => res.json(Object.entries(DEVIS).map(([ref, label]) => ({ ref, label }))));

pub.post('/public/carts', wrap(async (req, res) => {
  const { name, company, phone, email, message } = req.body || {};
  if (!name || String(name).trim().length < 2) throw new HttpError(400, 'Indiquez votre nom');
  if (!phone && !email) throw new HttpError(400, 'Indiquez un téléphone ou un e-mail');
  const items = await priceItems(req.body.items);
  const once = items.filter((i) => i.kind === 'service').reduce((s, i) => s + i.total, 0);
  const offer = items.find((i) => i.kind === 'offer');
  const monthly = offer ? offer.unit_price : 0;

  // Le panier alimente l'Univers comme le formulaire de contact (source « site »)
  const o = offer ? await one('SELECT id FROM offers WHERE code=?', [offer.ref]) : null;
  const p = await q("INSERT INTO prospects (name, contact_name, phone, email, source, offer_id) VALUES (?,?,?,?, 'site', ?)",
    [company || name, name, phone || null, email || null, o ? o.id : null]);

  let code;
  for (let i = 0; i < 5; i++) {
    code = newCode();
    if (!(await one('SELECT id FROM carts WHERE code=?', [code]))) break;
  }
  const r = await q(
    'INSERT INTO carts (code, name, company, phone, email, message, prospect_id, total_once, total_monthly) VALUES (?,?,?,?,?,?,?,?,?)',
    [code, String(name).trim(), company || null, phone || null, email || null, message || null, p.insertId, once, monthly]);
  for (const i of items) {
    await q('INSERT INTO cart_items (cart_id, kind, ref, label, months, quantity, unit_price, total) VALUES (?,?,?,?,?,?,?,?)',
      [r.insertId, i.kind, i.ref, i.label, i.months, i.quantity, i.unit_price, i.total]);
  }
  await q("INSERT INTO cart_events (cart_id, status, note) VALUES (?, 'recue', 'Panier envoyé depuis le site')", [r.insertId]);
  await q('INSERT INTO contact_requests (name, company, phone, email, offer, message, prospect_id) VALUES (?,?,?,?,?,?,?)',
    [name, company, phone, email, offer ? offer.ref : 'panier', `Panier ${code} : ${items.map((i) => i.label).join(', ')}${message ? `\n${message}` : ''}`, p.insertId]);
  await notifyRole(['commercial_sedentaire', 'responsable_commercial'], `Nouveau panier ${code} : ${company || name}`, '/dashboard/paniers');
  res.json({ code });
}));

// Suivi public : le code fait office de clé, on ne renvoie que ce qui est utile au client
pub.get('/public/carts/:code', wrap(async (req, res) => {
  const c = await cartDetail('c.code=?', [String(req.params.code).toUpperCase()]);
  if (!c) throw new HttpError(404, 'Aucune commande ne correspond à ce code');
  res.json({
    code: c.code, status: c.status, created_at: c.created_at, updated_at: c.updated_at,
    first_name: String(c.name).split(' ')[0], company: c.company,
    total_once: c.total_once, total_monthly: c.total_monthly,
    conseiller: c.assigned_name ? String(c.assigned_name).split(' ')[0] : null,
    items: c.items.map(({ kind, label, months, quantity, unit_price, total }) => ({ kind, label, months, quantity, unit_price, total })),
    events: c.events.map(({ status, note, created_at }) => ({ status, note, created_at })),
  });
}));

// ───────── CRM ─────────
const crm = require('express').Router();
crm.use('/carts', auth, allow(...STAFF));

crm.get('/carts', wrap(async (req, res) => {
  const where = ['1=1'];
  const params = [];
  if (req.query.status) { where.push('c.status=?'); params.push(req.query.status); }
  res.json(await q(
    `SELECT c.*, u.name AS assigned_name,
       (SELECT GROUP_CONCAT(label ORDER BY id SEPARATOR ' · ') FROM cart_items WHERE cart_id=c.id) AS summary
     FROM carts c LEFT JOIN users u ON u.id=c.assigned_to
     WHERE ${where.join(' AND ')} ORDER BY c.created_at DESC`, params));
}));

crm.get('/carts/:id', wrap(async (req, res) => {
  const c = await cartDetail('c.id=?', [req.params.id]);
  if (!c) throw new HttpError(404, 'Panier introuvable');
  res.json(c);
}));

crm.post('/carts/:id/status', wrap(async (req, res) => {
  const { status, note } = req.body || {};
  if (!STATUS.includes(status)) throw new HttpError(400, 'Statut invalide');
  const c = await one('SELECT * FROM carts WHERE id=?', [req.params.id]);
  if (!c) throw new HttpError(404, 'Panier introuvable');
  if (['livree', 'annulee'].includes(c.status)) throw new HttpError(400, 'Ce panier est clôturé');
  // Le premier commercial qui fait avancer le panier en devient le conseiller
  await q('UPDATE carts SET status=?, assigned_to=COALESCE(assigned_to, ?) WHERE id=?', [status, req.user.id, c.id]);
  await q('INSERT INTO cart_events (cart_id, status, note, user_id) VALUES (?,?,?,?)', [c.id, status, note || null, req.user.id]);
  if (status === 'confirmee' && c.prospect_id) {
    await q("UPDATE prospects SET label='qualifie' WHERE id=? AND label='prospect'", [c.prospect_id]);
  }
  res.json({ ok: true });
}));

crm.post('/carts/:id/assign', allow('admin', 'responsable_commercial'), wrap(async (req, res) => {
  const u = await one(`SELECT id FROM users WHERE id=? AND role IN ('commercial_sedentaire','responsable_commercial')`, [req.body.user_id]);
  if (!u) throw new HttpError(400, 'Commercial invalide');
  const c = await one('SELECT code FROM carts WHERE id=?', [req.params.id]);
  await q('UPDATE carts SET assigned_to=? WHERE id=?', [u.id, req.params.id]);
  await notify(u.id, `Panier ${c.code} vous est attribué`, '/dashboard/paniers');
  res.json({ ok: true });
}));

module.exports = { pub, crm, STATUS };
