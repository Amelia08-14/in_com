SET NAMES utf8mb4;
-- Offre personnalisée : une formule propre à un dossier (quotas mensuels sur mesure, jamais affichée sur le site)
ALTER TABLE offers ADD COLUMN custom_dossier_id INT NULL AFTER sort_order, ADD INDEX (custom_dossier_id);

-- Services choisis dans une offre personnalisée, avec leur nombre
CREATE TABLE IF NOT EXISTS dossier_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dossier_id INT NOT NULL,
  service_id INT NULL,
  label VARCHAR(160) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
);
