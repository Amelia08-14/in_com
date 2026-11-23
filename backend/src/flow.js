// Flux client partagé par toutes les routes :
// 1. Demande → un commercial responsable   2. Signature → dossier unique   3. Paiement → production
// 4. Production terminée → dossier livré   5. Extra payé → tâche de production
// Chaque étape prévient la personne qui doit agir ensuite, avec ce qu'elle doit faire.
const { q, one } = require('./db');
const { notify, notifyRole, ymd, HttpError } = require('./util');

const OPEN_TASKS = ['a_faire', 'en_cours', 'validation_technique', 'validation_client', 'modification_demandee'];
const SERVICE_TYPES = ['abonnement', 'graphisme', 'photo_video', 'developpement', 'media_buying', 'evenementiel'];
const fmt = (n) => `${Number(n || 0).toLocaleString('fr-FR')} DA`;

// ───────── 1. Demandes : toujours un commercial responsable ─────────
// Le commercial qui connaît déjà la fiche, sinon le sédentaire le moins chargé, sinon le responsable commercial.
async function pickCommercial(prospectId) {
  if (prospectId) {
    const known = await one(
      `SELECT u.id, u.name FROM reports r JOIN users u ON u.id=r.user_id AND u.active=1
       WHERE r.prospect_id=? AND u.role IN ('commercial_sedentaire','commercial_terrain','responsable_commercial')
       ORDER BY r.created_at DESC LIMIT 1`, [prospectId]);
    if (known) return known;
  }
  const free = await one(
    `SELECT u.id, u.name,
       (SELECT COUNT(*) FROM contact_requests r WHERE r.assigned_to=u.id AND r.handled_at IS NULL)
       + (SELECT COUNT(*) FROM carts c WHERE c.assigned_to=u.id AND c.status IN ('recue','contactee','devis_envoye')) AS charge
     FROM users u WHERE u.active=1 AND (u.role='commercial_sedentaire' OR FIND_IN_SET('commercial_sedentaire', u.extra_roles))
     ORDER BY charge, u.id LIMIT 1`);
  if (free) return free;
  return one("SELECT id, name FROM users WHERE active=1 AND (role='responsable_commercial' OR FIND_IN_SET('responsable_commercial', extra_roles)) ORDER BY id LIMIT 1");
}

// Toute nouvelle demande (formulaire, inscription, panier) : une ligne dans « Demandes » et un commercial responsable
async function newLead({ prospectId, name, company, phone, email, offer = null, message = null, origin, link = '/dashboard/demandes' }) {
  const who = await pickCommercial(prospectId);
  await q('INSERT INTO contact_requests (name, company, phone, email, offer, message, prospect_id, assigned_to) VALUES (?,?,?,?,?,?,?,?)',
    [name, company || null, phone || null, email || null, offer, message, prospectId || null, who?.id || null]);
  const label = company || name;
  if (who) {
    await notify(who.id, `À rappeler sous 24 h : ${label}${phone ? ` (${phone})` : ''} · ${origin}. Déclarez ensuite l’appel dans Reporting.`, link);
  } else {
    await notifyRole(['responsable_commercial', 'admin'], `${origin} : ${label}, aucun commercial disponible. Attribuez la demande.`, '/dashboard/demandes');
  }
  return who;
}

// Une demande est traitée dès qu'un appel ou une visite est déclaré sur la fiche
async function markLeadHandled(prospectId) {
  if (prospectId) await q('UPDATE contact_requests SET handled_at=NOW() WHERE prospect_id=? AND handled_at IS NULL', [prospectId]);
}

// Le panier (devis) suit son dossier : le client voit sur sa page de suivi l'étape réelle
async function cartStep(dossierId, status, note) {
  const carts = await q("SELECT id FROM carts WHERE dossier_id=? AND status NOT IN ('livree','annulee') AND status<>?", [dossierId, status]);
  for (const c of carts) {
    await q('UPDATE carts SET status=? WHERE id=?', [status, c.id]);
    await q('INSERT INTO cart_events (cart_id, status, note) VALUES (?,?,?)', [c.id, status, note]);
  }
}

