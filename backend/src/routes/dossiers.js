// Dossiers clients : Signé → En production → Livré.
// Le paiement confirmé lance la production ; la validation se fait conception par conception (tâches) ;
// le dossier passe tout seul en Livré quand le mois (abonnement) ou le projet est produit (voir flow.js).
const router = require('express').Router();
const { q, one } = require('../db');
const { allow } = require('../auth');
const { notify, wrap, HttpError } = require('../util');
const { launchProduction, generateDailyTasks } = require('./tasks');
const { saveCustomOffer, parseItems, saveItems, createServiceTask } = require('../flow');

async function log(dossierId, userId, status, note = null) {
  await q('INSERT INTO dossier_history (dossier_id, user_id, status, note) VALUES (?,?,?,?)', [dossierId, userId, status, note]);
}

async function getDossier(id) {
  const d = await one(
    `SELECT d.*, p.name AS client_name, p.client_user_id, s.name AS signed_by_name
     FROM dossiers d JOIN prospects p ON p.id=d.prospect_id LEFT JOIN users s ON s.id=d.signed_by WHERE d.id=?`, [id]);
  if (!d) throw new HttpError(404, 'Dossier introuvable');
  return d;
}

// Le recouvrement voit tous les dossiers : c'est lui qui encaisse et confirme les paiements
const FULL_ACCESS = ['admin', 'responsable_communication', 'responsable_commercial', 'responsable_technique', 'recouvrement'];
// Qui corrige un dossier (formule, paiement, étape) et qui enregistre les encaissements
const EDITORS = ['responsable_communication', 'responsable_commercial', 'responsable_technique'];
const CASHIERS = ['recouvrement', 'responsable_communication', 'responsable_commercial'];
// Montant du contrat : mensualité × engagement + services ponctuels ; encaissé : somme des encaissements
const MONEY = `
  (COALESCE(o.price_month, 0) * COALESCE(d.engagement_months, 1) + COALESCE((SELECT SUM(i.total) FROM dossier_items i WHERE i.dossier_id=d.id), 0)) AS contract_total,
  COALESCE((SELECT SUM(dp.amount) FROM dossier_payments dp WHERE dp.dossier_id=d.id), 0) AS paid_total`;
// MySQL renvoie les sommes en texte : on les remet en nombres
const money = (r) => r && Object.assign(r, { contract_total: Number(r.contract_total) || 0, paid_total: Number(r.paid_total) || 0 });

router.get('/', wrap(async (req, res) => {
  const u = req.user;
  const where = ['1=1'];
  const params = [];
  if (u.role === 'charge_clientele') { where.push('d.cc_id=?'); params.push(u.id); }
  else if (['commercial_sedentaire', 'commercial_terrain'].includes(u.role)) { where.push('d.signed_by=?'); params.push(u.id); }
  else if (u.role === 'client') { where.push('p.client_user_id=?'); params.push(u.id); }
  else if (!FULL_ACCESS.includes(u.role)) {
    where.push('EXISTS (SELECT 1 FROM client_assignments ca WHERE ca.prospect_id=d.prospect_id AND ca.user_id=?)'); params.push(u.id);
  }
  if (req.query.status) { where.push('d.status=?'); params.push(req.query.status); }
  res.json(await q(
    `SELECT d.*, p.name AS client_name, p.phone AS client_phone, o.name AS offer, s.name AS signed_by_name, c.name AS cc_name, ${MONEY}
     FROM dossiers d JOIN prospects p ON p.id=d.prospect_id LEFT JOIN offers o ON o.id=d.offer_id
     LEFT JOIN users s ON s.id=d.signed_by LEFT JOIN users c ON c.id=d.cc_id
     WHERE ${where.join(' AND ')} ORDER BY d.updated_at DESC`, params).then((rows) => rows.map(money)));
}));

