#!/usr/bin/env bash
#
# deploy.sh — déploie une app sur le VPS depuis ta machine locale.
#
# Usage :
#   ./deploy.sh studio          # = lesgriotsxstudio (site statique)
#   ./deploy.sh studio-bo       # = BO Studio Next.js (git pull + build + restart)
#   ./deploy.sh lesgriots
#   ./deploy.sh lagriotheque
#   ./deploy.sh all             # toutes les apps statiques (un seul git pull)
#
# Pré-requis : le code est déjà poussé sur GitHub (git push) avant de déployer.
# Le déploiement se contente de faire un "git pull" côté serveur via sudo -u
# deployment (le user qui owns /var/www/ecosystem/ — convention d'Habib).
#
# Architecture cible (mise en place le 2026-06-13) :
#   - User SSH : debian
#   - User propriétaire du code : deployment
#   - Path : /var/www/ecosystem/production/lesgriots-platform/
#   - Sites statiques servis directement par nginx depuis apps/<nom>/

set -euo pipefail

# ─── Config ────────────────────────────────────────────────────────────
VPS_USER="debian"                                              # user SSH
VPS_HOST="51.210.4.77"                                         # OVH Strasbourg
REPO_PATH="/var/www/ecosystem/production/lesgriots-platform"   # clone Git
DEPLOY_USER="deployment"                                        # owns le clone
# ───────────────────────────────────────────────────────────────────────

APP="${1:-}"
if [[ -z "$APP" ]]; then
  echo "Usage : ./deploy.sh <studio|lesgriots|lagriotheque|all>"
  exit 1
fi

# Alias pratiques
case "$APP" in
  studio) APP="lesgriotsxstudio" ;;
esac

echo "▶ Déploiement de '$APP' sur $VPS_HOST ..."

case "$APP" in
  lesgriots|lagriotheque|lesgriotsxstudio|all)
    # Sites statiques (HTML + Babel standalone) : git pull et c'est tout.
    # Pas de build, pas de reload nginx — nginx sert les fichiers tels quels,
    # la prochaine requête sert la nouvelle version automatiquement.
    ssh -t "$VPS_USER@$VPS_HOST" "sudo -u $DEPLOY_USER git -C $REPO_PATH pull --ff-only"

    # Fix permissions au cas où de nouveaux fichiers seraient arrivés avec
    # un mode trop restrictif (rsync préserve les modes source).
    ssh -t "$VPS_USER@$VPS_HOST" "sudo chmod -R a+rX $REPO_PATH"

    echo "✓ '$APP' à jour sur https://lesgriotsxstudio.com"
    ;;

  studio-bo)
    # BO Studio = app Next.js (apps/backoffice) servie par systemd sur :3030,
    # exposée par nginx sous https://admin.lesgriots.com/studio/.
    # Mettre à jour = git pull + réinstaller les deps + rebuild + restart service.
    # Downtime ~5 s pendant le restart systemd.
    BO_PATH="$REPO_PATH/apps/backoffice"

    echo "  → git pull (user $DEPLOY_USER)"
    ssh -t "$VPS_USER@$VPS_HOST" "sudo -u $DEPLOY_USER git -C $REPO_PATH pull --ff-only"

    echo "  → npm install + build"
    ssh -t "$VPS_USER@$VPS_HOST" "sudo -u $DEPLOY_USER bash -c 'cd $BO_PATH && npm install --omit=dev && npm run build'"

    echo "  → restart du service systemd"
    ssh -t "$VPS_USER@$VPS_HOST" "sudo systemctl restart lesgriotsxstudio-backoffice"

    echo "  → vérification (doit être 'active (running)')"
    ssh -t "$VPS_USER@$VPS_HOST" "systemctl is-active lesgriotsxstudio-backoffice"

    echo "✓ BO Studio à jour sur https://admin.lesgriots.com/studio/"
    ;;

  *)
    echo "App inconnue : '$APP'"
    echo "Apps connues : studio (= lesgriotsxstudio), studio-bo (= BO Next.js), lesgriots, lagriotheque, all"
    exit 1
    ;;
esac

echo "▶ Terminé."