async function logDossier(dossierId, userId, status, note = null) {
  await q('INSERT INTO dossier_history (dossier_id, user_id, status, note) VALUES (?,?,?,?)', [dossierId, userId, status, note]);
}

// Formule sur mesure : quotas mensuels sur mesure (posts, stories, reels, prix) et services choisis avec leur nombre.
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
  if (!posts && !stories && !reels && !items.length) throw new HttpError(400, 'Formule sur mesure vide : indiquez des quotas mensuels ou des services');
  const features = [posts && `${posts} posts`, stories && `${stories} stories`, reels && `${reels} reels`, ...items.map((i) => `${i.quantity} × ${i.label}`)].filter(Boolean).join(' · ');
  const existing = await one('SELECT id FROM offers WHERE custom_dossier_id=?', [d.id]);
  let offerId = existing?.id;
  if (offerId) {
    await q('UPDATE offers SET price_month=?, posts_month=?, stories_month=?, reels_month=?, features=? WHERE id=?', [price, posts, stories, reels, features, offerId]);
  } else {
    const r = await q(
      `INSERT INTO offers (code, name, price_month, posts_month, stories_month, reels_month, features, active, sort_order, custom_dossier_id)
       VALUES (?, 'Formule sur mesure', ?, ?, ?, ?, ?, 0, 999, ?)`,
      [`perso-${d.id}-${Date.now().toString(36)}`.slice(0, 30), price, posts, stories, reels, features, d.id]);
    offerId = r.insertId;
  }
  await q('DELETE FROM dossier_items WHERE dossier_id=?', [d.id]);
  for (const i of items) {
    await q('INSERT INTO dossier_items (dossier_id, service_id, label, quantity, unit_price, total) VALUES (?,?,?,?,?,?)', [d.id, i.service_id, i.label, i.quantity, i.unit_price, i.total]);
  }
  return { offerId, price, once: items.reduce((sum, i) => sum + i.total, 0) };
}

// Une formule sur mesure a-t-elle un contenu (quotas ou services) ?
const hasCustom = (c) => !!c && (int(c.posts_month) + int(c.stories_month) + int(c.reels_month) > 0 || (Array.isArray(c.items) && c.items.some((i) => i.service_id || String(i.label || '').trim())));

