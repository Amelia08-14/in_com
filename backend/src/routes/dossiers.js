// Dossiers clients : Signé → Paiement confirmé → Création en cours → En attente de validation
//   → (Modification demandée ↺) → Livré (développement) / Publié (photo, vidéo, infographie)
const router = require('express').Router();
const { q, one } = require('../db');
const { allow } = require('../auth');
const { notify, notifyRole, wrap, HttpError } = require('../util');

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
    `SELECT d.*, p.name AS client_name, o.name AS offer, s.name AS signed_by_name, c.name AS cc_name
     FROM dossiers d JOIN prospects p ON p.id=d.prospect_id LEFT JOIN offers o ON o.id=d.offer_id
     LEFT JOIN users s ON s.id=d.signed_by LEFT JOIN users c ON c.id=d.cc_id
     WHERE ${where.join(' AND ')} ORDER BY d.updated_at DESC`, params));
}));

router.get('/:id', wrap(async (req, res) => {
  const d = await getDossier(req.params.id);
  if (req.user.role === 'client' && d.client_user_id !== req.user.id) throw new HttpError(403, 'Accès refusé');
  const history = await q('SELECT h.*, u.name AS user_name FROM dossier_history h LEFT JOIN users u ON u.id=h.user_id WHERE dossier_id=? ORDER BY h.created_at DESC', [d.id]);
  const team = await q('SELECT ca.role, u.id, u.name FROM client_assignments ca JOIN users u ON u.id=ca.user_id WHERE ca.prospect_id=?', [d.prospect_id]);
  res.json({ ...d, history, team });
}));

// Responsable communication : vérifie le paiement
router.post('/:id/confirm-payment', allow('responsable_communication'), wrap(async (req, res) => {
  const d = await getDossier(req.params.id);
  if (d.status !== 'signe') throw new HttpError(400, 'Le dossier doit être au statut Signé');
  await q("UPDATE dossiers SET status='paiement_confirme', payment_confirmed_at=NOW(), amount=COALESCE(?, amount) WHERE id=?", [req.body.amount || null, d.id]);
  await log(d.id, req.user.id, 'paiement_confirme', req.body.note);
  if (d.signed_by) await notify(d.signed_by, `Paiement confirmé pour ${d.client_name}`, '/dashboard/dossiers');
  res.json({ ok: true });
}));

// Attribuer un CC + répartir les intervenants, puis lancer la production
router.post('/:id/assign', allow('responsable_communication'), wrap(async (req, res) => {
  const d = await getDossier(req.params.id);
  const { cc_id, team = [], service_type } = req.body; // team: [{user_id, role}]
  if (d.status === 'signe') throw new HttpError(400, 'Aucune production sans paiement confirmé');
  if (cc_id) {
    await q('UPDATE dossiers SET cc_id=? WHERE id=?', [cc_id, d.id]);
    await q('INSERT IGNORE INTO client_assignments (prospect_id, user_id, role, assigned_by) VALUES (?,?,?,?)', [d.prospect_id, cc_id, 'charge_clientele', req.user.id]);
    await notify(cc_id, `Nouveau client attribué : ${d.client_name} — premier contact sous 24h`, '/dashboard/dossiers');
  }
  for (const m of team) {
    await q('INSERT IGNORE INTO client_assignments (prospect_id, user_id, role, assigned_by) VALUES (?,?,?,?)', [d.prospect_id, m.user_id, m.role, req.user.id]);
    await notify(m.user_id, `Vous intervenez sur ${d.client_name}`, '/dashboard/taches');
  }
  if (service_type) await q('UPDATE dossiers SET service_type=? WHERE id=?', [service_type, d.id]);
  if (d.status === 'paiement_confirme') {
    await q("UPDATE dossiers SET status='creation_en_cours' WHERE id=?", [d.id]);
    await log(d.id, req.user.id, 'creation_en_cours', 'Tâches réparties');
  }
  res.json({ ok: true });
}));

// CC : présente le travail au client
router.post('/:id/submit', allow('charge_clientele', 'responsable_communication'), wrap(async (req, res) => {
  const d = await getDossier(req.params.id);
  if (!['creation_en_cours', 'modification_demandee'].includes(d.status)) throw new HttpError(400, 'Rien à présenter');
  await q("UPDATE dossiers SET status='en_attente_validation', validated_at=NULL, next_followup=DATE_ADD(CURDATE(), INTERVAL 2 DAY) WHERE id=?", [d.id]);
  await log(d.id, req.user.id, 'en_attente_validation', req.body.note);
  if (d.client_user_id) await notify(d.client_user_id, `Un livrable vous attend pour validation : ${d.title}`, '/dashboard/projets');
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
    await notifyRole('responsable_communication', `Validation client : ${d.title}`, '/dashboard/dossiers');
  } else throw new HttpError(400, 'Décision invalide');
  res.json({ ok: true });
}));

// CM : publication
router.post('/:id/publish', allow('community_manager', 'responsable_communication'), wrap(async (req, res) => {
  const d = await getDossier(req.params.id);
  if (!d.validated_at) throw new HttpError(400, 'Le contenu doit être validé par le client');
  await q("UPDATE dossiers SET status='publie' WHERE id=?", [d.id]);
  await log(d.id, req.user.id, 'publie', req.body.note);
  if (d.client_user_id) await notify(d.client_user_id, `Publié : ${d.title}`, '/dashboard/projets');
  res.json({ ok: true });
}));

module.exports = router;
