-- IN COM · CRM — schéma MySQL 8
-- Basé sur : Processus commercial, workflows sédentaire / terrain / graphiste, plans d'exécution par poste
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS cart_events, cart_items, carts, notifications, contact_requests, orders, services, tickets,
  task_history, task_versions, tasks, client_assignments, dossier_history, dossiers,
  deal_history, deals, reports, prospects, offers, user_sectors, sectors, users;

SET FOREIGN_KEY_CHECKS = 1;

-- ───────────── Utilisateurs & rôles ─────────────
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM(
    'admin',                     -- CEO / direction
    'responsable_commercial',
    'commercial_sedentaire',
    'commercial_terrain',
    'responsable_communication',
    'responsable_technique',
    'charge_clientele',
    'graphiste',
    'community_manager',
    'photographe',
    'media_buyer',
    'developpeur',
    'recouvrement',
    'client'
  ) NOT NULL,
  account_type ENUM('particulier','entreprise') NULL,   -- comptes clients créés depuis le site
  company VARCHAR(160) NULL,
  activity VARCHAR(80) NULL,               -- secteur d'activité du client
  city VARCHAR(80) NULL,
  address VARCHAR(255) NULL,
  website VARCHAR(255) NULL,
  social_url VARCHAR(255) NULL,            -- page Instagram ou Facebook
  nif VARCHAR(40) NULL,
  rc VARCHAR(40) NULL,
  phone VARCHAR(40),
  daily_capacity INT NOT NULL DEFAULT 6,   -- capacité journalière (graphiste)
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sectors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE user_sectors (
  user_id INT NOT NULL,
  sector_id INT NOT NULL,
  PRIMARY KEY (user_id, sector_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE CASCADE
);

-- ───────────── Offres ─────────────
CREATE TABLE offers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  price_month INT NOT NULL,           -- DA HT / mois
  posts_month INT NOT NULL DEFAULT 0,
  stories_month INT NOT NULL DEFAULT 0,
  reels_month INT NOT NULL DEFAULT 0,
  features TEXT
);

-- ───────────── Univers (prospects & clients) ─────────────
CREATE TABLE prospects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  contact_name VARCHAR(120),
  specialty VARCHAR(120),
  phone VARCHAR(40),
  email VARCHAR(160),
  maps_url VARCHAR(500),
  address VARCHAR(255),
  sector_id INT,
  source ENUM('cold_mailing','ads','sedentaire','terrain','site') NOT NULL DEFAULT 'sedentaire',
  label ENUM('prospect','qualifie','promesse','a_eviter','client') NOT NULL DEFAULT 'prospect',
  offer_id INT NULL,
  documents_url VARCHAR(500),
  priority TINYINT NOT NULL DEFAULT 2,     -- 1 haute, 2 normale, 3 basse
  client_user_id INT NULL,                 -- compte client dans le CRM
  created_by INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (label), INDEX (sector_id), INDEX (name),
  FOREIGN KEY (sector_id) REFERENCES sectors(id) ON DELETE SET NULL,
  FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE SET NULL,
  FOREIGN KEY (client_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ───────────── Reporting quotidien (appels & visites) ─────────────
CREATE TABLE reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  prospect_id INT NOT NULL,
  channel ENUM('appel','visite') NOT NULL,
  reason ENUM(
    'prospect','relance_sedentaire','relance_terrain','relance_visite',
    'deal_terrain','deal_bureau','promesse','a_eviter','signe','issue_deal'
  ) NOT NULL,
  entry_type ENUM('prospect','deal') NOT NULL DEFAULT 'prospect',
  outcome VARCHAR(30),
  notes TEXT,
  documents_url VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
);

-- ───────────── Deals & calendrier ─────────────
CREATE TABLE deals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prospect_id INT NOT NULL,
  type ENUM('terrain','bureau') NOT NULL,
  created_by INT NOT NULL,
  assigned_to INT NULL,
  status ENUM('a_attribuer','attribue','programme','gagne','perdu','a_relancer') NOT NULL DEFAULT 'a_attribuer',
  scheduled_at DATETIME NULL,
  kind ENUM('rdv','appel','passage_bureau') NOT NULL DEFAULT 'rdv',
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (assigned_to, status), INDEX (scheduled_at),
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE deal_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deal_id INT NOT NULL,
  user_id INT,
  action VARCHAR(40) NOT NULL,
  detail VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
);

