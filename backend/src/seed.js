// Données de démonstration — un compte par rôle (mot de passe commun : incom2026)
require('dotenv').config();
if (process.env.NODE_ENV === 'production') {
  console.error('seed.js efface toute la base et la remplit de données fictives : interdit en production. Utilisez src/seed-prod.js.');
  process.exit(1);
}
const bcrypt = require('bcryptjs');
const { pool, q } = require('./db');
const { ymd } = require('./util');

const PASSWORD = 'incom2026';

const USERS = [
  ['Abdelghani Drias', 'ceo@incom.dz', 'admin'],
  ['Yasmine Responsable Co', 'resp.commercial@incom.dz', 'responsable_commercial'],
  ['Sofiane Sédentaire', 'sedentaire@incom.dz', 'commercial_sedentaire'],
  ['Nadia Sédentaire', 'sedentaire2@incom.dz', 'commercial_sedentaire'],
  ['Karim Terrain', 'terrain@incom.dz', 'commercial_terrain'],
  ['Amine Terrain', 'terrain2@incom.dz', 'commercial_terrain'],
  ['Lina Resp. Communication', 'resp.com@incom.dz', 'responsable_communication'],
  ['Walid Resp. Technique', 'resp.tech@incom.dz', 'responsable_technique'],
  ['Sara Chargée de clientèle', 'cc@incom.dz', 'charge_clientele'],
  ['Mehdi Chargé de clientèle', 'cc2@incom.dz', 'charge_clientele'],
  ['Rania Graphiste', 'gd@incom.dz', 'graphiste'],
  ['Hichem Graphiste', 'gd2@incom.dz', 'graphiste'],
  ['Imene Community Manager', 'cm@incom.dz', 'community_manager'],
  ['Ryad Photographe', 'photo@incom.dz', 'photographe'],
  ['Selma Media Buyer', 'media@incom.dz', 'media_buyer'],
  ['Anis IN DEV', 'dev@incom.dz', 'developpeur'],
  ['Farid Recouvrement', 'recouvrement@incom.dz', 'recouvrement'],
  ['Clinique El Feth (client)', 'client@incom.dz', 'client'],
];

const { SECTORS, OFFERS, SERVICES } = require('./catalog');

const PROSPECTS = [
  ['Clinique El Feth', 'Clinique', 'Hydra', 'client', 'premium'],
  ['Pharmacie Ibn Sina', 'Pharmacie', 'Alger Centre', 'client', 'pro'],
  ['Immo Horizon', 'Promotion immobilière', 'Chéraga', 'client', 'premium'],
  ['Pâtisserie Les Délices', 'Restauration', 'Kouba', 'client', 'essentiel'],
  ['Auto-École Rihana', 'Formation', 'Bab Ezzouar', 'client', 'essentiel'],
  ['Cabinet Dentaire Smile', 'Santé', 'Dely Ibrahim', 'client', 'pro'],
  ['Salle de sport FitZone', 'Sport', 'Bab Ezzouar', 'qualifie', null],
  ['Restaurant Le Saf-Saf', 'Restauration', 'Alger Centre', 'promesse', null],
  ['Optique Vision+', 'Optique', 'Hydra', 'prospect', null],
  ['Boutique Lina Mode', 'Prêt-à-porter', 'Blida', 'prospect', null],
  ['École Privée El Nour', 'Éducation', 'Boumerdès', 'qualifie', null],
  ['Agence Voyage Sahara', 'Tourisme', 'Alger Centre', 'prospect', null],
  ['Garage Auto Pro', 'Automobile', 'Kouba', 'a_eviter', null],
  ['Laboratoire BioAnalyse', 'Santé', 'Chéraga', 'prospect', null],
  ['Café Le Central', 'Restauration', 'Blida', 'prospect', null],
  ['Bijouterie Dar Ezzine', 'Bijouterie', 'Hydra', 'qualifie', null],
  ['Centre Esthétique Belle', 'Beauté', 'Dely Ibrahim', 'prospect', null],
  ['Menuiserie Moderne', 'Artisanat', 'Boumerdès', 'prospect', null],
];

const daysAgo = (n, h = 10) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return d; };
const dt = (d) => `${ymd(d)} ${String(d.getHours()).padStart(2, '0')}:00:00`;