// ───────── 2. Signature : un seul geste, depuis le reporting, un deal ou un devis ─────────
// Exige la formule et les documents ; un dossier déjà signé et pas encore payé est réutilisé (pas de doublon).
async function signClient(prospectId, userId, { documents_url, offer_id, service_type, custom = null, cartId = null } = {}) {
  const docs = String(documents_url || '').trim();
  if (!docs) throw new HttpError(400, 'Documents obligatoires pour un client signé (lien Drive ou photos : contrat, registre de commerce, agrément)');
  if (!offer_id) throw new HttpError(400, 'Choisissez la formule signée : un pack ou une formule sur mesure');
  const p = await one('SELECT * FROM prospects WHERE id=?', [prospectId]);
  if (!p) throw new HttpError(404, 'Fiche introuvable');
  let offer = null;
  if (offer_id !== 'custom') {
    offer = await one('SELECT * FROM offers WHERE id=? AND custom_dossier_id IS NULL', [offer_id]);
    if (!offer) throw new HttpError(400, 'Formule inconnue');
  }
  // Prestation précisée à la signature ; sinon abonnement (et inchangée si le dossier existe déjà)
  const given = SERVICE_TYPES.includes(service_type) ? service_type : null;
  const type = given || 'abonnement';
  const signer = await one('SELECT name, role FROM users WHERE id=?', [userId]);
  const cart = cartId ? await one('SELECT * FROM carts WHERE id=?', [cartId]) : null;
  const services = cart ? await q("SELECT ref, label, quantity, unit_price, total FROM cart_items WHERE cart_id=? AND kind='service'", [cart.id]) : [];
  // Formule sur mesure définie dès la signature : quotas, services et prix choisis par le commercial
  const sur = !offer && hasCustom(custom);
  const once = sur ? 0 : services.reduce((s, i) => s + i.total, 0);
  const amount = (offer ? offer.price_month : 0) + once;

  await q("UPDATE prospects SET label='client', documents_url=?, offer_id=COALESCE(?, offer_id) WHERE id=?", [docs, offer?.id || null, prospectId]);
  const title = `${p.name} · ${offer ? `Formule ${offer.name}` : 'Formule sur mesure'}`;
  const existing = await one("SELECT id FROM dossiers WHERE prospect_id=? AND status='signe' ORDER BY id DESC LIMIT 1", [prospectId]);
  let dossierId;
  if (existing) {
    dossierId = existing.id;
    await q('UPDATE dossiers SET offer_id=COALESCE(?, offer_id), service_type=COALESCE(?, service_type), title=?, amount=GREATEST(amount, ?) WHERE id=?', [offer?.id || null, given, title, amount, dossierId]);
    await logDossier(dossierId, userId, 'signe', cart ? `Devis ${cart.code} confirmé` : 'Signature confirmée');
  } else {
    const r = await q(
      "INSERT INTO dossiers (prospect_id, offer_id, title, service_type, signed_by, status, amount, payment_mode) VALUES (?,?,?,?,?, 'signe', ?, ?)",
      [prospectId, offer?.id || null, title, type, userId, amount, signer?.role === 'commercial_terrain' ? 'terrain' : 'bureau']);
    dossierId = r.insertId;
    await logDossier(dossierId, userId, 'signe', cart ? `Signature commerciale · devis ${cart.code}` : 'Signature commerciale');
  }
  let customAmount = 0;
  if (sur) {
    // La formule sur mesure devient la formule du dossier (ses services sont enregistrés avec elle)
    const saved = await saveCustomOffer({ id: dossierId }, custom);
    customAmount = saved.price + saved.once;
    await q('UPDATE dossiers SET offer_id=?, amount=? WHERE id=?', [saved.offerId, customAmount, dossierId]);
    await q('UPDATE prospects SET offer_id=? WHERE id=?', [saved.offerId, prospectId]);
  }
  // Services ponctuels du devis (avec une formule du catalogue) : ils deviennent des tâches au paiement
  for (const s of sur ? [] : services) {
    await q('INSERT INTO dossier_items (dossier_id, service_id, label, quantity, unit_price, total) VALUES (?,?,?,?,?,?)',
      [dossierId, Number(s.ref) || null, s.label, s.quantity, s.unit_price, s.total]);
  }
  if (cart) {
    await q("UPDATE carts SET status='confirmee', dossier_id=?, assigned_to=COALESCE(assigned_to, ?) WHERE id=?", [dossierId, userId, cart.id]);
    await q("INSERT INTO cart_events (cart_id, status, note, user_id) VALUES (?, 'confirmee', 'Devis confirmé : votre dossier est ouvert, la production démarre dès réception du paiement', ?)", [cart.id, userId]);
  } else {
    // Un devis en cours pour ce client est confirmé par la même signature
    const open = await one("SELECT id, code FROM carts WHERE prospect_id=? AND status IN ('recue','contactee','devis_envoye') ORDER BY id DESC LIMIT 1", [prospectId]);
    if (open) {
      await q("UPDATE carts SET status='confirmee', dossier_id=? WHERE id=?", [dossierId, open.id]);
      await q("INSERT INTO cart_events (cart_id, status, note, user_id) VALUES (?, 'confirmee', 'Devis confirmé : la production démarre dès réception du paiement', ?)", [open.id, userId]);
    }
  }
  await markLeadHandled(prospectId);
  if (offer || sur) {
    await notifyRole(['recouvrement', 'responsable_communication'],
      `Encaisser : ${p.name}, ${offer ? `formule ${offer.name}` : 'formule sur mesure'}, ${fmt(sur ? customAmount : amount)}. Confirmez le paiement dans le dossier : la production démarre aussitôt.`, '/dashboard/dossiers');
  } else {
    await notifyRole('responsable_communication',
      `Signé : ${p.name}, formule sur mesure. Définissez-la dans le dossier (quotas, services, prix), puis le paiement pourra être confirmé.`, '/dashboard/dossiers');
  }
  return dossierId;
}

