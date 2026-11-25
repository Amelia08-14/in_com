// Paniers du site : le visiteur compose son panier (formule, services, prestations sur devis),
// l'envoie, reçoit un code de suivi (IC-XXXXXX) et suit l'avancement sur /suivi/<code>.
// Les prix sont recalculés ici depuis la base : le navigateur n'envoie que des références.
const crypto = require('crypto');
const { q, one } = require('../db');
const { auth, allow } = require('../auth');
const { notify, wrap, HttpError } = require('../util');
const { newLead, markLeadHandled, signClient } = require('../flow');

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
const STAFF = ['admin', 'responsable_commercial', 'commercial_sedentaire', 'commercial_terrain'];

// Code lisible au téléphone : pas de 0/O ni de 1/I
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  const b = crypto.randomBytes(6);
  return 'IC-' + [...b].map((x) => ALPHA[x % ALPHA.length]).join('');
}

const qty999 = (v) => Math.min(999, Math.max(0, parseInt(v, 10) || 0));

// allowCustom : la formule sur mesure (quotas et prix choisis) n'est proposée que dans le CRM, par un commercial
async function priceItems(raw, { allowCustom = false } = {}) {
  if (!Array.isArray(raw) || raw.length === 0) throw new HttpError(400, 'Le panier est vide');
  if (raw.length > 30) throw new HttpError(400, 'Panier trop volumineux');
  const items = [];
  for (const it of raw) {
    const qty = Math.min(50, Math.max(1, parseInt(it.quantity, 10) || 1));
    if (it.kind === 'offer') {
      const o = await one('SELECT * FROM offers WHERE code=? AND active=1', [String(it.ref)]);
      if (!o) throw new HttpError(400, 'Formule inconnue');
      const months = [3, 6].includes(Number(it.months)) ? Number(it.months) : 6;
      items.push({ kind: 'offer', ref: o.code, label: `Formule ${o.name}, ${months} mois`, months, quantity: 1, unit_price: o.price_month, total: o.price_month * months });
    } else if (it.kind === 'service') {
      const s = await one('SELECT * FROM services WHERE id=? AND active=1', [Number(it.ref)]);
      if (!s) throw new HttpError(400, 'Service inconnu');
      items.push({ kind: 'service', ref: String(s.id), label: s.name, months: null, quantity: qty, unit_price: s.price, total: s.price * qty });
    } else if (it.kind === 'custom' && allowCustom) {
      // Formule sur mesure : nombre de posts, stories et reels par mois, prix mensuel et durée choisis par le commercial
      const posts = qty999(it.posts_month), stories = qty999(it.stories_month), reels = qty999(it.reels_month);
      const price = Math.min(100000000, Math.max(0, parseInt(it.unit_price, 10) || 0));
      if (!posts && !stories && !reels) throw new HttpError(400, 'Formule sur mesure : indiquez au moins un nombre de posts, stories ou reels');
      if (!price) throw new HttpError(400, 'Formule sur mesure : indiquez le prix mensuel');
      const months = [1, 3, 6, 12].includes(Number(it.months)) ? Number(it.months) : 6;
      const parts = [posts && `${posts} posts`, stories && `${stories} stories`, reels && `${reels} reels`].filter(Boolean).join(' · ');
      items.push({ kind: 'custom', ref: 'custom', label: `Formule sur mesure : ${parts}, ${months} mois`, months, quantity: 1, unit_price: price, total: price * months,
        posts_month: posts, stories_month: stories, reels_month: reels });
    } else if (it.kind === 'devis') {
      if (!DEVIS[it.ref]) throw new HttpError(400, 'Prestation inconnue');
      items.push({ kind: 'devis', ref: it.ref, label: DEVIS[it.ref], months: null, quantity: 1, unit_price: 0, total: 0 });
    } else throw new HttpError(400, 'Article invalide');
  }
  if (items.filter((i) => ['offer', 'custom'].includes(i.kind)).length > 1) throw new HttpError(400, 'Une seule formule par panier : un pack ou une formule sur mesure');
  return items;
}

