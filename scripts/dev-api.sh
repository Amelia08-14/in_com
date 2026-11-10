#!/bin/zsh
# Lance l'API Node (http://localhost:4000) avec rechargement automatique
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/env.sh"
cd "$DIR/../backend" && npm run dev