-- ───────────── Dossiers clients (signé → livré / publié) ─────────────
CREATE TABLE dossiers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prospect_id INT NOT NULL,
  offer_id INT NULL,
  title VARCHAR(200) NOT NULL,
  service_type ENUM('abonnement','graphisme','photo_video','developpement','media_buying','evenementiel') NOT NULL DEFAULT 'abonnement',
  signed_by INT NULL,
  cc_id INT NULL,
  status ENUM('signe','paiement_confirme','creation_en_cours','en_attente_validation','modification_demandee','livre','publie') NOT NULL DEFAULT 'signe',
  payment_mode ENUM('bureau','terrain','virement') DEFAULT 'bureau',
  amount INT DEFAULT 0,
  payment_confirmed_at DATETIME NULL,
  validated_at DATETIME NULL,              -- validé par le client, en attente de publication CM
  next_followup DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (status),
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE SET NULL,
  FOREIGN KEY (signed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (cc_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE dossier_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dossier_id INT NOT NULL,
  user_id INT,
  status VARCHAR(40) NOT NULL,
  note VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE
);

-- Affectation des intervenants à un client (GD par le resp. technique, CM, CC…)
CREATE TABLE client_assignments (
  prospect_id INT NOT NULL,
  user_id INT NOT NULL,
  role VARCHAR(40) NOT NULL,
  assigned_by INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (prospect_id, user_id),
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ───────────── Tâches de production ─────────────
CREATE TABLE tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prospect_id INT NOT NULL,
  dossier_id INT NULL,
  assigned_to INT NOT NULL,
  type ENUM('conception','story','reel','photo','video','dev') NOT NULL DEFAULT 'conception',
  part ENUM('creation','modification') NOT NULL DEFAULT 'creation',
  theme VARCHAR(200),
  brief TEXT,
  priority TINYINT NOT NULL DEFAULT 2,
  due_date DATE NOT NULL,
  status ENUM('a_faire','en_cours','validation_technique','validation_client','modification_demandee','validee','publiee') NOT NULL DEFAULT 'a_faire',
  modif_count INT NOT NULL DEFAULT 0,
  reassigned_from INT NULL,
  last_note VARCHAR(500),
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (assigned_to, due_date), INDEX (status),
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (reassigned_from) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE task_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  version INT NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  comment VARCHAR(500),
  created_by INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE task_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  user_id INT,
  action VARCHAR(40) NOT NULL,         -- creation, modification, refus, validation…
  status VARCHAR(40),
  note VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id, created_at),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- ───────────── SAV, commandes, services ─────────────
CREATE TABLE tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prospect_id INT NOT NULL,
  department ENUM('commercial','communication','technique','facturation') NOT NULL DEFAULT 'commercial',
  subject VARCHAR(200) NOT NULL,
  message TEXT,
  status ENUM('ouvert','en_cours','resolu') NOT NULL DEFAULT 'ouvert',
  assigned_to INT NULL,
  created_by INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  price INT NOT NULL,
  unit VARCHAR(40) DEFAULT 'unité'
);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prospect_id INT NOT NULL,
  service_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  price INT NOT NULL,
  status ENUM('en_attente','validee','recouvrement','payee','annulee') NOT NULL DEFAULT 'en_attente',
  validated_by INT NULL,
  note VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id),
  FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ───────────── Landing page & notifications ─────────────
CREATE TABLE contact_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  company VARCHAR(160),
  phone VARCHAR(40),
  email VARCHAR(160),
  offer VARCHAR(40),
  message TEXT,
  prospect_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message VARCHAR(300) NOT NULL,
  link VARCHAR(200),
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (user_id, read_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ───────────── Paniers du site (voir migrations/002_paniers.sql) ─────────────
CREATE TABLE carts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(12) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  company VARCHAR(160),
  phone VARCHAR(40),
  email VARCHAR(160),
  message TEXT,
  prospect_id INT NULL,
  user_id INT NULL,                        -- compte client qui a envoyé le panier
  assigned_to INT NULL,
  status ENUM('recue','contactee','devis_envoye','confirmee','en_production','livree','annulee') NOT NULL DEFAULT 'recue',
  total_once INT NOT NULL DEFAULT 0,
  total_monthly INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL,
  CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE cart_items (
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

CREATE TABLE cart_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cart_id INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  note VARCHAR(500),
  user_id INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
