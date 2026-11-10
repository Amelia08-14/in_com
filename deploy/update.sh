#!/usr/bin/env bash
# Mise à jour sur le VPS après un git push : ./deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
(cd backend && npm ci --omit=dev)
(cd frontend && npm ci && npm run build)
pm2 reload deploy/ecosystem.config.js --update-env
pm2 save
echo "IN COM à jour."
