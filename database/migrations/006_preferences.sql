SET NAMES utf8mb4;
-- Préférences d'affichage de chaque utilisateur (ex. : blocs visibles du tableau de bord)
ALTER TABLE users ADD COLUMN preferences TEXT NULL AFTER active;