async function cartDetail(where, params) {
  const c = await one(
    `SELECT c.*, u.name AS assigned_name, u.phone AS assigned_phone,
       cu.account_type AS client_type, cu.activity AS client_activity, cu.city AS client_city, cu.address AS client_address,
       cu.website AS client_website, cu.social_url AS client_social, cu.nif AS client_nif, cu.rc AS client_rc
     FROM carts c LEFT JOIN users u ON u.id=c.assigned_to LEFT JOIN users cu ON cu.id=c.user_id WHERE ${where}`, params);
  if (!c) return null;
  c.items = await q('SELECT * FROM cart_items WHERE cart_id=? ORDER BY id', [c.id]);
  c.events = await q(
    `SELECT e.status, e.note, e.created_at, u.name AS user_name FROM cart_events e
     LEFT JOIN users u ON u.id=e.user_id WHERE e.cart_id=? ORDER BY e.created_at, e.id`, [c.id]);
  return c;
}

// ───────── Public ─────────
const pub = require('express').Router();

pub.get('/public/services', wrap(async (req, res) => res.json(await q('SELECT id, name, price, unit FROM services WHERE active=1 ORDER BY sort_order, price'))));
pub.get('/public/devis', (req, res) => res.json(Object.entries(DEVIS).map(([ref, label]) => ({ ref, label }))));

