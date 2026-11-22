SET NAMES utf8mb4;
-- Plusieurs rôles pour une même personne (rôles en plus du rôle principal, séparés par des virgules)
ALTER TABLE users ADD COLUMN extra_roles VARCHAR(255) NULL AFTER role;
-- Dossier Drive partagé avec le client pour ses références (logos, photos, textes)
ALTER TABLE prospects ADD COLUMN drive_url VARCHAR(500) NULL AFTER documents_url;
