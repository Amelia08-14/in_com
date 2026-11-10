# Environnement local IN COM (équivalent WAMP/MAMP portable, sans sudo)
# Usage : source scripts/env.sh
export INCOM_OPT="$HOME/.local/opt"
export MYSQL_HOME_DIR="$INCOM_OPT/mysql"
export MYSQL_DATA="$HOME/.local/var/mysql-data"
export MYSQL_LOG="$HOME/.local/var/log/mysql.log"
export MYSQL_SOCK="/tmp/incom-mysql.sock"
export MYSQL_PORT=3306
export PATH="$INCOM_OPT/node/bin:$MYSQL_HOME_DIR/bin:$INCOM_OPT/php:$PATH"
