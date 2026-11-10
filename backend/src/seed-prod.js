// Initialisation de la base de PRODUCTION : aucune donnée fictive.
// Crée le catalogue (formules, services, secteurs) et un seul compte Direction.
// Usage (une seule fois, sur le serveur) :
//   ADMIN_NAME="Prénom Nom" ADMIN_EMAIL="direction@domaine.dz" ADMIN_PASSWORD="mot-de-passe-fort" node src/seed-prod.js
// Les autres comptes se créent ensuite depuis le CRM (menu Utilisateurs).
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, q, one } = require('./db');
const { SECTORS, OFFERS, SERVICES } = require('./catalog');

(async () => {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('ADMIN_NAME, ADMIN_EMAIL et ADMIN_PASSWORD sont obligatoires');
  if (ADMIN_PASSWORD.length < 12) throw new Error('Mot de passe trop court : 12 caractères minimum');

  const users = await one('SELECT COUNT(*) AS n FROM users');
  if (users.n > 0) throw new Error(`La base contient déjà ${users.n} utilisateur(s) : initialisation annulée pour ne rien écraser`);

  if ((await one('SELECT COUNT(*) AS n FROM offers')).n === 0) {
    for (const o of OFFERS) await q('INSERT INTO offers (code, name, price_month, posts_month, stories_month, reels_month, features) VALUES (?,?,?,?,?,?,?)', o);
  }
  if ((await one('SELECT COUNT(*) AS n FROM services')).n === 0) {
    for (const [n, p] of SERVICES) await q('INSERT INTO services (name, price) VALUES (?,?)', [n, p]);
  }
  if ((await one('SELECT COUNT(*) AS n FROM sectors')).n === 0) {
    for (const s of SECTORS) await q('INSERT INTO sectors (name) VALUES (?)', [s]);
  }
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await q("INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?, 'admin')", [ADMIN_NAME, ADMIN_EMAIL.toLowerCase().trim(), hash]);

  console.log(`Base prête : ${OFFERS.length} formules, ${SERVICES.length} services, ${SECTORS.length} secteurs, compte Direction ${ADMIN_EMAIL}`);
  await pool.end();
})().catch(async (e) => { console.error('Erreur :', e.message); await pool.end(); process.exit(1); });
