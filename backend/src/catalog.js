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

// Les 57 communes de la wilaya d'Alger : secteurs proposés aux commerciaux
const ALGER_COMMUNES = [
  'Alger Centre', "Sidi M'Hamed", 'El Madania', 'Belouizdad', 'Bab El Oued', 'Bologhine', 'Casbah', 'Oued Koriche',
  'Bir Mourad Raïs', 'El Biar', 'Bouzaréah', 'Birkhadem', 'El Harrach', 'Baraki', 'Oued Smar', 'Bachdjerrah',
  'Hussein Dey', 'Kouba', 'Bourouba', 'Dar El Beïda', 'Bab Ezzouar', 'Ben Aknoun', 'Dely Ibrahim', 'El Hammamet',
  'Raïs Hamidou', 'Djasr Kasentina', 'El Mouradia', 'Hydra', 'Mohammadia', 'Bordj El Kiffan', 'El Magharia', 'Béni Messous',
  'Les Eucalyptus', 'Birtouta', 'Tessala El Merdja', 'Ouled Chebel', 'Sidi Moussa', 'Aïn Taya', 'Bordj El Bahri', 'El Marsa',
  "H'raoua", 'Rouïba', 'Réghaïa', 'Aïn Benian', 'Staouéli', 'Zéralda', 'Mahelma', 'Rahmania',
  'Souidania', 'Chéraga', 'Ouled Fayet', 'El Achour', 'Draria', 'Douéra', 'Baba Hassen', 'Khraïcia', 'Saoula',
];

// Textes des formules affichés sur le site (modifiables ensuite par l'administrateur dans « Site web »)
const OFFER_SITE = {
  essentiel: { sort_order: 1, featured: 0, gift: null, pitch: 'Pour exister proprement sur les réseaux.',
    items: ['8 posts sur Facebook et Instagram', '15 stories', 'Calendrier éditorial', 'Rapport de performance'] },
  pro: { sort_order: 2, featured: 0, gift: 'Certification de votre fiche Google offerte', pitch: 'Pour animer, répondre et faire de la publicité.',
    items: ['12 posts sur Facebook et Instagram', '24 stories', '2 reels', 'Assistant IA 24h/24 sur 1 canal', '1 campagne publicitaire', 'Rapport mensuel détaillé'] },
  premium: { sort_order: 3, featured: 1, gift: 'Fiche Google certifiée et 1 mois offert', pitch: 'Pour déléguer toute votre image.',
    items: ['16 posts sur Facebook et Instagram', 'Stories quotidiennes', '4 à 6 reels', '1 shooting photo et vidéo par mois, chez vous', 'Site vitrine de 4 à 6 pages inclus', 'IA avancée sur Instagram, Facebook et WhatsApp', 'Publicités continues'] },
};

// Applique les textes du site aux formules qui n'en ont pas encore (installation neuve)
async function applyOfferSite(q) {
  for (const [code, o] of Object.entries(OFFER_SITE)) {
    await q('UPDATE offers SET pitch=?, items=?, gift=?, featured=?, sort_order=? WHERE code=? AND pitch IS NULL',
      [o.pitch, o.items.join('\n'), o.gift, o.featured, o.sort_order, code]);
  }
}

module.exports = { SECTORS, OFFERS, SERVICES, ACTIVITIES, ALGER_COMMUNES, OFFER_SITE, applyOfferSite };
