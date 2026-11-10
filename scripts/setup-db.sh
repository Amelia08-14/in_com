#!/bin/zsh
# Crée la base incom_crm, l'utilisateur applicatif, le schéma et les données de démo
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/env.sh"
mysql --socket="$MYSQL_SOCK" -uroot <<SQL
CREATE DATABASE IF NOT EXISTS incom_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'incom'@'localhost' IDENTIFIED BY 'incom_local';
CREATE USER IF NOT EXISTS 'incom'@'127.0.0.1' IDENTIFIED BY 'incom_local';
GRANT ALL PRIVILEGES ON incom_crm.* TO 'incom'@'localhost';
GRANT ALL PRIVILEGES ON incom_crm.* TO 'incom'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
mysql --socket="$MYSQL_SOCK" -uroot incom_crm < "$DIR/../database/schema.sql" && echo "Schéma importé"
cd "$DIR/../backend" && node src/seed.js
