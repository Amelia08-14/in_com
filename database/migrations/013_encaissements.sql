SET NAMES utf8mb4;
-- Paiement modulable : paiement complet, mensuel ou acompte, avec chaque encaissement enregistré
ALTER TABLE dossiers ADD COLUMN payment_plan VARCHAR(10) NULL AFTER payment_status;   -- complet, mensuel, acompte

CREATE TABLE IF NOT EXISTS dossier_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  dossier_id INT NOT NULL,
  amount INT NOT NULL,
  mode VARCHAR(10) NULL,                  -- bureau, terrain, virement
  note VARCHAR(255) NULL,
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT NULL,
  INDEX (dossier_id),
  FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Dossiers déjà payés : leur montant devient un premier encaissement
INSERT INTO dossier_payments (dossier_id, amount, mode, note, paid_at)
SELECT d.id, d.amount, d.payment_mode, 'Paiement enregistré avant le suivi des encaissements', COALESCE(d.payment_confirmed_at, d.updated_at)
FROM dossiers d
WHERE d.payment_status = 'paye' AND d.amount > 0 AND NOT EXISTS (SELECT 1 FROM dossier_payments x WHERE x.dossier_id = d.id);