router.get('/:id', wrap(async (req, res) => {
  const d = await getDossier(req.params.id);
  const u = req.user;
  if (u.role === 'client' && d.client_user_id !== u.id) throw new HttpError(403, 'Accès refusé');
  const team = await q('SELECT ca.role, u.id, u.name, u.email, u.phone FROM client_assignments ca JOIN users u ON u.id=ca.user_id WHERE ca.prospect_id=?', [d.prospect_id]);
  if (u.role !== 'client' && !FULL_ACCESS.includes(u.role) && d.signed_by !== u.id && d.cc_id !== u.id && !team.some((t) => t.id === u.id)) {
    throw new HttpError(403, 'Dossier non attribué');
  }
  const history = await q('SELECT h.*, u.name AS user_name FROM dossier_history h LEFT JOIN users u ON u.id=h.user_id WHERE dossier_id=? ORDER BY h.created_at DESC, h.id DESC', [d.id]);
  const offer = d.offer_id ? await one('SELECT id, name, price_month, posts_month, stories_month, reels_month, custom_dossier_id FROM offers WHERE id=?', [d.offer_id]) : null;
  const items = await q('SELECT id, service_id, label, quantity, unit_price, total FROM dossier_items WHERE dossier_id=? ORDER BY id', [d.id]);
  // Avancement du mois (abonnement) ou du projet : de quoi dire à chacun où en est la production
  const monthly = d.service_type === 'abonnement';
  const progress = await one(
    `SELECT COUNT(*) total, SUM(status IN ('validee','publiee')) done, SUM(status='publiee') published,
       SUM(status IN ('validation_technique','validation_client')) in_review, SUM(status IN ('a_faire','en_cours','modification_demandee')) todo
     FROM tasks WHERE prospect_id=? ${monthly ? "AND DATE_FORMAT(due_date,'%Y-%m')=DATE_FORMAT(CURDATE(),'%Y-%m')" : 'AND (dossier_id=? OR (dossier_id IS NULL AND created_at>=?))'}`,
    monthly ? [d.prospect_id] : [d.prospect_id, d.id, d.created_at]);
  const quota = offer ? (offer.posts_month || 0) + (offer.stories_month || 0) + (offer.reels_month || 0) : 0;
  // Coordonnées du client : l'équipe attribuée le contacte directement
  const client = u.role === 'client' ? null : await one(
    `SELECT p.name, p.contact_name, p.phone, p.email, p.address, p.maps_url, p.specialty, p.documents_url, p.drive_url,
       cu.email AS account_email, cu.phone AS account_phone, cu.company, cu.activity, cu.city, cu.website, cu.social_url, cu.nif, cu.rc
     FROM prospects p LEFT JOIN users cu ON cu.id=p.client_user_id WHERE p.id=?`, [d.prospect_id]);
  const tasks = u.role === 'client' ? [] : await q(
    `SELECT t.id, t.type, t.theme, t.brief, t.status, t.due_date, u.name AS assigned_name FROM tasks t JOIN users u ON u.id=t.assigned_to
     WHERE t.prospect_id=? ORDER BY t.due_date DESC, t.id DESC LIMIT 50`, [d.prospect_id]);
  const carts = u.role === 'client' ? [] : await q('SELECT id, code, status FROM carts WHERE dossier_id=?', [d.id]);
  const totals = money(await one(`SELECT ${MONEY} FROM dossiers d LEFT JOIN offers o ON o.id=d.offer_id WHERE d.id=?`, [d.id]));
  const payments = await q('SELECT dp.*, u.name AS user_name FROM dossier_payments dp LEFT JOIN users u ON u.id=dp.created_by WHERE dp.dossier_id=? ORDER BY dp.paid_at, dp.id', [d.id]);
  res.json({ ...d, ...totals, payments, offer, items, history, team, client, tasks, carts, progress: { ...progress, quota, monthly } });
}));