// Envoi du panier : réservé aux comptes clients (inscription sur /dashboard/inscription).
// Nom, entreprise, téléphone et e-mail viennent du compte, pas du formulaire.
pub.post('/public/carts', auth, wrap(async (req, res) => {
  const u = await one('SELECT id, name, email, phone, company, role FROM users WHERE id=? AND active=1', [req.user.id]);
  if (!u) throw new HttpError(401, 'Session expirée');
  if (u.role !== 'client') throw new HttpError(403, 'Les demandes de devis se font avec un compte client');
  const { name, company, phone, email } = u;
  const message = req.body?.message ? String(req.body.message).slice(0, 2000) : null;
  const items = await priceItems(req.body?.items);
  const once = items.filter((i) => i.kind === 'service').reduce((s, i) => s + i.total, 0);
  const offer = items.find((i) => i.kind === 'offer');
  const monthly = offer ? offer.unit_price : 0;

  // Le panier alimente l'Univers (source « site ») : on réutilise la fiche du compte si elle existe
  const o = offer ? await one('SELECT id FROM offers WHERE code=?', [offer.ref]) : null;
  let p = await one('SELECT id FROM prospects WHERE client_user_id=? ORDER BY id LIMIT 1', [u.id]);
  if (p) {
    if (o) await q('UPDATE prospects SET offer_id=? WHERE id=?', [o.id, p.id]);
    p = { insertId: p.id };
  } else {
    p = await q("INSERT INTO prospects (name, contact_name, phone, email, source, offer_id, client_user_id) VALUES (?,?,?,?, 'site', ?, ?)",
      [company || name, name, phone || null, email || null, o ? o.id : null, u.id]);
  }

  let code;
  for (let i = 0; i < 5; i++) {
    code = newCode();
    if (!(await one('SELECT id FROM carts WHERE code=?', [code]))) break;
  }
  const r = await q(
    'INSERT INTO carts (code, name, company, phone, email, message, prospect_id, user_id, total_once, total_monthly) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [code, name, company || null, phone || null, email || null, message, p.insertId, u.id, once, monthly]);
  for (const i of items) {
    await q('INSERT INTO cart_items (cart_id, kind, ref, label, months, quantity, unit_price, total, posts_month, stories_month, reels_month) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [r.insertId, i.kind, i.ref, i.label, i.months, i.quantity, i.unit_price, i.total, i.posts_month ?? null, i.stories_month ?? null, i.reels_month ?? null]);
  }
  await q("INSERT INTO cart_events (cart_id, status, note) VALUES (?, 'recue', 'Panier envoyé depuis le site')", [r.insertId]);
  // Un commercial responsable dès l'arrivée : il devient le conseiller du client
  const who = await newLead({
    prospectId: p.insertId, name, company, phone, email, offer: offer ? offer.ref : 'panier', origin: `panier ${code}`, link: '/dashboard/paniers',
    message: `Panier ${code} : ${items.map((i) => i.label).join(', ')}${message ? `\n${message}` : ''}`,
  });
  if (who) await q('UPDATE carts SET assigned_to=? WHERE id=?', [who.id, r.insertId]);
  res.json({ code });
}));

// Les demandes du client connecté (page « Mes demandes de devis » de son espace)
pub.get('/my/carts', auth, wrap(async (req, res) => {
  res.json(await q(
    `SELECT c.id, c.code, c.status, c.total_once, c.total_monthly, c.created_at, c.updated_at,
       (SELECT GROUP_CONCAT(label ORDER BY id SEPARATOR ' · ') FROM cart_items WHERE cart_id=c.id) AS summary
     FROM carts c WHERE c.user_id=? ORDER BY c.created_at DESC`, [req.user.id]));
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

// Demande de devis saisie par l'équipe commerciale pour un prospect ou un client de l'Univers.
// Elle suit le même circuit que les paniers du site et donne au client un code de suivi.
crm.post('/carts', wrap(async (req, res) => {
  const b = req.body || {};
  const p = await one('SELECT * FROM prospects WHERE id=?', [b.prospect_id]);
  if (!p) throw new HttpError(400, 'Choisissez la fiche du prospect ou du client');
  const items = await priceItems(b.items, { allowCustom: true });
  const once = items.filter((i) => i.kind === 'service').reduce((sum, i) => sum + i.total, 0);
  const offer = items.find((i) => i.kind === 'offer');
  const sur = items.find((i) => i.kind === 'custom');
  if (offer) {
    const o = await one('SELECT id FROM offers WHERE code=?', [offer.ref]);
    await q('UPDATE prospects SET offer_id=? WHERE id=?', [o.id, p.id]);
  }
  const cu = p.client_user_id ? await one('SELECT email, phone FROM users WHERE id=?', [p.client_user_id]) : null;
  let code;
  for (let i = 0; i < 5; i++) {
    code = newCode();
    if (!(await one('SELECT id FROM carts WHERE code=?', [code]))) break;
  }
  const message = b.message ? String(b.message).slice(0, 2000) : null;
  const r = await q(
    `INSERT INTO carts (code, name, company, phone, email, message, prospect_id, user_id, created_by, assigned_to, total_once, total_monthly)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [code, p.contact_name || p.name, p.contact_name ? p.name : null, p.phone || cu?.phone || null, p.email || cu?.email || null, message,
      p.id, p.client_user_id || null, req.user.id, req.user.id, once, (offer || sur) ? (offer || sur).unit_price : 0]);
  for (const i of items) {
    await q('INSERT INTO cart_items (cart_id, kind, ref, label, months, quantity, unit_price, total, posts_month, stories_month, reels_month) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [r.insertId, i.kind, i.ref, i.label, i.months, i.quantity, i.unit_price, i.total, i.posts_month ?? null, i.stories_month ?? null, i.reels_month ?? null]);
  }
  await q("INSERT INTO cart_events (cart_id, status, note, user_id) VALUES (?, 'recue', 'Demande de devis saisie par votre conseiller', ?)", [r.insertId, req.user.id]);
  if (p.client_user_id) await notify(p.client_user_id, `Votre demande de devis ${code} est enregistrée : votre conseiller vous recontacte.`, '/espace-client/demandes');
  await markLeadHandled(p.id);
  res.json({ code, id: r.insertId });
}));

crm.delete('/carts/:id', allow(), wrap(async (req, res) => {
  await q('DELETE FROM carts WHERE id=?', [req.params.id]);
  res.json({ ok: true });
}));

crm.get('/carts', wrap(async (req, res) => {
  const where = ['1=1'];
  const params = [];
  if (req.query.status) { where.push('c.status=?'); params.push(req.query.status); }
  res.json(await q(
    `SELECT c.*, u.name AS assigned_name, cb.name AS created_by_name,
       (SELECT GROUP_CONCAT(label ORDER BY id SEPARATOR ' · ') FROM cart_items WHERE cart_id=c.id) AS summary
     FROM carts c LEFT JOIN users u ON u.id=c.assigned_to LEFT JOIN users cb ON cb.id=c.created_by
     WHERE ${where.join(' AND ')} ORDER BY c.created_at DESC`, params));
}));

crm.get('/carts/:id', wrap(async (req, res) => {
  const c = await cartDetail('c.id=?', [req.params.id]);
  if (!c) throw new HttpError(404, 'Panier introuvable');
  res.json(c);
}));

// Étapes posées à la main avant la signature. « Confirmée », « En production » et « Livrée »
// suivent le dossier : « Client signé » crée le dossier, le paiement lance la production, la livraison clôt le devis.
const MANUAL = ['recue', 'contactee', 'devis_envoye', 'annulee'];
crm.post('/carts/:id/status', wrap(async (req, res) => {
  const { status, note } = req.body || {};
  if (!MANUAL.includes(status)) throw new HttpError(400, 'Cette étape suit le dossier : utilisez « Client signé »');
  const c = await one('SELECT * FROM carts WHERE id=?', [req.params.id]);
  if (!c) throw new HttpError(404, 'Panier introuvable');
  if (!['recue', 'contactee', 'devis_envoye'].includes(c.status)) throw new HttpError(400, 'Ce devis suit déjà son dossier');
  // Le premier commercial qui fait avancer le panier en devient le conseiller
  await q('UPDATE carts SET status=?, assigned_to=COALESCE(assigned_to, ?) WHERE id=?', [status, req.user.id, c.id]);
  await q('INSERT INTO cart_events (cart_id, status, note, user_id) VALUES (?,?,?,?)', [c.id, status, note || null, req.user.id]);
  await markLeadHandled(c.prospect_id);
  if (status === 'devis_envoye' && c.prospect_id) {
    await q("UPDATE prospects SET label='qualifie' WHERE id=? AND label='prospect'", [c.prospect_id]);
  }
  if (c.user_id && status !== 'recue') {
    const msg = { contactee: 'Votre conseiller a pris en charge votre demande', devis_envoye: 'Votre devis est prêt : votre conseiller vous l’a envoyé', annulee: 'Votre demande a été clôturée' }[status];
    await notify(c.user_id, `${msg} (${c.code}).`, '/espace-client/demandes');
  }
  res.json({ ok: true });
}));

// « Client signé » depuis le devis : formule et documents exigés, dossier créé, le devis suit ensuite le dossier
crm.post('/carts/:id/sign', wrap(async (req, res) => {
  const c = await one('SELECT * FROM carts WHERE id=?', [req.params.id]);
  if (!c) throw new HttpError(404, 'Panier introuvable');
  if (!['recue', 'contactee', 'devis_envoye'].includes(c.status)) throw new HttpError(400, 'Ce devis est déjà signé ou clôturé');
  if (!c.prospect_id) throw new HttpError(400, 'Ce devis n’est rattaché à aucune fiche client');
  const b = req.body || {};
  const dossierId = await signClient(c.prospect_id, req.user.id, { documents_url: b.documents_url, offer_id: b.offer_id, service_type: b.service_type, custom: b.custom, engagement_months: b.engagement_months, cartId: c.id });
  await q("INSERT INTO reports (user_id, prospect_id, channel, reason, notes, documents_url) VALUES (?,?, 'appel', 'signe', ?, ?)",
    [req.user.id, c.prospect_id, `Devis ${c.code} signé`, b.documents_url]);
  res.json({ ok: true, dossier_id: dossierId });
}));

crm.post('/carts/:id/assign', allow('admin', 'responsable_commercial'), wrap(async (req, res) => {
  const u = await one(`SELECT id FROM users WHERE id=? AND active=1 AND (role IN ('commercial_sedentaire','commercial_terrain','responsable_commercial','admin') OR extra_roles REGEXP 'commercial')`, [req.body.user_id]);
  if (!u) throw new HttpError(400, 'Commercial invalide');
  const c = await one('SELECT code FROM carts WHERE id=?', [req.params.id]);
  await q('UPDATE carts SET assigned_to=? WHERE id=?', [u.id, req.params.id]);
  await notify(u.id, `Panier ${c.code} vous est attribué : appelez le client sous 24 h.`, '/dashboard/paniers');
  res.json({ ok: true });
}));

module.exports = { pub, crm, STATUS };
