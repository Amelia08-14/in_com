// Dossiers clients : Signé → Paiement confirmé → Création en cours → En attente de validation
//   → (Modification demandée ↺) → Livré (développement) / Publié (photo, vidéo, infographie)
const router = require('express').Router();
const { q, one } = require('../db');
const { allow } = require('../auth');
const { notify, notifyRole, wrap, HttpError } = require('../util');
const { launchProduction, generateDailyTasks } = require('./tasks');

async function log(dossierId, userId, status, note = null) {
  await q('INSERT INTO dossier_history (dossier_id, user_id, status, note) VALUES (?,?,?,?)', [dossierId, userId, status, note]);
}

async function getDossier(id) {
  const d = await one('SELECT d.*, p.name AS client_name, p.client_user_id FROM dossiers d JOIN prospects p ON p.id=d.prospect_id WHERE d.id=?', [id]);
  if (!d) throw new HttpError(404, 'Dossier introuvable');
  return d;
}

router.get('/', wrap(async (req, res) => {
  const u = req.user;
  const where = ['1=1'];
  const params = [];
  if (u.role === 'charge_clientele') { where.push('d.cc_id=?'); params.push(u.id); }
  else if (['commercial_sedentaire', 'commercial_terrain'].includes(u.role)) { where.push('d.signed_by=?'); params.push(u.id); }
  else if (u.role === 'client') { where.push('p.client_user_id=?'); params.push(u.id); }
  else if (u.role === 'community_manager') { where.push("(d.validated_at IS NOT NULL OR d.status='publie') AND d.service_type<>'developpement'"); }
  else if (!['admin', 'responsable_communication', 'responsable_commercial', 'responsable_technique'].includes(u.role)) {
    where.push('EXISTS (SELECT 1 FROM client_assignments ca WHERE ca.prospect_id=d.prospect_id AND ca.user_id=?)'); params.push(u.id);
  }
  if (req.query.status) { where.push('d.status=?'); params.push(req.query.status); }
  res.json(await q(
    `SELECT d.*, p.name AS client_name, p.phone AS client_phone, o.name AS offer, s.name AS signed_by_name, c.name AS cc_name
     FROM dossiers d JOIN prospects p ON p.id=d.prospect_id LEFT JOIN offers o ON o.id=d.offer_id
     LEFT JOIN users s ON s.id=d.signed_by LEFT JOIN users c ON c.id=d.cc_id
     WHERE ${where.join(' AND ')} ORDER BY d.updated_at DESC`, params));
}));

const FULL_ACCESS = ['admin', 'responsable_communication', 'responsable_commercial', 'responsable_technique'];

router.get('/:id', wrap(async (req, res) => {
  const d = await getDossier(req.params.id);
  const u = req.user;
  if (u.role === 'client' && d.client_user_id !== u.id) throw new HttpError(403, 'Accès refusé');
  const team = await q('SELECT ca.role, u.id, u.name, u.email, u.phone FROM client_assignments ca JOIN users u ON u.id=ca.user_id WHERE ca.prospect_id=?', [d.prospect_id]);
  if (u.role !== 'client' && !FULL_ACCESS.includes(u.role) && d.signed_by !== u.id && d.cc_id !== u.id && !team.some((t) => t.id === u.id)) {
    throw new HttpError(403, 'Dossier non attribué');
  }
  const history = await q('SELECT h.*, u.name AS user_name FROM dossier_history h LEFT JOIN users u ON u.id=h.user_id WHERE dossier_id=? ORDER BY h.created_at DESC', [d.id]);
  const offer = d.offer_id ? await one('SELECT id, name, price_month, posts_month, stories_month, reels_month, custom_dossier_id FROM offers WHERE id=?', [d.offer_id]) : null;
  const items = await q('SELECT id, service_id, label, quantity, unit_price, total FROM dossier_items WHERE dossier_id=? ORDER BY id', [d.id]);
  // Coordonnées du client : l'équipe attribuée le contacte directement
  const client = u.role === 'client' ? null : await one(
    `SELECT p.name, p.contact_name, p.phone, p.email, p.address, p.maps_url, p.specialty, p.documents_url, p.drive_url,
       cu.email AS account_email, cu.phone AS account_phone, cu.company, cu.activity, cu.city, cu.website, cu.social_url, cu.nif, cu.rc
     FROM prospects p LEFT JOIN users cu ON cu.id=p.client_user_id WHERE p.id=?`, [d.prospect_id]);
  const tasks = u.role === 'client' ? [] : await q(
    `SELECT t.id, t.type, t.theme, t.brief, t.status, t.due_date, u.name AS assigned_name FROM tasks t JOIN users u ON u.id=t.assigned_to
     WHERE t.prospect_id=? ORDER BY t.due_date DESC, t.id DESC LIMIT 50`, [d.prospect_id]);
  res.json({ ...d, offer, items, history, team, client, tasks });
}));

