// Auth · Utilisateurs · Notifications · Tableau de bord · Public (landing page)
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { q, one } = require('../db');
const { sign, auth, allow, rolesOf, ROLES } = require('../auth');
const { notifyRole, wrap, HttpError, limit, ymd } = require('../util');
const { ACTIVITIES } = require('../catalog');

// ───────── Public ─────────
router.get('/public/activities', (req, res) => res.json(ACTIVITIES));
// Formules affichées sur le site, dans l'ordre et avec les textes choisis par l'administrateur
router.get('/public/offers', wrap(async (req, res) => {
  const rows = await q('SELECT code, name, price_month, pitch, items, gift, featured FROM offers WHERE active=1 ORDER BY sort_order, price_month');
  res.json(rows.map((o) => ({ ...o, items: String(o.items || '').split('\n').map((l) => l.trim()).filter(Boolean), featured: !!o.featured })));
}));

router.post('/public/contact', wrap(async (req, res) => {
  const { name, company, phone, email, offer, message } = req.body;
  if (!name || (!phone && !email)) throw new HttpError(400, 'Nom et téléphone ou e-mail obligatoires');
  // Le formulaire du site alimente directement l'Univers (pipeline « site »)
  const p = await q("INSERT INTO prospects (name, contact_name, phone, email, source) VALUES (?,?,?,?, 'site')", [company || name, name, phone, email]);
  await q('INSERT INTO contact_requests (name, company, phone, email, offer, message, prospect_id) VALUES (?,?,?,?,?,?,?)',
    [name, company, phone, email, offer, message, p.insertId]);
  await notifyRole(['commercial_sedentaire', 'responsable_commercial', 'admin'], `Nouvelle demande via le site : ${company || name}`, '/dashboard/univers');
  res.json({ ok: true });
}));

// Inscription d'un client depuis le site (particulier ou entreprise).
// Le compte est obligatoire pour envoyer un panier ou une demande de devis.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
router.post('/auth/register', limit(10, 60 * 60 * 1000), wrap(async (req, res) => {
  const b = req.body || {};
  const type = b.account_type === 'entreprise' ? 'entreprise' : 'particulier';
  const name = String(b.name || '').trim().slice(0, 120);
  const company = type === 'entreprise' ? String(b.company || '').trim().slice(0, 160) : '';
  const email = String(b.email || '').toLowerCase().trim();
  const phone = String(b.phone || '').trim().slice(0, 40);
  const password = String(b.password || '');
  const activity = type === 'entreprise' ? String(b.activity || '').trim() : 'Particulier';
  if (name.length < 2) throw new HttpError(400, 'Indiquez votre nom et prénom');
  if (type === 'entreprise' && company.length < 2) throw new HttpError(400, 'Indiquez le nom de votre entreprise');
  if (!ACTIVITIES.includes(activity)) throw new HttpError(400, 'Choisissez votre secteur d’activité');
  if (!EMAIL_RE.test(email) || email.length > 160) throw new HttpError(400, 'Adresse e-mail invalide');
  if (phone.replace(/\D/g, '').length < 9) throw new HttpError(400, 'Numéro de téléphone invalide');
  if (password.length < 8) throw new HttpError(400, 'Mot de passe trop court : 8 caractères minimum');
  if (await one('SELECT id FROM users WHERE email=?', [email])) throw new HttpError(409, 'Un compte existe déjà avec cet e-mail. Connectez-vous.');

  let r;
  try {
    r = await q("INSERT INTO users (name, email, password_hash, role, account_type, company, activity, phone) VALUES (?,?,?, 'client', ?,?,?,?)",
      [name, email, await bcrypt.hash(password, 10), type, company || null, activity, phone]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Un compte existe déjà avec cet e-mail. Connectez-vous.');
    throw e;
  }
  // Fiche dans l'Univers, rattachée au compte : les commerciaux voient ce nouveau contact
  await q("INSERT INTO prospects (name, contact_name, specialty, phone, email, source, client_user_id) VALUES (?,?,?,?,?, 'site', ?)",
    [company || name, name, activity, phone, email, r.insertId]);
  await notifyRole(['commercial_sedentaire', 'responsable_commercial', 'admin'], `Nouveau compte ${type} sur le site : ${company || name}`, '/dashboard/univers');
  const user = { id: r.insertId, name, role: 'client', email };
  res.json({ token: sign(user), user });
}));

// Connexion : seuls les échecs sont comptés, par adresse IP et par e-mail. Toute une équipe derrière
// la même connexion internet du bureau peut donc se connecter sans se bloquer mutuellement.
const failures = new Map();
const LOGIN_WINDOW = 15 * 60 * 1000;
router.post('/auth/login', wrap(async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const key = `${req.ip}|${email}`;
  const now = Date.now();
  const recent = (failures.get(key) || []).filter((t) => now - t < LOGIN_WINDOW);
  if (recent.length >= 8) throw new HttpError(429, 'Trop d’essais avec cet e-mail. Réessayez dans 15 minutes ou demandez à la direction de réinitialiser le mot de passe.');
  const u = await one('SELECT * FROM users WHERE email=?', [email]);
  if (!u || !(await bcrypt.compare(String(req.body?.password || ''), u.password_hash))) {
    failures.set(key, [...recent, now]);
    if (failures.size > 10000) failures.clear();
    throw new HttpError(401, 'E-mail ou mot de passe incorrect');
  }
  if (!u.active) throw new HttpError(403, 'Ce compte est désactivé. Contactez la direction.');
  failures.delete(key);
  res.json({ token: sign(u), user: { id: u.id, name: u.name, role: u.role, email: u.email, roles: rolesOf(u) } });
}));

