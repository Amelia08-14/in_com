#!/bin/zsh
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/env.sh"
mysqladmin --socket="$MYSQL_SOCK" -uroot shutdown && echo "MySQL arrêté"