// ───────── 5. Tâche de production pour un service ponctuel (devis, formule sur mesure, extra) ─────────
// Le métier est déduit du nom du service ; le responsable technique peut réattribuer.
function serviceJob(label) {
  const s = String(label).toLowerCase();
  if (/shooting|photo/.test(s)) return { role: 'photographe', type: 'photo' };
  if (/vid[ée]o|tournage|montage/.test(s)) return { role: 'photographe', type: 'video' };
  if (/reel/.test(s)) return { role: 'graphiste', type: 'reel' };
  if (/site|page|web|boutique|application|automatisation|whatsapp|google/.test(s)) return { role: 'developpeur', type: 'dev' };
  return { role: 'graphiste', type: 'conception' };
}

async function createServiceTask({ prospectId, dossierId, label, quantity = 1, byUserId = null, origin = 'Service' }) {
  const job = serviceJob(label);
  const p = await one('SELECT name FROM prospects WHERE id=?', [prospectId]);
  let who = await one(
    `SELECT u.id, u.name FROM client_assignments ca JOIN users u ON u.id=ca.user_id AND u.active=1
     WHERE ca.prospect_id=? AND ca.role=? LIMIT 1`, [prospectId, job.role]);
  if (!who) {
    who = await one(
      `SELECT u.id, u.name FROM users u WHERE u.active=1 AND (u.role=? OR FIND_IN_SET(?, u.extra_roles))
       ORDER BY (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to=u.id AND t.status IN (?)), u.id LIMIT 1`, [job.role, job.role, OPEN_TASKS]);
    if (who) await q('INSERT IGNORE INTO client_assignments (prospect_id, user_id, role, assigned_by) VALUES (?,?,?,?)', [prospectId, who.id, job.role, byUserId]);
  }
  if (!who) {
    await notifyRole(['responsable_technique', 'admin'], `${origin} à produire pour ${p?.name} : ${label}. Aucun ${job.role} disponible, créez la tâche à la main.`, '/dashboard/taches');
    return null;
  }
  const theme = `${quantity > 1 ? `${quantity} × ` : ''}${label} · ${p?.name}`.slice(0, 200);
  const r = await q(
    `INSERT INTO tasks (prospect_id, dossier_id, assigned_to, type, theme, brief, priority, due_date) VALUES (?,?,?,?,?,?,1,?)`,
    [prospectId, dossierId || null, who.id, job.type, theme, `${origin} payé par le client. Réalisez-le puis déposez le lien : il part en validation.`, ymd()]);
  await q("INSERT INTO task_history (task_id, user_id, action, status, note) VALUES (?,?, 'creation_manuelle', 'a_faire', ?)", [r.insertId, byUserId, origin]);
  await notify(who.id, `Nouvelle tâche (${p?.name}) : ${theme}. Réalisez-la puis déposez le lien dans Mes tâches.`, '/dashboard/taches');
  return r.insertId;
}

// Un dossier livré qui reçoit du nouveau travail repasse en production
async function reopenDossier(dossierId, note) {
  const r = await q("UPDATE dossiers SET status='creation_en_cours' WHERE id=? AND status='livre'", [dossierId]);
  if (r.affectedRows) await logDossier(dossierId, null, 'creation_en_cours', note);
}