// ───────── Authentifié ─────────
router.use(auth);

router.get('/auth/me', wrap(async (req, res) => {
  const u = await one('SELECT id, name, email, role, extra_roles, phone, account_type, company, active FROM users WHERE id=?', [req.user.id]);
  if (!u || !u.active) throw new HttpError(401, 'Compte désactivé');
  const roles = rolesOf(u);
  // Rôle actif : celui du jeton s'il est toujours attribué, sinon le rôle principal
  const role = roles.includes(req.user.role) ? req.user.role : u.role;
  res.json({ id: u.id, name: u.name, email: u.email, phone: u.phone, account_type: u.account_type, company: u.company, role, roles, primary_role: u.role, role_label: ROLES[role] });
}));

// Passer d'un rôle à un autre (personne avec plusieurs rôles) : nouveau jeton avec ce rôle actif
router.post('/auth/switch-role', wrap(async (req, res) => {
  const u = await one('SELECT * FROM users WHERE id=? AND active=1', [req.user.id]);
  if (!u) throw new HttpError(401, 'Compte désactivé');
  const role = String(req.body?.role || '');
  if (!rolesOf(u).includes(role)) throw new HttpError(403, 'Ce rôle ne vous est pas attribué');
  res.json({ token: sign(u, role), user: { id: u.id, name: u.name, role, email: u.email, roles: rolesOf(u) } });
}));

// ───────── Mon profil (espace client et équipe) ─────────
const PROFILE_COLS = 'id, name, email, role, phone, account_type, company, activity, city, address, website, social_url, nif, rc';
// Ce qui manque pour que le conseiller puisse préparer un devis (vide = profil complet)
function missingFields(u) {
  if (u.role !== 'client') return [];
  const m = [];
  if (!u.phone) m.push('téléphone');
  if (!u.city) m.push('ville');
  if (u.account_type === 'entreprise') {
    if (!u.company) m.push('nom de l’entreprise');
    if (!u.activity || u.activity === 'Particulier') m.push('secteur d’activité');
    if (!u.address) m.push('adresse');
  }
  return m;
}

router.get('/me/profile', wrap(async (req, res) => {
  const u = await one(`SELECT ${PROFILE_COLS} FROM users WHERE id=?`, [req.user.id]);
  // Dossier Drive de références partagé par l'équipe (espace client)
  const p = u.role === 'client' ? await one('SELECT drive_url FROM prospects WHERE client_user_id=? AND drive_url IS NOT NULL ORDER BY id LIMIT 1', [u.id]) : null;
  res.json({ ...u, drive_url: p?.drive_url || null, missing: missingFields(u), activities: ACTIVITIES });
}));