// Correction d'un dossier (direction, responsable communication) : formule, montant, paiement,
// prestation et statut, y compris retour à une étape précédente. Chaque changement de statut est historisé.
const STATUSES = ['signe', 'paiement_confirme', 'creation_en_cours', 'en_attente_validation', 'modification_demandee', 'livre', 'publie'];
// Offre personnalisée : quotas mensuels sur mesure (posts, stories, reels, prix) et services choisis avec leur nombre.
// Elle est enregistrée comme une formule propre au dossier, jamais affichée sur le site.
const int = (v, max = 100000000) => Math.min(max, Math.max(0, parseInt(v, 10) || 0));
async function saveCustomOffer(d, c = {}) {
  const posts = int(c.posts_month, 999), stories = int(c.stories_month, 999), reels = int(c.reels_month, 999);
  const price = int(c.price_month);
  const items = [];
  for (const it of (Array.isArray(c.items) ? c.items : []).slice(0, 40)) {
    const qty = Math.max(1, int(it.quantity, 999));
    const sv = it.service_id ? await one('SELECT id, name, price FROM services WHERE id=?', [it.service_id]) : null;
    const label = String(sv?.name || it.label || '').trim().slice(0, 160);
    if (!label) continue;
    const unit = it.unit_price !== undefined && it.unit_price !== '' ? int(it.unit_price) : (sv?.price || 0);
    items.push({ service_id: sv?.id || null, label, quantity: qty, unit_price: unit, total: unit * qty });
  }
  if (!posts && !stories && !reels && !items.length) throw new HttpError(400, 'Offre personnalisée vide : indiquez des quotas mensuels ou des services');
  const features = [posts && `${posts} posts`, stories && `${stories} stories`, reels && `${reels} reels`, ...items.map((i) => `${i.quantity} × ${i.label}`)].filter(Boolean).join(' · ');
  const existing = await one('SELECT id FROM offers WHERE custom_dossier_id=?', [d.id]);
  let offerId = existing?.id;
  if (offerId) {
    await q('UPDATE offers SET price_month=?, posts_month=?, stories_month=?, reels_month=?, features=? WHERE id=?', [price, posts, stories, reels, features, offerId]);
  } else {
    const r = await q(
      `INSERT INTO offers (code, name, price_month, posts_month, stories_month, reels_month, features, active, sort_order, custom_dossier_id)
       VALUES (?, 'Offre personnalisée', ?, ?, ?, ?, ?, 0, 999, ?)`,
      [`perso-${d.id}-${Date.now().toString(36)}`.slice(0, 30), price, posts, stories, reels, features, d.id]);
    offerId = r.insertId;
  }
  await q('DELETE FROM dossier_items WHERE dossier_id=?', [d.id]);
  for (const i of items) {
    await q('INSERT INTO dossier_items (dossier_id, service_id, label, quantity, unit_price, total) VALUES (?,?,?,?,?,?)', [d.id, i.service_id, i.label, i.quantity, i.unit_price, i.total]);
  }
  return { offerId, price, once: items.reduce((sum, i) => sum + i.total, 0) };
}