(async () => {
  await q('SET FOREIGN_KEY_CHECKS=0');
  for (const t of ['cart_events', 'cart_items', 'carts', 'notifications', 'contact_requests', 'orders', 'services', 'tickets', 'task_history', 'task_versions', 'tasks', 'client_assignments', 'dossier_history', 'dossiers', 'deal_history', 'deals', 'reports', 'prospects', 'offers', 'user_sectors', 'sectors', 'users']) {
    await q(`TRUNCATE TABLE ${t}`);
  }
  await q('SET FOREIGN_KEY_CHECKS=1');

  const hash = await bcrypt.hash(PASSWORD, 10);
  const U = {};
  for (const [name, email, role] of USERS) {
    const r = await q('INSERT INTO users (name, email, password_hash, role, daily_capacity) VALUES (?,?,?,?,?)', [name, email, hash, role, role === 'graphiste' ? 6 : 6]);
    U[email.split('@')[0]] = r.insertId;
  }
  const S = {};
  for (const s of SECTORS) S[s] = (await q('INSERT INTO sectors (name) VALUES (?)', [s])).insertId;
  await q('INSERT INTO user_sectors VALUES (?,?),(?,?),(?,?),(?,?),(?,?),(?,?)', [
    U.terrain, S['Alger Centre'], U.terrain, S['Hydra'], U.terrain, S['Kouba'],
    U.terrain2, S['Bab Ezzouar'], U.terrain2, S['Chéraga'], U.terrain2, S['Blida']]);
  const O = {};
  for (const o of OFFERS) O[o[0]] = (await q('INSERT INTO offers (code, name, price_month, posts_month, stories_month, reels_month, features) VALUES (?,?,?,?,?,?,?)', o)).insertId;
  for (const [n, p] of SERVICES) await q('INSERT INTO services (name, price) VALUES (?,?)', [n, p]);

  const P = {};
  let i = 0;
  for (const [name, spec, sector, label, offer] of PROSPECTS) {
    i++;
    const r = await q(
      `INSERT INTO prospects (name, contact_name, specialty, phone, address, maps_url, sector_id, source, label, offer_id, priority, documents_url, created_by, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name, 'M. / Mme Responsable', spec, `+213 5${String(50000000 + i * 1371).slice(0, 8)}`, `${sector}, Alger`, 'https://maps.google.com',
        S[sector], ['cold_mailing', 'ads', 'sedentaire', 'terrain'][i % 4], label, offer ? O[offer] : null, offer === 'premium' ? 1 : 2,
        label === 'client' ? 'https://drive.google.com/drive/folders/exemple' : null, i % 2 ? U.sedentaire : U.terrain, dt(daysAgo(40 - i))]);
    P[name] = r.insertId;
  }
  await q('UPDATE prospects SET client_user_id=? WHERE id=?', [U.client, P['Clinique El Feth']]);

  // Reporting (appels / visites)
  const reasons = ['prospect', 'relance_sedentaire', 'relance_terrain', 'relance_visite', 'promesse'];
  let k = 0;
  for (const [name] of PROSPECTS) {
    for (let j = 0; j < 3; j++) {
      k++;
      const terrain = k % 3 === 0;
      await q('INSERT INTO reports (user_id, prospect_id, channel, reason, notes, created_at) VALUES (?,?,?,?,?,?)',
        [terrain ? U.terrain : (k % 2 ? U.sedentaire : U.sedentaire2), P[name], terrain ? 'visite' : 'appel',
          reasons[k % reasons.length], 'Échange avec le gérant, intéressé par la présence digitale.', dt(daysAgo(k % 12, 9 + (k % 7)))]);
    }
  }
  // Rapports du jour pour le sédentaire
  for (const name of ['Optique Vision+', 'Agence Voyage Sahara', 'Café Le Central']) {
    await q("INSERT INTO reports (user_id, prospect_id, channel, reason, notes) VALUES (?,?, 'appel', 'relance_sedentaire', 'Rappel prévu')", [U.sedentaire, P[name]]);
  }

  // Deals
  const today = new Date();
  const at = (h, dd = 0) => { const d = new Date(today); d.setDate(d.getDate() + dd); d.setHours(h, 0, 0, 0); return dt(d); };
  await q("INSERT INTO deals (prospect_id, type, created_by, status, notes) VALUES (?, 'terrain', ?, 'a_attribuer', 'Souhaite un RDV sur place avec le directeur')", [P['École Privée El Nour'], U.sedentaire]);
  await q("INSERT INTO deals (prospect_id, type, created_by, status) VALUES (?, 'terrain', ?, 'a_attribuer')", [P['Laboratoire BioAnalyse'], U.sedentaire2]);
  await q("INSERT INTO deals (prospect_id, type, created_by, assigned_to, status, scheduled_at) VALUES (?, 'terrain', ?, ?, 'programme', ?)", [P['Restaurant Le Saf-Saf'], U.sedentaire, U.terrain, at(11)]);
  await q("INSERT INTO deals (prospect_id, type, created_by, assigned_to, status, scheduled_at) VALUES (?, 'terrain', ?, ?, 'programme', ?)", [P['Bijouterie Dar Ezzine'], U.sedentaire, U.terrain, at(15)]);
  await q("INSERT INTO deals (prospect_id, type, created_by, assigned_to, status) VALUES (?, 'terrain', ?, ?, 'attribue')", [P['Optique Vision+'], U.sedentaire2, U.terrain]);
  await q("INSERT INTO deals (prospect_id, type, created_by, assigned_to, status, kind, scheduled_at) VALUES (?, 'bureau', ?, ?, 'programme', 'passage_bureau', ?)", [P['Salle de sport FitZone'], U.sedentaire, U.sedentaire, at(10)]);
  await q("INSERT INTO deals (prospect_id, type, created_by, assigned_to, status, kind, scheduled_at) VALUES (?, 'bureau', ?, ?, 'programme', 'passage_bureau', ?)", [P['Centre Esthétique Belle'], U.sedentaire, U.sedentaire, at(14, 1)]);
  await q("INSERT INTO deals (prospect_id, type, created_by, assigned_to, status) VALUES (?, 'terrain', ?, ?, 'a_relancer')", [P['Boutique Lina Mode'], U.sedentaire, U.terrain2]);

  // Dossiers clients
  const dossiers = [
    ['Clinique El Feth', 'premium', 'creation_en_cours', U.terrain, U.cc],
    ['Pharmacie Ibn Sina', 'pro', 'en_attente_validation', U.sedentaire, U.cc],
    ['Immo Horizon', 'premium', 'creation_en_cours', U.terrain, U.cc2],
    ['Pâtisserie Les Délices', 'essentiel', 'modification_demandee', U.sedentaire, U.cc2],
    ['Auto-École Rihana', 'essentiel', 'signe', U.sedentaire2, null],
    ['Cabinet Dentaire Smile', 'pro', 'paiement_confirme', U.sedentaire, null],
  ];
  const D = {};
  for (const [name, offer, status, signer, cc] of dossiers) {
    const amount = OFFERS.find((o) => o[0] === offer)[2];
    const r = await q(
      `INSERT INTO dossiers (prospect_id, offer_id, title, signed_by, cc_id, status, amount, payment_mode, payment_confirmed_at, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [P[name], O[offer], `${name} — Formule ${offer[0].toUpperCase() + offer.slice(1)}`, signer, cc, status, amount,
        signer === U.terrain ? 'terrain' : 'bureau', status === 'signe' ? null : dt(daysAgo(10)), dt(daysAgo(15))]);
    D[name] = r.insertId;
    await q("INSERT INTO dossier_history (dossier_id, user_id, status, note, created_at) VALUES (?,?, 'signe', 'Signature commerciale', ?)", [r.insertId, signer, dt(daysAgo(15))]);
    if (status !== 'signe') await q("INSERT INTO dossier_history (dossier_id, user_id, status, created_at) VALUES (?,?, 'paiement_confirme', ?)", [r.insertId, U['resp.com'], dt(daysAgo(10))]);
    if (!['signe', 'paiement_confirme'].includes(status)) await q("INSERT INTO dossier_history (dossier_id, user_id, status, note, created_at) VALUES (?,?, 'creation_en_cours', 'Tâches réparties', ?)", [r.insertId, U['resp.com'], dt(daysAgo(9))]);
  }

  // Équipes par client
  const team = [
    ['Clinique El Feth', [[U.cc, 'charge_clientele'], [U.gd, 'graphiste'], [U.cm, 'community_manager'], [U.photo, 'photographe'], [U.media, 'media_buyer'], [U.dev, 'developpeur']]],
    ['Pharmacie Ibn Sina', [[U.cc, 'charge_clientele'], [U.gd, 'graphiste'], [U.cm, 'community_manager']]],
    ['Immo Horizon', [[U.cc2, 'charge_clientele'], [U.gd2, 'graphiste'], [U.cm, 'community_manager'], [U.photo, 'photographe']]],
    ['Pâtisserie Les Délices', [[U.cc2, 'charge_clientele'], [U.gd, 'graphiste'], [U.cm, 'community_manager']]],
  ];
  for (const [name, members] of team) {
    for (const [uid, role] of members) await q('INSERT INTO client_assignments (prospect_id, user_id, role, assigned_by) VALUES (?,?,?,?)', [P[name], uid, role, U['resp.com']]);
  }

  // Tâches GD (historique sur 10 jours + quelques tâches en retard / en validation)
  const statuses = ['validee', 'validee', 'publiee', 'validee', 'validation_client', 'validation_technique'];
  let t = 0;
  for (const [name, gd] of [['Clinique El Feth', U.gd], ['Pharmacie Ibn Sina', U.gd], ['Immo Horizon', U.gd2], ['Pâtisserie Les Délices', U.gd]]) {
    for (let d = 10; d >= 1; d--) {
      t++;
      const status = statuses[t % statuses.length];
      const modifs = t % 4 === 0 ? 1 : 0;
      const due = ymd(daysAgo(d));
      const r = await q(
        `INSERT INTO tasks (prospect_id, dossier_id, assigned_to, type, part, theme, brief, priority, due_date, status, modif_count, completed_at, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [P[name], D[name], gd, t % 3 === 0 ? 'story' : 'conception', 'creation', `${t % 3 === 0 ? 'Story' : 'Post'} — ${['Offre du mois', 'Témoignage client', 'Conseil pratique', 'Coulisses', 'Nouveauté'][t % 5]}`,
          'Respecter la charte du client, format 1080×1350, accroche courte.', 2, due, status, modifs, dt(daysAgo(d, 15)), dt(daysAgo(d, 9))]);
      await q("INSERT INTO task_versions (task_id, version, file_url, created_by, created_at) VALUES (?, 1, 'https://drive.google.com/file/exemple', ?, ?)", [r.insertId, gd, dt(daysAgo(d, 15))]);
      await q("INSERT INTO task_history (task_id, user_id, action, status, created_at) VALUES (?,?, 'creation', 'validation_technique', ?)", [r.insertId, gd, dt(daysAgo(d, 15))]);
      if (modifs) await q("INSERT INTO task_history (task_id, user_id, action, status, note, created_at) VALUES (?,?, 'modification', 'validation_technique', 'Couleurs corrigées', ?)", [r.insertId, gd, dt(daysAgo(d - 1 || 0, 11))]);
      if (status === 'publiee') await q("INSERT INTO task_history (task_id, user_id, action, status, created_at) VALUES (?,?, 'publication', 'publiee', ?)", [r.insertId, U.cm, dt(daysAgo(d - 1 || 0, 12))]);
    }
  }
  // Tâches ouvertes : modification + retards
  await q(`INSERT INTO tasks (prospect_id, dossier_id, assigned_to, type, part, theme, brief, priority, due_date, status, modif_count, last_note)
    VALUES (?,?,?, 'conception', 'modification', 'Post — Journée portes ouvertes', 'Annonce de la journée portes ouvertes.', 2, ?, 'modification_demandee', 1, 'Le client souhaite le logo plus grand et la date en orange.')`,
    [P['Pâtisserie Les Délices'], D['Pâtisserie Les Délices'], U.gd, ymd(daysAgo(1))]);
  for (let j = 0; j < 3; j++) {
    await q(`INSERT INTO tasks (prospect_id, dossier_id, assigned_to, type, part, theme, brief, priority, due_date, status)
      VALUES (?,?,?, 'conception', 'creation', ?, 'Mettre en avant le service phare.', 1, ?, 'a_faire')`,
      [P['Immo Horizon'], D['Immo Horizon'], U.gd2, `Post — Visite appartement F${3 + j}`, ymd(daysAgo(2 + j))]);
  }

  // SAV & commandes
  await q("INSERT INTO tickets (prospect_id, department, subject, message, assigned_to, created_by) VALUES (?, 'commercial', 'Question sur la facture du mois', 'Bonjour, pouvez-vous me renvoyer la facture ?', ?, ?)", [P['Clinique El Feth'], U.sedentaire, U.client]);
  await q("INSERT INTO tickets (prospect_id, department, subject, message, created_by) VALUES (?, 'communication', 'Changer le visuel de la bannière', 'Nous avons une nouvelle promotion.', ?)", [P['Pharmacie Ibn Sina'], U.cc]);
  await q("INSERT INTO orders (prospect_id, service_id, quantity, price, status) VALUES (?, 1, 2, 12000, 'en_attente')", [P['Clinique El Feth']]);
  await q("INSERT INTO orders (prospect_id, service_id, quantity, price, status, validated_by) VALUES (?, 7, 1, 5000, 'recouvrement', ?)", [P['Immo Horizon'], U.sedentaire]);

  await q("INSERT INTO contact_requests (name, company, phone, email, offer, message, prospect_id) VALUES ('Mme Benali', 'Centre Esthétique Belle', '+213 555 00 00 00', 'contact@belle.dz', 'pro', 'Intéressée par la formule Pro.', ?)", [P['Centre Esthétique Belle']]);

  await q("INSERT INTO notifications (user_id, message, link) VALUES (?, 'Bienvenue sur la plateforme IN COM', '/dashboard')", [U.ceo]);

  console.log(`Données de démo créées · ${USERS.length} comptes · mot de passe : ${PASSWORD}`);
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
