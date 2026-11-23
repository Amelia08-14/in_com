SET NAMES utf8mb4;
-- Formule sur mesure dans les devis : nombre de posts, stories et reels par mois, prix choisi par le commercial
ALTER TABLE cart_items
  MODIFY kind ENUM('offer','service','devis','custom') NOT NULL,
  ADD COLUMN posts_month INT NULL,
  ADD COLUMN stories_month INT NULL,
  ADD COLUMN reels_month INT NULL;

-- Même nom partout : les offres personnalisées déjà créées deviennent des « Formule sur mesure »
UPDATE offers SET name = 'Formule sur mesure' WHERE custom_dossier_id IS NOT NULL AND name = 'Offre personnalisée';
