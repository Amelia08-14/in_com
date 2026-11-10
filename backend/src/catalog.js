// Catalogue de référence (formules, services, secteurs) partagé par seed.js et seed-prod.js
const SECTORS = ['Alger Centre', 'Hydra', 'Bab Ezzouar', 'Chéraga', 'Dely Ibrahim', 'Kouba', 'Blida', 'Boumerdès'];

const OFFERS = [
  ['essentiel', 'Essentiel', 15000, 8, 15, 0, '8 posts Facebook & Instagram · 15 stories · Calendrier éditorial · Rapport de performance'],
  ['pro', 'Pro', 35000, 12, 24, 2, '12 posts · 24 stories · 2 reels · Assistant IA 24h/24 sur 1 canal · 1 campagne publicitaire · Rapport mensuel détaillé'],
  ['premium', 'Premium', 70000, 16, 22, 5, '16 posts · Stories quotidiennes · 4 à 6 reels · 1 shooting photo/vidéo par mois · Site vitrine 4 à 6 pages · IA avancée · Publicités continues'],
];

// Prix indicatifs à valider par la direction
const SERVICES = [
  ['Reel supplémentaire', 6000], ['Shooting supplémentaire', 25000], ['Page de site supplémentaire', 8000],
  ['Site avec réservation, blog ou boutique', 90000], ['Automatisation WhatsApp', 20000],
  ['Campagne spéciale : lancement, promo', 30000], ['Certification de la fiche Google', 5000],
];

// Secteurs d'activité proposés aux clients (profil de l'espace client)
const ACTIVITIES = [
  'Santé et clinique', 'Pharmacie et parapharmacie', 'Beauté et bien-être', 'Restauration et café', 'Hôtellerie et tourisme',
  'Commerce et boutique', 'Mode et textile', 'Agroalimentaire', 'Immobilier et promotion', 'BTP et construction',
  'Industrie', 'Automobile', 'Éducation et formation', 'Banque, finance et assurance', 'Technologie et télécoms',
  'Transport et logistique', 'Sport et loisirs', 'Événementiel et culture', 'Conseil et services aux entreprises',
  'Association et institution', 'Particulier', 'Autre',
];

module.exports = { SECTORS, OFFERS, SERVICES, ACTIVITIES };
