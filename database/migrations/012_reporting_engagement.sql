SET NAMES utf8mb4;
-- Raisons d'appel et de visite plus détaillées : la liste vit dans le code, la colonne n'est plus une liste fermée
ALTER TABLE reports MODIFY reason VARCHAR(30) NOT NULL;

-- Période d'engagement de la formule signée (en mois)
ALTER TABLE dossiers ADD COLUMN engagement_months TINYINT NULL AFTER amount;
