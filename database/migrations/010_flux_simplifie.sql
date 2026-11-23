SET NAMES utf8mb4;
-- Flux simplifié : chaque demande a un commercial responsable, le devis suit son dossier,
-- un extra payé devient une tâche, et le dossier n'a plus que trois étapes (Signé → En production → Livré).

ALTER TABLE contact_requests
  ADD COLUMN assigned_to INT NULL AFTER prospect_id,
  ADD COLUMN handled_at DATETIME NULL AFTER assigned_to,
  ADD INDEX (assigned_to),
  ADD CONSTRAINT fk_requests_user FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE carts
  ADD COLUMN dossier_id INT NULL AFTER prospect_id,
  ADD CONSTRAINT fk_carts_dossier FOREIGN KEY (dossier_id) REFERENCES dossiers(id) ON DELETE SET NULL;

ALTER TABLE orders
  ADD COLUMN task_id INT NULL,
  ADD CONSTRAINT fk_orders_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;

-- Demandes déjà traitées : un appel ou une visite a été déclaré sur la fiche après la demande
UPDATE contact_requests r
SET handled_at = (SELECT MIN(x.created_at) FROM reports x WHERE x.prospect_id = r.prospect_id AND x.created_at >= r.created_at)
WHERE r.handled_at IS NULL;

-- Les anciennes étapes intermédiaires du dossier se fondent dans « En production » et « Livré »
UPDATE dossiers SET status = 'creation_en_cours' WHERE status IN ('paiement_confirme', 'en_attente_validation', 'modification_demandee');
UPDATE dossiers SET status = 'livre' WHERE status = 'publie';