// Correction d'un dossier (direction, responsable communication) : formule, montant, paiement,
// prestation et statut, y compris retour à une étape précédente. Chaque changement de statut est historisé.
const STATUSES = ['signe', 'creation_en_cours', 'livre'];
router.patch('/:id', allow(...EDITORS), wrap(async (req, res) => {
  const d = await getDossier(req.params.id);
  const b = req.body || {};
  const f = {};
  let custom = null;
  let addedItems = [];
  if (b.offer_id !== undefined) {
    // La formule est obligatoire : un pack ou une formule sur mesure
    if (!b.offer_id) throw new HttpError(400, 'Choisissez la formule : un pack ou une formule sur mesure');
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
      // Pack choisi : la formule sur mesure de ce dossier est supprimée ; ses services deviennent ceux envoyés
      await q('DELETE FROM offers WHERE custom_dossier_id=? AND id<>?', [d.id, f.offer_id]);
      if (b.items !== undefined) addedItems = await saveItems(d.id, await parseItems(b.items));
    } else addedItems = custom.added;
  }
  if (b.amount !== undefined) f.amount = Math.max(0, parseInt(b.amount, 10) || 0);
  if (custom && !f.amount) f.amount = custom.price;
  // Formule choisie sans montant : le montant mensuel de la formule est repris
  if (f.offer_id && !f.amount && !Number(d.amount)) f.amount = (await one('SELECT price_month FROM offers WHERE id=?', [f.offer_id])).price_month;
  // Pas de production sans formule : « payé » exige une formule choisie
  if (b.payment_status === 'paye' && d.payment_status !== 'paye' && !(f.offer_id || d.offer_id)) {
    throw new HttpError(400, 'Choisissez la formule du client (pack ou formule sur mesure) avant de le marquer payé');
  }
  if (b.payment_mode && ['bureau', 'terrain', 'virement'].includes(b.payment_mode)) f.payment_mode = b.payment_mode;
  if (b.payment_status && ['en_attente', 'paye', 'non_paye'].includes(b.payment_status)) {
    f.payment_status = b.payment_status;
    if (b.payment_status === 'paye' && !d.payment_confirmed_at) f.payment_confirmed_at = new Date();
  }
  if (b.service_type) f.service_type = b.service_type;
  if (b.engagement_months !== undefined) f.engagement_months = [1, 3, 6, 12].includes(Number(b.engagement_months)) ? Number(b.engagement_months) : null;
  if (b.title) f.title = String(b.title).slice(0, 200);
  if (b.status && b.status !== d.status) {
    if (!STATUSES.includes(b.status)) throw new HttpError(400, 'Statut invalide');
    f.status = b.status;
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
      launch = await launchProduction(d.id, req.user.id);
    }
    // Paiement marqué par erreur : annulé, le dossier revient « à encaisser » et la production s'arrête
    if (d.payment_status === 'paye' && f.payment_status !== 'paye') await cancelPayment(d, req.user.id, f.status);
  }
  // Services ajoutés alors que la production a démarré : une tâche chacun, tout de suite
  if (['creation_en_cours', 'livre'].includes(f.status || d.status)) {
    for (const it of addedItems) await createServiceTask({ prospectId: d.prospect_id, dossierId: d.id, label: it.label, quantity: it.quantity, byUserId: req.user.id, origin: 'Service ajouté au dossier' });
  }
  // Formule choisie ou changée sur un dossier déjà en production : l'équipe manquante est attribuée
  // et les tâches du jour sont créées tout de suite (sans attendre le lendemain)
  if (!launch && f.offer_id && (f.status || d.status) === 'creation_en_cours') {
    launch = await launchProduction(d.id, req.user.id);
  }
  res.json({ ok: true, launch });
}));

// Dossier Drive partagé avec le client pour ses références : renseigné par la direction ou le responsable technique,
// il apparaît aussitôt dans l'espace client et dans les fiches de l'équipe.
router.put('/:id/drive', allow('responsable_technique'), wrap(async (req, res) => {
  const d = await getDossier(req.params.id);
  let url = String(req.body?.drive_url || '').trim().slice(0, 500);
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  if (url && !/^https:\/\/[^\s]+\.[^\s]+/.test(url)) throw new HttpError(400, 'Lien invalide');
  const before = await one('SELECT drive_url FROM prospects WHERE id=?', [d.prospect_id]);
  await q('UPDATE prospects SET drive_url=? WHERE id=?', [url || null, d.prospect_id]);
  if (url && url !== before?.drive_url) {
    await log(d.id, req.user.id, d.status, 'Dossier Drive de références partagé avec le client');
    if (d.client_user_id) await notify(d.client_user_id, 'Votre dossier partagé est prêt : déposez-y vos logos, photos et références.', '/espace-client/profil');
  }
  res.json({ ok: true, drive_url: url || null });
}));

// Annulation d'un paiement enregistré par erreur : encaissements supprimés, retour à « Signé · à encaisser »
// (sauf étape choisie dans la même correction), tâches générées pas encore commencées supprimées, devis remis à « paiement attendu ».
async function cancelPayment(d, userId, chosenStatus) {
  const removed = await one('SELECT COALESCE(SUM(amount),0) n FROM dossier_payments WHERE dossier_id=?', [d.id]);
  await q('DELETE FROM dossier_payments WHERE dossier_id=?', [d.id]);
  await q('UPDATE dossiers SET payment_confirmed_at=NULL, payment_plan=NULL WHERE id=?', [d.id]);
  if (!chosenStatus && d.status !== 'signe') {
    await q("UPDATE dossiers SET status='signe' WHERE id=?", [d.id]);
  }
  const t = await q("DELETE FROM tasks WHERE dossier_id=? AND status='a_faire' AND part='creation'", [d.id]);
  await q("UPDATE carts SET status='confirmee' WHERE dossier_id=? AND status IN ('en_production','livree')", [d.id]);
  await log(d.id, userId, chosenStatus || 'signe',
    `Paiement annulé (erreur) : ${Number(removed.n).toLocaleString('fr-FR')} DA retirés des encaissements, ${t.affectedRows} tâche(s) non commencée(s) supprimée(s)`);
}

