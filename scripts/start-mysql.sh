#!/bin/zsh
# Démarre MySQL 8.4 en local (port 3306)
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/env.sh"
if mysqladmin --socket="$MYSQL_SOCK" -uroot ping >/dev/null 2>&1; then
  echo "MySQL tourne déjà"; exit 0
fi
mysqld --no-defaults --basedir="$MYSQL_HOME_DIR" --datadir="$MYSQL_DATA" \
  --port="$MYSQL_PORT" --bind-address=127.0.0.1 --socket="$MYSQL_SOCK" \
  --mysqlx=OFF --log-error="$MYSQL_LOG" --character-set-server=utf8mb4 \
  --collation-server=utf8mb4_unicode_ci --default-time-zone=+01:00 &
for i in {1..30}; do
  mysqladmin --socket="$MYSQL_SOCK" -uroot ping >/dev/null 2>&1 && { echo "MySQL prêt sur 127.0.0.1:$MYSQL_PORT"; exit 0; }
  sleep 1
done
echo "MySQL n'a pas démarré, voir $MYSQL_LOG"; exit 1
