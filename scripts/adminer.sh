#!/bin/zsh
# Interface d'administration MySQL (équivalent phpMyAdmin) via PHP : http://localhost:8080/adminer.php
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/env.sh"
cd "$DIR/../tools" && php -S 127.0.0.1:8080