router.patch('/:id', allow('responsable_communication'), wrap(async (req, res) => {
  const d = await getDossier(req.params.id);
  const b = req.body || {};
  const f = {};
  let custom = null;
  if (b.offer_id !== undefined) {
    // La formule est obligatoire : une formule du catalogue ou une offre personnalisée
    if (!b.offer_id) throw new HttpError(400, 'Choisissez la formule : une formule du site ou une offre personnalisée');
    if (b.offer_id === 'custom') {
      custom = await saveCustomOffer(d, b.custom);
      f.offer_id = custom.offerId;
    } else {
      const o = await one('SELECT id FROM offers WHERE id=? AND (custom_dossier_id IS NULL OR custom_dossier_id=?)', [b.offer_id, d.id]);
      if (!o) throw new HttpError(400, 'Formule inconnue');
      f.offer_id = o.id;
    }
    // La formule du dossier devient celle de la fiche client : c'est elle qui fixe les quotas de production
    await q('UPDATE prospects SET offer_id=? WHERE id=?', [f.offer_id, d.prospect_id]);
    if (!custom) {
      // Retour à une formule du catalogue : l'offre personnalisée de ce dossier est supprimée
      await q('DELETE FROM dossier_items WHERE dossier_id=?', [d.id]);
      await q('DELETE FROM offers WHERE custom_dossier_id=? AND id<>?', [d.id, f.offer_id]);
    }
  }
  if (b.amount !== undefined) f.amount = Math.max(0, parseInt(b.amount, 10) || 0);
  if (custom && !f.amount) f.amount = custom.price;
  // Formule choisie sans montant : le montant mensuel de la formule est repris
  if (f.offer_id && !f.amount && !Number(d.amount)) f.amount = (await one('SELECT price_month FROM offers WHERE id=?', [f.offer_id])).price_month;
  // Pas de production sans formule : « payé » exige une formule choisie
  if (b.payment_status === 'paye' && d.payment_status !== 'paye' && !(f.offer_id || d.offer_id)) {
    throw new HttpError(400, 'Choisissez la formule du client (formule du site ou offre personnalisée) avant de le marquer payé');
  }
  if (b.payment_mode && ['bureau', 'terrain', 'virement'].includes(b.payment_mode)) f.payment_mode = b.payment_mode;
  if (b.payment_status && ['en_attente', 'paye', 'non_paye'].includes(b.payment_status)) {
    f.payment_status = b.payment_status;
    if (b.payment_status === 'paye' && !d.payment_confirmed_at) f.payment_confirmed_at = new Date();
  }
  if (b.service_type) f.service_type = b.service_type;
  if (b.title) f.title = String(b.title).slice(0, 200);
  if (b.status && b.status !== d.status) {
    if (!STATUSES.includes(b.status)) throw new HttpError(400, 'Statut invalide');
    f.status = b.status;
    // Revenir avant la validation client efface la validation déjà donnée
    if (STATUSES.indexOf(b.status) < STATUSES.indexOf('en_attente_validation')) f.validated_at = null;
  }
  const keys = Object.keys(f);
  if (!keys.length) throw new HttpError(400, 'Aucune modification');
  await q(`UPDATE dossiers SET ${keys.map((k) => `${k}=?`).join(', ')} WHERE id=?`, [...keys.map((k) => f[k]), d.id]);
  if (f.status) await log(d.id, req.user.id, f.status, b.note || `Statut corrigé (avant : ${d.status})`);
  let launch = null;
  if (f.payment_status && f.payment_status !== d.payment_status) {
    const label = { en_attente: 'en attente', paye: 'payé', non_paye: 'non payé' }[f.payment_status];
    await log(d.id, req.user.id, f.status || d.status, `Paiement : ${label}`);
    // Passé à « payé » avant la production : même lancement automatique que « Confirmer le paiement »
    const status = f.status || d.status;
    if (f.payment_status === 'paye' && ['signe', 'paiement_confirme'].includes(status)) {
      if (status === 'signe') {
        await q("UPDATE dossiers SET status='paiement_confirme' WHERE id=?", [d.id]);
        await log(d.id, req.user.id, 'paiement_confirme', 'Paiement reçu');
      }
      launch = await launchProduction(d.id, req.user.id);
    }
  }
  res.json({ ok: true, launch });
}));