// Encaissement suivant (mensualité, reste après acompte), ou suppression d'un encaissement saisi par erreur
router.post('/:id/payments', allow(...CASHIERS), wrap(async (req, res) => {
  const d = await getDossier(req.params.id);
  if (d.status === 'signe') throw new HttpError(400, 'Confirmez d’abord le premier paiement');
  const amount = Math.max(0, parseInt(req.body.amount, 10) || 0);
  if (!amount) throw new HttpError(400, 'Indiquez le montant encaissé');
  const mode = ['bureau', 'terrain', 'virement'].includes(req.body.mode) ? req.body.mode : d.payment_mode;
  await q('INSERT INTO dossier_payments (dossier_id, amount, mode, note, created_by) VALUES (?,?,?,?,?)',
    [d.id, amount, mode, String(req.body.note || '').slice(0, 255) || null, req.user.id]);
  await log(d.id, req.user.id, d.status, `Encaissement de ${amount.toLocaleString('fr-FR')} DA`);
  const m = money(await one(`SELECT ${MONEY} FROM dossiers d LEFT JOIN offers o ON o.id=d.offer_id WHERE d.id=?`, [d.id]));
  const rest = Math.max(0, m.contract_total - m.paid_total);
  if (d.signed_by) await notify(d.signed_by, `Encaissement de ${amount.toLocaleString('fr-FR')} DA pour ${d.client_name}${rest ? ` · reste ${rest.toLocaleString('fr-FR')} DA` : ' · contrat soldé'}.`, '/dashboard/dossiers');
  res.json({ ok: true, rest });
}));

router.delete('/:id/payments/:pid', allow(...CASHIERS), wrap(async (req, res) => {
  const p = await one('SELECT * FROM dossier_payments WHERE id=? AND dossier_id=?', [req.params.pid, req.params.id]);
  if (!p) throw new HttpError(404, 'Encaissement introuvable');
  await q('DELETE FROM dossier_payments WHERE id=?', [p.id]);
  const d = await getDossier(req.params.id);
  await log(d.id, req.user.id, d.status, `Encaissement de ${p.amount.toLocaleString('fr-FR')} DA supprimé (erreur de saisie)`);
  res.json({ ok: true });
}));

router.delete('/:id', allow(), wrap(async (req, res) => {
  await q('DELETE FROM dossiers WHERE id=?', [req.params.id]);
  res.json({ ok: true });
}));

// Paiement : un seul geste « Confirmer le paiement » (recouvrement, responsable communication, direction).
// La production démarre aussitôt : équipe attribuée selon la charge, tâches réparties selon la formule.
router.post('/:id/confirm-payment', allow(...CASHIERS), wrap(async (req, res) => {
  const d = await getDossier(req.params.id);
  if (!d.offer_id) throw new HttpError(400, 'Le responsable communication doit d’abord définir la formule du client (pack ou formule sur mesure)');
  if (d.status !== 'signe') throw new HttpError(400, 'Le paiement de ce dossier est déjà confirmé');
  // Plan de paiement : complet (tout le contrat), mensuel (une mensualité) ou acompte (montant libre, le reste plus tard)
  const plan = ['complet', 'mensuel', 'acompte'].includes(req.body.plan) ? req.body.plan : 'complet';
  const m = money(await one(`SELECT ${MONEY}, o.price_month FROM dossiers d LEFT JOIN offers o ON o.id=d.offer_id WHERE d.id=?`, [d.id]));
  const typed = req.body.amount !== undefined && req.body.amount !== '' ? Math.max(0, parseInt(req.body.amount, 10) || 0) : null;
  const amount = typed ?? (plan === 'mensuel' ? m.price_month : m.contract_total);
  if (!amount) throw new HttpError(400, 'Indiquez le montant encaissé');
  const mode = ['bureau', 'terrain', 'virement'].includes(req.body.payment_mode) ? req.body.payment_mode : null;
  await q("UPDATE dossiers SET payment_status='paye', payment_plan=?, payment_confirmed_at=NOW(), payment_mode=COALESCE(?, payment_mode) WHERE id=?", [plan, mode, d.id]);
  await q('INSERT INTO dossier_payments (dossier_id, amount, mode, note, created_by) VALUES (?,?,?,?,?)',
    [d.id, amount, mode || d.payment_mode, { complet: 'Paiement complet', mensuel: '1re mensualité', acompte: 'Acompte' }[plan], req.user.id]);
  const rest = Math.max(0, m.contract_total - amount);
  await log(d.id, req.user.id, 'paiement_confirme', `${{ complet: 'Paiement complet', mensuel: '1re mensualité', acompte: 'Acompte' }[plan]} : ${amount.toLocaleString('fr-FR')} DA${rest ? ` · reste ${rest.toLocaleString('fr-FR')} DA` : ''}`);
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
        ? `Nouveau client attribué : ${d.client_name}. Appelez-le sous 24 h pour vous présenter.`
        : `Vous intervenez sur ${d.client_name} : vos tâches arrivent dans Mes tâches.`, role === 'charge_clientele' ? '/dashboard/dossiers' : '/dashboard/taches');
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

module.exports = router;
