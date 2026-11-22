SET NAMES utf8mb4;
-- Une même personne peut tenir plusieurs rôles chez un client (ex. : graphiste et community manager)
ALTER TABLE client_assignments DROP PRIMARY KEY, ADD PRIMARY KEY (prospect_id, user_id, role);
