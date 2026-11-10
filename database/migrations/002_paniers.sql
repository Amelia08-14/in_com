-- Paniers du site : commande publique + suivi par code (IC-XXXXXX)
CREATE TABLE IF NOT EXISTS carts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(12) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  company VARCHAR(160),
  phone VARCHAR(40),
  email VARCHAR(160),
  message TEXT,
  prospect_id INT NULL,
  assigned_to INT NULL,
  status ENUM('recue','contactee','devis_envoye','confirmee','en_production','livree','annulee') NOT NULL DEFAULT 'recue',
  total_once INT NOT NULL DEFAULT 0,
  total_monthly INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cart_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cart_id INT NOT NULL,
  kind ENUM('offer','service','devis') NOT NULL,
  ref VARCHAR(40) NOT NULL,
  label VARCHAR(160) NOT NULL,
  months INT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cart_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cart_id INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  note VARCHAR(500),
  user_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