// ───────── 4. Livraison automatique ─────────
// Abonnement : livré quand les quotas du mois sont produits, validés par le client et publiés.
// Autres prestations : livré quand toutes les tâches du dossier sont validées (et publiées s'il y a un community manager).
async function checkDelivery(dossierId) {
  const d = await one(
    `SELECT d.*, p.name AS client_name, p.client_user_id, o.posts_month, o.stories_month, o.reels_month
     FROM dossiers d JOIN prospects p ON p.id=d.prospect_id LEFT JOIN offers o ON o.id=d.offer_id WHERE d.id=?`, [dossierId]);
  if (!d || d.status !== 'creation_en_cours') return false;
  const monthly = d.service_type === 'abonnement';
  const hasCm = await one("SELECT 1 AS x FROM client_assignments WHERE prospect_id=? AND role='community_manager'", [d.prospect_id]);
  const scope = monthly
    ? "AND DATE_FORMAT(t.due_date,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m')"
    : 'AND (t.dossier_id=? OR (t.dossier_id IS NULL AND t.created_at>=?))';
  const s = await one(
    `SELECT COUNT(*) total, SUM(t.status IN (?)) open, SUM(t.status='validee' AND t.type<>'dev') to_publish,
       SUM(t.type='conception') posts, SUM(t.type='story') stories, SUM(t.type='reel') reels
     FROM tasks t WHERE t.prospect_id=? ${scope}`,
    monthly ? [OPEN_TASKS, d.prospect_id] : [OPEN_TASKS, d.prospect_id, d.id, d.created_at]);
  if (!Number(s.total) || Number(s.open) > 0) return false;
  if (hasCm && Number(s.to_publish) > 0) return false;
  if (monthly && (Number(s.posts) < (d.posts_month || 0) || Number(s.stories) < (d.stories_month || 0) || Number(s.reels) < (d.reels_month || 0))) return false;

  const month = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  await q("UPDATE dossiers SET status='livre' WHERE id=?", [d.id]);
  await logDossier(d.id, null, 'livre', monthly ? `Production de ${month} terminée : ${s.total} contenus validés` : `Toutes les tâches sont validées (${s.total})`);
  await cartStep(d.id, 'livree', monthly ? `Production de ${month} livrée` : 'Prestation livrée');
  if (d.client_user_id) {
    await notify(d.client_user_id, monthly
      ? `Votre production de ${month} est livrée : ${s.total} contenus validés${hasCm ? ' et publiés' : ''}. Merci de votre confiance !`
      : `Votre projet est livré : ${d.title}. Une question ? Écrivez-nous depuis Support.`, '/espace-client/projets');
  }
  if (d.signed_by) {
    await notify(d.signed_by, monthly
      ? `Mois livré pour ${d.client_name} : appelez le client pour son avis et préparez le renouvellement de la formule.`
      : `Projet livré pour ${d.client_name} : appelez le client pour son avis et proposez-lui un extra ou un abonnement.`, '/dashboard/dossiers');
  }
  if (d.cc_id) await notify(d.cc_id, `${d.client_name} : ${monthly ? `production de ${month}` : 'projet'} livré, dossier passé en Livré.`, '/dashboard/dossiers');
  return true;
}

async function checkDeliveryForProspect(prospectId) {
  const rows = await q("SELECT id FROM dossiers WHERE prospect_id=? AND status='creation_en_cours'", [prospectId]);
  for (const r of rows) await checkDelivery(r.id);
}

module.exports = {
  OPEN_TASKS, SERVICE_TYPES, fmt, saveCustomOffer, hasCustom, pickCommercial, newLead, markLeadHandled, cartStep, logDossier,
  signClient, serviceJob, createServiceTask, reopenDossier, checkDelivery, checkDeliveryForProspect,
};
