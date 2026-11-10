-- Profil complet de l'espace client : activité, coordonnées et informations de facturation.
-- (Les « secteurs » du CRM restent les zones géographiques des commerciaux terrain.)
ALTER TABLE users
  ADD COLUMN activity VARCHAR(80) NULL AFTER company,
  ADD COLUMN city VARCHAR(80) NULL AFTER activity,
  ADD COLUMN address VARCHAR(255) NULL AFTER city,
  ADD COLUMN website VARCHAR(255) NULL AFTER address,
  ADD COLUMN social_url VARCHAR(255) NULL AFTER website,
  ADD COLUMN nif VARCHAR(40) NULL AFTER social_url,
  ADD COLUMN rc VARCHAR(40) NULL AFTER nif;
