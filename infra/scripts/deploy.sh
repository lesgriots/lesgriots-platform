#!/usr/bin/env bash
#
# deploy.sh — déploie une app sur le VPS depuis ta machine locale.
#
# Usage :
#   ./deploy.sh lesgriots
#   ./deploy.sh lagriotheque
#   ./deploy.sh lesgriotsxstudio
#   ./deploy.sh dashboard
#
# Pré-requis : le code est déjà poussé sur GitHub (git push) avant de déployer.
# Le déploiement se contente de faire un "git pull" côté serveur.

set -euo pipefail

# ─── Config (à adapter) ──────────────────────────────────────────────
VPS_USER="moos"
VPS_HOST="51.210.4.77"          # VPS OVH Strasbourg
SRV_BASE="/srv"                  # où vit le code sur le VPS
# ─────────────────────────────────────────────────────────────────────

APP="${1:-}"
if [[ -z "$APP" ]]; then
  echo "Usage : ./deploy.sh <lesgriots|lagriotheque|lesgriotsxstudio|dashboard>"
  exit 1
fi

echo "▶ Déploiement de '$APP' sur $VPS_HOST ..."

case "$APP" in
  lesgriots|lagriotheque|lesgriotsxstudio)
    # Site statique : un simple git pull suffit
    ssh "$VPS_USER@$VPS_HOST" "cd $SRV_BASE/$APP && git pull --ff-only"
    echo "✓ Site statique '$APP' à jour."
    ;;

  dashboard)
    # App Node : pull + install + build + restart du service
    ssh "$VPS_USER@$VPS_HOST" "
      set -e
      cd $SRV_BASE/dashboard
      git pull --ff-only
      npm install --omit=dev
      npm run build
      sudo systemctl restart dashboard
    "
    echo "✓ Dashboard redéployé et redémarré."
    ;;

  *)
    echo "App inconnue : '$APP'"
    exit 1
    ;;
esac

echo "▶ Terminé."