// Dossier Drive partagé avec le client pour ses références : renseigné par l'équipe,
// il apparaît aussitôt dans l'espace client et dans les fiches de l'équipe.
router.put('/:id/drive', allow('responsable_communication', 'charge_clientele', 'responsable_technique', 'community_manager'), wrap(async (req, res) => {
  const d = await getDossier(req.params.id);
  let url = String(req.body?.drive_url || '').trim().slice(0, 500);
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  if (url && !/^https:\/\/[^\s]+\.[^\s]+/.test(url)) throw new HttpError(400, 'Lien invalide');
  const before = await one('SELECT drive_url FROM prospects WHERE id=?', [d.prospect_id]);
  await q('UPDATE prospects SET drive_url=? WHERE id=?', [url || null, d.prospect_id]);
  if (url && url !== before?.drive_url) {
    await log(d.id, req.user.id, d.status, 'Dossier Drive de références partagé avec le client');
    if (d.client_user_id) await notify(d.client_user_id, 'Votre dossier partagé est prêt : déposez-y vos logos, photos et références', '/espace-client/profil');
  }
  res.json({ ok: true, drive_url: url || null });
}));

router.delete('/:id', allow(), wrap(async (req, res) => {
  await q('DELETE FROM dossiers WHERE id=?', [req.params.id]);
  res.json({ ok: true });
}));

// Responsable communication : vérifie le paiement
router.post('/:id/confirm-payment', allow('responsable_communication'), wrap(async (req, res) => {
  const d = await getDossier(req.params.id);
  if (!d.offer_id) throw new HttpError(400, 'Choisissez d’abord la formule du client (formule du site ou offre personnalisée) dans « Modifier le dossier »');
  if (d.status !== 'signe') throw new HttpError(400, 'Le dossier doit être au statut Signé');
  await q("UPDATE dossiers SET status='paiement_confirme', payment_status='paye', payment_confirmed_at=NOW(), amount=COALESCE(?, amount) WHERE id=?", [req.body.amount || null, d.id]);
  await log(d.id, req.user.id, 'paiement_confirme', req.body.note);
  if (d.signed_by) await notify(d.signed_by, `Paiement confirmé pour ${d.client_name}`, '/dashboard/dossiers');
  // Dès le paiement : équipe attribuée selon la charge et tâches réparties selon la formule
  const launch = await launchProduction(d.id, req.user.id);
  res.json({ ok: true, launch });
}));

// Attribuer un CC + répartir les intervenants, puis lancer la production
// Équipe du client : pour chaque rôle envoyé, la personne choisie remplace la précédente
// (ses tâches en cours lui sont transférées) ; une valeur vide retire le rôle.
const TEAM_ROLES = ['charge_clientele', 'graphiste', 'community_manager', 'photographe', 'developpeur', 'media_buyer'];
router.post('/:id/assign', allow('responsable_communication'), wrap(async (req, res) => {
  const d = await getDossier(req.params.id);
  const { service_type } = req.body;
  if (d.status === 'signe') throw new HttpError(400, 'Aucune production sans paiement confirmé');
  // Format actuel : members = { role: user_id | '' } ; ancien format : cc_id + team [{ role, user_id }]
  const members = { ...(req.body.members || {}) };
  if (req.body.cc_id) members.charge_clientele = req.body.cc_id;
  for (const m of req.body.team || []) members[m.role] = m.user_id;

  for (const role of TEAM_ROLES.filter((r) => r in members)) {
    const target = members[role] ? Number(members[role]) : null;
    const current = await q('SELECT user_id FROM client_assignments WHERE prospect_id=? AND role=?', [d.prospect_id, role]);
    const old = current.map((c) => c.user_id).filter((id) => id !== target);
    if (target) {
      const u = await one('SELECT id FROM users WHERE id=? AND active=1', [target]);
      if (!u) throw new HttpError(400, 'Collaborateur invalide');
    }
    if (old.length) {
      await q('DELETE FROM client_assignments WHERE prospect_id=? AND role=? AND user_id IN (?)', [d.prospect_id, role, old]);
      if (target) {
        await q("UPDATE tasks SET assigned_to=? WHERE prospect_id=? AND assigned_to IN (?) AND status IN ('a_faire','en_cours','modification_demandee')",
          [target, d.prospect_id, old]);
      }
    }
    if (target && !current.some((c) => c.user_id === target)) {
      await q('INSERT IGNORE INTO client_assignments (prospect_id, user_id, role, assigned_by) VALUES (?,?,?,?)', [d.prospect_id, target, role, req.user.id]);
      await notify(target, role === 'charge_clientele'
        ? `Nouveau client attribué : ${d.client_name} — premier contact sous 24h`
        : `Vous intervenez sur ${d.client_name}`, role === 'charge_clientele' ? '/dashboard/dossiers' : '/dashboard/taches');
    }
    if (role === 'charge_clientele') await q('UPDATE dossiers SET cc_id=? WHERE id=?', [target, d.id]);
  }
  if (service_type) await q('UPDATE dossiers SET service_type=? WHERE id=?', [service_type, d.id]);
  if (d.status === 'paiement_confirme') {
    await q("UPDATE dossiers SET status='creation_en_cours' WHERE id=?", [d.id]);
    await log(d.id, req.user.id, 'creation_en_cours', 'Tâches réparties');
  }
  // Un graphiste ajouté ou changé reçoit tout de suite les tâches du jour
  const created = await generateDailyTasks(new Date(), d.prospect_id);
  res.json({ ok: true, created });
}));

