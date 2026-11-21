SET NAMES utf8mb4;
-- Retours après la première utilisation (novembre 2026) :
-- toutes les communes d'Alger, statut de paiement des dossiers, offres et services modifiables depuis le CRM,
-- demandes de devis créées par l'équipe commerciale.

-- 1. Les 57 communes de la wilaya d'Alger (les secteurs déjà présents sont conservés)
INSERT IGNORE INTO sectors (name) VALUES
  ('Alger Centre'), ('Sidi M''Hamed'), ('El Madania'), ('Belouizdad'), ('Bab El Oued'), ('Bologhine'), ('Casbah'), ('Oued Koriche'),
  ('Bir Mourad Raïs'), ('El Biar'), ('Bouzaréah'), ('Birkhadem'), ('El Harrach'), ('Baraki'), ('Oued Smar'), ('Bachdjerrah'),
  ('Hussein Dey'), ('Kouba'), ('Bourouba'), ('Dar El Beïda'), ('Bab Ezzouar'), ('Ben Aknoun'), ('Dely Ibrahim'), ('El Hammamet'),
  ('Raïs Hamidou'), ('Djasr Kasentina'), ('El Mouradia'), ('Hydra'), ('Mohammadia'), ('Bordj El Kiffan'), ('El Magharia'), ('Béni Messous'),
  ('Les Eucalyptus'), ('Birtouta'), ('Tessala El Merdja'), ('Ouled Chebel'), ('Sidi Moussa'), ('Aïn Taya'), ('Bordj El Bahri'), ('El Marsa'),
  ('H''raoua'), ('Rouïba'), ('Réghaïa'), ('Aïn Benian'), ('Staouéli'), ('Zéralda'), ('Mahelma'), ('Rahmania'),
  ('Souidania'), ('Chéraga'), ('Ouled Fayet'), ('El Achour'), ('Draria'), ('Douéra'), ('Baba Hassen'), ('Khraïcia'), ('Saoula');

-- 2. Paiement du dossier : en attente / payé / non payé, modifiable à tout moment
ALTER TABLE dossiers
  ADD COLUMN payment_status ENUM('en_attente','paye','non_paye') NOT NULL DEFAULT 'en_attente' AFTER payment_mode;
UPDATE dossiers SET payment_status='paye' WHERE payment_confirmed_at IS NOT NULL;

-- 3. Offres affichées sur le site, modifiables par l'administrateur
ALTER TABLE offers
  ADD COLUMN pitch VARCHAR(255) NULL AFTER features,
  ADD COLUMN items TEXT NULL AFTER pitch,                 -- une ligne par avantage affiché
  ADD COLUMN gift VARCHAR(255) NULL AFTER items,          -- cadeau affiché sous la liste (vide = aucun)
  ADD COLUMN featured TINYINT(1) NOT NULL DEFAULT 0 AFTER gift,
  ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1 AFTER featured,
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER active;
UPDATE offers SET sort_order=1, pitch='Pour exister proprement sur les réseaux.', gift=NULL,
  items='8 posts sur Facebook et Instagram\n15 stories\nCalendrier éditorial\nRapport de performance' WHERE code='essentiel';
UPDATE offers SET sort_order=2, pitch='Pour animer, répondre et faire de la publicité.', gift='Certification de votre fiche Google offerte',
  items='12 posts sur Facebook et Instagram\n24 stories\n2 reels\nAssistant IA 24h/24 sur 1 canal\n1 campagne publicitaire\nRapport mensuel détaillé' WHERE code='pro';
UPDATE offers SET sort_order=3, featured=1, pitch='Pour déléguer toute votre image.', gift='Fiche Google certifiée et 1 mois offert',
  items='16 posts sur Facebook et Instagram\nStories quotidiennes\n4 à 6 reels\n1 shooting photo et vidéo par mois, chez vous\nSite vitrine de 4 à 6 pages inclus\nIA avancée sur Instagram, Facebook et WhatsApp\nPublicités continues' WHERE code='premium';

-- 4. Services à la carte : affichage sur le site et ordre
ALTER TABLE services
  ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1 AFTER unit,
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER active;

-- 5. Demandes de devis saisies par l'équipe commerciale
ALTER TABLE carts
  ADD COLUMN created_by INT NULL AFTER user_id,
  ADD CONSTRAINT fk_carts_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