const clean = (v, max) => { const t = String(v ?? '').trim().slice(0, max); return t || null; };
const url = (v) => { const t = clean(v, 255); return t && !/^https?:\/\//i.test(t) ? `https://${t}` : t; };

router.patch('/me/profile', wrap(async (req, res) => {
  const b = req.body || {};
  const me = await one(`SELECT ${PROFILE_COLS} FROM users WHERE id=?`, [req.user.id]);
  const name = clean(b.name, 120);
  const phone = clean(b.phone, 40);
  if (!name || name.length < 2) throw new HttpError(400, 'Indiquez votre nom et prénom');
  if (phone && phone.replace(/\D/g, '').length < 9) throw new HttpError(400, 'Numéro de téléphone invalide');

  if (me.role !== 'client') {
    await q('UPDATE users SET name=?, phone=? WHERE id=?', [name, phone, me.id]);
    return res.json({ ok: true });
  }
  const type = b.account_type === 'particulier' ? 'particulier' : 'entreprise';
  const company = type === 'entreprise' ? clean(b.company, 160) : null;
  const activity = type === 'entreprise' ? clean(b.activity, 80) : 'Particulier';
  if (type === 'entreprise' && (!company || company.length < 2)) throw new HttpError(400, 'Indiquez le nom de votre entreprise');
  if (type === 'entreprise' && (!activity || !ACTIVITIES.includes(activity) || activity === 'Particulier')) throw new HttpError(400, 'Choisissez votre secteur d’activité');
  if (!phone) throw new HttpError(400, 'Le téléphone est obligatoire');
  const f = {
    account_type: type, company, activity, name, phone,
    city: clean(b.city, 80), address: clean(b.address, 255), website: url(b.website), social_url: url(b.social_url),
    nif: type === 'entreprise' ? clean(b.nif, 40) : null, rc: type === 'entreprise' ? clean(b.rc, 40) : null,
  };
  await q(`UPDATE users SET ${Object.keys(f).map((k) => `${k}=?`).join(', ')} WHERE id=?`, [...Object.values(f), me.id]);
  // La fiche Univers du client suit son profil : l'équipe voit toujours des informations à jour
  await q('UPDATE prospects SET name=?, contact_name=?, specialty=?, phone=?, address=? WHERE client_user_id=?',
    [company || name, name, activity, phone, [f.address, f.city].filter(Boolean).join(', ') || null, me.id]);
  const u = await one(`SELECT ${PROFILE_COLS} FROM users WHERE id=?`, [me.id]);
  res.json({ ...u, missing: missingFields(u) });
}));

// Préférences d'affichage (JSON libre, 4 Ko au plus), suivent l'utilisateur sur tous ses appareils
router.get('/me/preferences', wrap(async (req, res) => {
  const u = await one('SELECT preferences FROM users WHERE id=?', [req.user.id]);
  try { res.json(JSON.parse(u?.preferences || '{}')); } catch { res.json({}); }
}));

router.put('/me/preferences', wrap(async (req, res) => {
  const cur = await one('SELECT preferences FROM users WHERE id=?', [req.user.id]);
  let prefs = {};
  try { prefs = JSON.parse(cur?.preferences || '{}'); } catch { prefs = {}; }
  const next = JSON.stringify({ ...prefs, ...(req.body || {}) });
  if (next.length > 4000) throw new HttpError(400, 'Préférences trop volumineuses');
  await q('UPDATE users SET preferences=? WHERE id=?', [next, req.user.id]);
  res.json(JSON.parse(next));
}));

router.post('/me/password', limit(10, 15 * 60 * 1000), wrap(async (req, res) => {
  const { current, password } = req.body || {};
  const u = await one('SELECT id, password_hash FROM users WHERE id=?', [req.user.id]);
  if (!(await bcrypt.compare(String(current || ''), u.password_hash))) throw new HttpError(400, 'Mot de passe actuel incorrect');
  if (String(password || '').length < 8) throw new HttpError(400, 'Nouveau mot de passe trop court : 8 caractères minimum');
  if (password === current) throw new HttpError(400, 'Choisissez un mot de passe différent de l’actuel');
  await q('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(String(password), 10), u.id]);
  res.json({ ok: true });
}));

router.get('/roles', (req, res) => res.json(ROLES));

// Annuaire des collaborateurs : nom, rôle, e-mail et téléphone, visible par toute l'équipe
router.get('/team', wrap(async (req, res) => {
  if (req.user.role === 'client') throw new HttpError(403, 'Accès refusé');
  res.json(await q("SELECT id, name, email, phone, role FROM users WHERE role<>'client' AND active=1 ORDER BY name"));
}));

router.get('/users', wrap(async (req, res) => {
  if (req.user.role === 'client') throw new HttpError(403, 'Accès refusé');
  const { role } = req.query;
  const roles = role ? String(role).split(',') : null;
  // Une personne apparaît aussi pour ses rôles supplémentaires (ex. : graphiste et community manager)
  const rows = await q(
    `SELECT u.id, u.name, u.email, u.role, u.extra_roles, u.phone, u.daily_capacity, u.active,
       (SELECT GROUP_CONCAT(s.name SEPARATOR ', ') FROM user_sectors us JOIN sectors s ON s.id=us.sector_id WHERE us.user_id=u.id) AS sectors
     FROM users u WHERE ${roles ? `(u.role IN (?) OR ${roles.map(() => 'FIND_IN_SET(?, u.extra_roles)').join(' OR ')})` : "u.role<>'client'"} ORDER BY u.role, u.name`,
    roles ? [roles, ...roles] : []);
  // Avec un filtre de rôle, « role » vaut le rôle demandé que la personne occupe (listes d'attribution)
  if (roles) for (const r of rows) if (!roles.includes(r.role)) r.role = roles.find((x) => rolesOf(r).includes(x)) || r.role;
  res.json(rows);
}));

// Rôles supplémentaires valides : ni client, ni direction, ni le rôle principal lui-même
function cleanExtra(list, primary) {
  if (primary === 'client') return null;
  const arr = [].concat(list || []).map(String).filter((r) => ROLES[r] && !['client', 'admin', primary].includes(r));
  return [...new Set(arr)].join(',') || null;
}

router.post('/users', allow('admin'), wrap(async (req, res) => {
  const { name, email, password, role, phone, daily_capacity, prospect_id } = req.body;
  if (!name || !email || !password || !ROLES[role]) throw new HttpError(400, 'Champs obligatoires manquants');
  if (!EMAIL_RE.test(String(email).trim())) throw new HttpError(400, 'Adresse e-mail invalide');
  if (String(password).length < 8) throw new HttpError(400, 'Mot de passe initial : 8 caractères minimum');
  if (await one('SELECT id FROM users WHERE email=?', [email.toLowerCase().trim()])) throw new HttpError(409, 'Un compte existe déjà avec cet e-mail');
  const r = await q('INSERT INTO users (name, email, password_hash, role, extra_roles, phone, daily_capacity) VALUES (?,?,?,?,?,?,?)',
    [String(name).trim(), email.toLowerCase().trim(), await bcrypt.hash(String(password), 10), role, cleanExtra(req.body.extra_roles, role), phone || null, daily_capacity || 6]);
  if (role === 'client' && prospect_id) await q('UPDATE prospects SET client_user_id=? WHERE id=?', [r.insertId, prospect_id]);
  res.json({ id: r.insertId });
}));

router.patch('/users/:id', allow('admin'), wrap(async (req, res) => {
  const { name, role, phone, daily_capacity, active, password } = req.body;
  const email = req.body.email ? String(req.body.email).toLowerCase().trim() : null;
  if (role && !ROLES[role]) throw new HttpError(400, 'Rôle inconnu');
  if (email) {
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Adresse e-mail invalide');
    if (await one('SELECT id FROM users WHERE email=? AND id<>?', [email, req.params.id])) throw new HttpError(409, 'Cet e-mail est déjà utilisé');
  }
  if (Number(req.params.id) === req.user.id && (active === 0 || (role && role !== 'admin'))) throw new HttpError(400, 'Vous ne pouvez pas retirer vos propres droits');
  await q('UPDATE users SET name=COALESCE(?,name), email=COALESCE(?,email), role=COALESCE(?,role), phone=COALESCE(?,phone), daily_capacity=COALESCE(?,daily_capacity), active=COALESCE(?,active) WHERE id=?',
    [name ?? null, email, role ?? null, phone ?? null, daily_capacity ?? null, active ?? null, req.params.id]);
  if (req.body.extra_roles !== undefined) {
    const cur = await one('SELECT role FROM users WHERE id=?', [req.params.id]);
    await q('UPDATE users SET extra_roles=? WHERE id=?', [cleanExtra(req.body.extra_roles, cur.role), req.params.id]);
  }
  if (password) {
    if (String(password).length < 8) throw new HttpError(400, 'Mot de passe : 8 caractères minimum');
    await q('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(String(password), 10), req.params.id]);
    for (const k of failures.keys()) if (email && k.endsWith(`|${email}`)) failures.delete(k);
  }
  res.json({ ok: true });
}));

// Suppression d'un compte. S'il a déjà un historique (deals, dossiers, tâches…), il est désactivé à la place.
router.delete('/users/:id', allow('admin'), wrap(async (req, res) => {
  if (Number(req.params.id) === req.user.id) throw new HttpError(400, 'Vous ne pouvez pas supprimer votre propre compte');
  try {
    await q('DELETE FROM users WHERE id=?', [req.params.id]);
    res.json({ deleted: true });
  } catch (e) {
    if (e.code !== 'ER_ROW_IS_REFERENCED_2') throw e;
    await q('UPDATE users SET active=0 WHERE id=?', [req.params.id]);
    res.json({ deleted: false, deactivated: true });
  }
}));

// ───────── Site web : formules et services affichés (direction) ─────────
router.get('/site/offers', allow(), wrap(async (req, res) => res.json(await q('SELECT * FROM offers ORDER BY sort_order, price_month'))));

const offerFields = (b) => ({
  name: String(b.name || '').trim().slice(0, 80),
  price_month: Math.max(0, parseInt(b.price_month, 10) || 0),
  posts_month: Math.max(0, parseInt(b.posts_month, 10) || 0),
  stories_month: Math.max(0, parseInt(b.stories_month, 10) || 0),
  reels_month: Math.max(0, parseInt(b.reels_month, 10) || 0),
  pitch: String(b.pitch || '').trim().slice(0, 255) || null,
  items: String(b.items || '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n') || null,
  gift: String(b.gift || '').trim().slice(0, 255) || null,
  featured: b.featured ? 1 : 0,
  active: b.active === undefined ? 1 : (b.active ? 1 : 0),
  sort_order: parseInt(b.sort_order, 10) || 0,
});

router.post('/site/offers', allow(), wrap(async (req, res) => {
  const f = offerFields(req.body || {});
  if (!f.name || !f.price_month) throw new HttpError(400, 'Nom et prix mensuel obligatoires');
  const code = (String(req.body.code || f.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'offre').slice(0, 30);
  if (await one('SELECT id FROM offers WHERE code=?', [code])) throw new HttpError(409, 'Une formule porte déjà ce nom');
  const r = await q(`INSERT INTO offers (code, ${Object.keys(f).join(', ')}) VALUES (?, ${Object.keys(f).map(() => '?').join(', ')})`, [code, ...Object.values(f)]);
  res.json({ id: r.insertId });
}));

router.put('/site/offers/:id', allow(), wrap(async (req, res) => {
  const f = offerFields(req.body || {});
  if (!f.name || !f.price_month) throw new HttpError(400, 'Nom et prix mensuel obligatoires');
  await q(`UPDATE offers SET ${Object.keys(f).map((k) => `${k}=?`).join(', ')} WHERE id=?`, [...Object.values(f), req.params.id]);
  res.json({ ok: true });
}));

// Une formule déjà souscrite par des clients est masquée du site au lieu d'être supprimée
router.delete('/site/offers/:id', allow(), wrap(async (req, res) => {
  const used = await one('SELECT (SELECT COUNT(*) FROM prospects WHERE offer_id=?) + (SELECT COUNT(*) FROM dossiers WHERE offer_id=?) AS n', [req.params.id, req.params.id]);
  if (used.n > 0) {
    await q('UPDATE offers SET active=0 WHERE id=?', [req.params.id]);
    return res.json({ deleted: false, hidden: true });
  }
  await q('DELETE FROM offers WHERE id=?', [req.params.id]);
  res.json({ deleted: true });
}));

router.get('/site/services', allow(), wrap(async (req, res) => res.json(await q('SELECT * FROM services ORDER BY sort_order, name'))));

const serviceFields = (b) => ({
  name: String(b.name || '').trim().slice(0, 160),
  price: Math.max(0, parseInt(b.price, 10) || 0),
  unit: String(b.unit || 'unité').trim().slice(0, 40) || 'unité',
  active: b.active === undefined ? 1 : (b.active ? 1 : 0),
  sort_order: parseInt(b.sort_order, 10) || 0,
});

router.post('/site/services', allow(), wrap(async (req, res) => {
  const f = serviceFields(req.body || {});
  if (!f.name || !f.price) throw new HttpError(400, 'Nom et prix obligatoires');
  const r = await q(`INSERT INTO services (${Object.keys(f).join(', ')}) VALUES (${Object.keys(f).map(() => '?').join(', ')})`, Object.values(f));
  res.json({ id: r.insertId });
}));

router.put('/site/services/:id', allow(), wrap(async (req, res) => {
  const f = serviceFields(req.body || {});
  if (!f.name || !f.price) throw new HttpError(400, 'Nom et prix obligatoires');
  await q(`UPDATE services SET ${Object.keys(f).map((k) => `${k}=?`).join(', ')} WHERE id=?`, [...Object.values(f), req.params.id]);
  res.json({ ok: true });
}));

router.delete('/site/services/:id', allow(), wrap(async (req, res) => {
  try {
    await q('DELETE FROM services WHERE id=?', [req.params.id]);
    res.json({ deleted: true });
  } catch (e) {
    if (e.code !== 'ER_ROW_IS_REFERENCED_2') throw e;
    await q('UPDATE services SET active=0 WHERE id=?', [req.params.id]);
    res.json({ deleted: false, hidden: true });
  }
}));

router.get('/offers', wrap(async (req, res) => res.json(await q('SELECT * FROM offers ORDER BY sort_order, price_month'))));

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

  // Direction : vue d'ensemble de toute l'activité, sur une période (7, 30 ou 90 jours),
  // comparée à la période précédente, avec les séries quotidiennes pour les graphiques.
  if (u.role === 'admin') {
    const days = [7, 30, 90].includes(Number(req.query.period)) ? Number(req.query.period) : 30;
    const inP = (col) => `${col} >= CURDATE() - INTERVAL ${days - 1} DAY`;
    const inPrev = (col) => `${col} >= CURDATE() - INTERVAL ${2 * days - 1} DAY AND ${col} < CURDATE() - INTERVAL ${days - 1} DAY`;
    const both = async (table, col = 'created_at', extra = '1=1') => ({
      now: await count(`SELECT COUNT(*) n FROM ${table} WHERE ${extra} AND ${inP(col)}`),
      prev: await count(`SELECT COUNT(*) n FROM ${table} WHERE ${extra} AND ${inPrev(col)}`),
    });
    // Série quotidienne (zéros compris) sur la période
    const daily = async (table, col = 'created_at', extra = '1=1') => {
      const rows = await q(`SELECT DATE_FORMAT(${col}, '%Y-%m-%d') d, COUNT(*) n FROM ${table} WHERE ${extra} AND ${inP(col)} GROUP BY d`);
      const by = Object.fromEntries(rows.map((r) => [r.d, Number(r.n)]));
      const out = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = ymd(d);
        out.push(by[key] || 0);
      }
      return out;
    };
    const labels = [];
    for (let i = days - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); labels.push(ymd(d)); }

    const signed = await both('dossiers');
    const reports = await both('reports');
    const prospects = await both('prospects');
    const carts = await both('carts');
    const accounts = await both('users', 'created_at', "role='client'");
    const mrr = await count("SELECT COALESCE(SUM(o.price_month),0) n FROM prospects p JOIN offers o ON o.id=p.offer_id WHERE p.label='client'");
    const series = {
      labels,
      reports: await daily('reports'),
      prospects: await daily('prospects'),
      carts: await daily('carts'),
      signed: await daily('dossiers'),
    };
    const headline = [
      { key: 'signed', label: 'Dossiers signés', value: signed.now, prev: signed.prev, spark: series.signed, link: '/dashboard/dossiers' },
      { key: 'reports', label: 'Appels et visites', value: reports.now, prev: reports.prev, spark: series.reports, link: '/dashboard/reporting' },
      { key: 'prospects', label: 'Nouveaux prospects', value: prospects.now, prev: prospects.prev, spark: series.prospects, link: '/dashboard/univers' },
      { key: 'carts', label: 'Paniers et devis reçus', value: carts.now, prev: carts.prev, spark: series.carts, link: '/dashboard/paniers' },
    ];
    const todo = [
      { label: 'Deals à attribuer', n: await count("SELECT COUNT(*) n FROM deals WHERE status='a_attribuer'"), link: '/dashboard/deals?status=a_attribuer' },
      { label: 'Paniers et devis à traiter', n: await count("SELECT COUNT(*) n FROM carts WHERE status='recue'"), link: '/dashboard/paniers' },
      { label: 'Paiements en attente', n: await count("SELECT COUNT(*) n FROM dossiers WHERE payment_status='en_attente'"), link: '/dashboard/dossiers' },
      { label: 'Non payés', n: await count("SELECT COUNT(*) n FROM dossiers WHERE payment_status='non_paye'"), link: '/dashboard/dossiers', level: 'critical' },
      { label: 'Tâches en retard', n: await count("SELECT COUNT(*) n FROM tasks WHERE due_date<CURDATE() AND status IN ('a_faire','en_cours','modification_demandee')"), link: '/dashboard/taches' },
      { label: 'Tickets SAV ouverts', n: await count("SELECT COUNT(*) n FROM tickets WHERE status<>'resolu'"), link: '/dashboard/sav' },
    ];
    const pipe = await q('SELECT status, COUNT(*) n FROM dossiers GROUP BY status');
    const funnel = await q("SELECT label, COUNT(*) n FROM prospects GROUP BY label");
    const byOffer = await q(
      `SELECT o.name, o.price_month, COUNT(p.id) clients, COUNT(p.id) * o.price_month mrr
       FROM offers o LEFT JOIN prospects p ON p.offer_id=o.id AND p.label='client' GROUP BY o.id ORDER BY o.sort_order, o.price_month`);
    const leaderboard = await q(
      `SELECT u.id, u.name, u.role,
         (SELECT COUNT(*) FROM reports r WHERE r.user_id=u.id AND ${inP('r.created_at')}) activity,
         (SELECT COUNT(*) FROM dossiers d WHERE d.signed_by=u.id AND ${inP('d.created_at')}) signed,
         (SELECT COUNT(*) FROM deals d WHERE d.assigned_to=u.id AND d.status IN ('attribue','programme','a_relancer')) open_deals
       FROM users u WHERE u.active=1 AND u.role IN ('responsable_commercial','commercial_sedentaire','commercial_terrain')
       ORDER BY signed DESC, activity DESC`);
    const production = await q(
      `SELECT u.name, u.role,
         SUM(t.due_date=CURDATE() AND t.status IN ('a_faire','en_cours','modification_demandee')) today,
         SUM(t.due_date<CURDATE() AND t.status IN ('a_faire','en_cours','modification_demandee')) late,
         SUM(t.status IN ('validee','publiee') AND ${inP('t.updated_at')}) done
       FROM users u LEFT JOIN tasks t ON t.assigned_to=u.id
       WHERE u.active=1 AND u.role IN ('graphiste','community_manager','photographe','developpeur','media_buyer') GROUP BY u.id ORDER BY late DESC, today DESC`);
    const activity = await q(
      `(SELECT h.created_at AS at, 'dossier' AS kind, p.name AS subject, h.status AS detail, u.name AS who
          FROM dossier_history h JOIN dossiers d ON d.id=h.dossier_id JOIN prospects p ON p.id=d.prospect_id LEFT JOIN users u ON u.id=h.user_id)
       UNION ALL (SELECT c.created_at, 'panier', COALESCE(c.company, c.name), c.code, cb.name FROM carts c LEFT JOIN users cb ON cb.id=c.created_by)
       UNION ALL (SELECT r.created_at, 'reporting', p.name, r.reason, u.name FROM reports r JOIN prospects p ON p.id=r.prospect_id JOIN users u ON u.id=r.user_id)
       UNION ALL (SELECT created_at, 'compte', COALESCE(company, name), account_type, NULL FROM users WHERE role='client')
       UNION ALL (SELECT t.created_at, 'ticket', t.subject, t.department, NULL FROM tickets t)
       ORDER BY at DESC LIMIT 12`);
    return res.json({
      admin: true, days, headline, series, todo, pipeline: pipe, funnel, byOffer, leaderboard, production, activity,
      clients: { active: await count("SELECT COUNT(*) n FROM prospects WHERE label='client'"), mrr, accounts },
      firstTime: await firstTimeRate(),
    });
  }
  if (u.role === 'responsable_communication') {
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