// CC : présente le travail au client
router.post('/:id/submit', allow('charge_clientele', 'responsable_communication'), wrap(async (req, res) => {
  const d = await getDossier(req.params.id);
  if (!['creation_en_cours', 'modification_demandee'].includes(d.status)) throw new HttpError(400, 'Rien à présenter');
  await q("UPDATE dossiers SET status='en_attente_validation', validated_at=NULL, next_followup=DATE_ADD(CURDATE(), INTERVAL 2 DAY) WHERE id=?", [d.id]);
  await log(d.id, req.user.id, 'en_attente_validation', req.body.note);
  if (d.client_user_id) await notify(d.client_user_id, `Un livrable vous attend pour validation : ${d.title}`, '/espace-client/projets');
  res.json({ ok: true });
}));

// Client ou CC : décision
router.post('/:id/decision', allow('client', 'charge_clientele'), wrap(async (req, res) => {
  const d = await getDossier(req.params.id);
  if (req.user.role === 'client' && d.client_user_id !== req.user.id) throw new HttpError(403, 'Accès refusé');
  if (d.status !== 'en_attente_validation' || d.validated_at) throw new HttpError(400, "Le dossier n'est pas en attente de validation");
  const { decision, note } = req.body;
  if (decision === 'modifier') {
    if (!note) throw new HttpError(400, 'Note obligatoire pour une modification');
    await q("UPDATE dossiers SET status='modification_demandee' WHERE id=?", [d.id]);
    await log(d.id, req.user.id, 'modification_demandee', note);
    await notify(d.cc_id, `Modification demandée sur ${d.title}`, '/dashboard/dossiers');
  } else if (decision === 'valider') {
    if (d.service_type === 'developpement') {
      await q("UPDATE dossiers SET status='livre', validated_at=NOW() WHERE id=?", [d.id]);
      await log(d.id, req.user.id, 'livre', 'Validé et livré au client');
    } else {
      await q('UPDATE dossiers SET validated_at=NOW() WHERE id=?', [d.id]);
      await log(d.id, req.user.id, 'valide', 'Validé — transmis au CM pour publication');
      const cms = await q("SELECT user_id FROM client_assignments WHERE prospect_id=? AND role='community_manager'", [d.prospect_id]);
      if (cms.length) await notify(cms.map((c) => c.user_id), `Contenu validé à publier : ${d.title}`, '/dashboard/dossiers');
      else await notifyRole('community_manager', `Contenu validé à publier : ${d.title}`, '/dashboard/dossiers');
    }
    await notifyRole(['responsable_communication', 'admin'], `Validation client : ${d.title}`, '/dashboard/dossiers');
  } else throw new HttpError(400, 'Décision invalide');
  res.json({ ok: true });
}));

// CM : publication
router.post('/:id/publish', allow('community_manager', 'responsable_communication'), wrap(async (req, res) => {
  const d = await getDossier(req.params.id);
  if (!d.validated_at) throw new HttpError(400, 'Le contenu doit être validé par le client');
  await q("UPDATE dossiers SET status='publie' WHERE id=?", [d.id]);
  await log(d.id, req.user.id, 'publie', req.body.note);
  if (d.client_user_id) await notify(d.client_user_id, `Publié : ${d.title}`, '/espace-client/projets');
  res.json({ ok: true });
}));

module.exports = router;
