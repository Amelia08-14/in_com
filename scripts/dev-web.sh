#!/bin/zsh
# Lance le front Next.js (http://localhost:3000)
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/env.sh"
cd "$DIR/../frontend" && npm run dev
