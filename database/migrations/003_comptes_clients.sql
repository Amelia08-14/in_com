-- Inscription des clients depuis le site (particulier ou entreprise)
-- et rattachement de chaque panier au compte qui l'a envoyé.
ALTER TABLE users
  ADD COLUMN account_type ENUM('particulier','entreprise') NULL AFTER role,
  ADD COLUMN company VARCHAR(160) NULL AFTER account_type;

ALTER TABLE carts
  ADD COLUMN user_id INT NULL AFTER prospect_id,
  ADD CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
