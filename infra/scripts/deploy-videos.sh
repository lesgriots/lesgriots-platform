#!/usr/bin/env bash
#
# deploy-videos.sh — pousse les vidéos d'une app sur le VPS via rsync.
#
# Les vidéos (.mp4, .mov, .web.mp4) ne sont PAS dans Git (.gitignore les exclut).
# Trop lourdes pour le contrôle de version + dépassent souvent la limite GitHub
# 100 MB par fichier. On les pousse séparément via rsync.
#
# Usage :
#   ./deploy-videos.sh studio       # img/ du studio uniquement
#   ./deploy-videos.sh lagriotheque # img/ de la griothèque
#   ./deploy-videos.sh all          # tous les sites
#
# Pré-requis : la cible doit exister sur le VPS et être writable par l'user SSH
# (ou alors on rsync vers /tmp puis on sudo mv ; pour l'instant on assume que
# le user debian est dans le groupe www-data ou que /apps/<nom>/img est 775).

set -euo pipefail

# ─── Config ────────────────────────────────────────────────────────────
VPS_USER="debian"
VPS_HOST="51.210.4.77"
REPO_PATH="/var/www/ecosystem/production/lesgriots-platform"
LOCAL_REPO="$(cd "$(dirname "$0")/../.." && pwd)"
# ───────────────────────────────────────────────────────────────────────

APP="${1:-}"
if [[ -z "$APP" ]]; then
  echo "Usage : ./deploy-videos.sh <studio|lagriotheque|all>"
  exit 1
fi

push_dir() {
  local app="$1"
  local src="$LOCAL_REPO/apps/$app/img/"
  local dst="$VPS_USER@$VPS_HOST:$REPO_PATH/apps/$app/img/"

  if [[ ! -d "$src" ]]; then
    echo "✗ Source introuvable : $src"
    return 1
  fi

  echo "▶ Sync $app img/ → VPS ..."
  # -a : préserve permissions/timestamps
  # -h : sizes en humain
  # -P : progress + partial (reprend si interrompu)
  # --include : on cible vidéos + covers
  # --exclude=* : tout le reste reste local (notamment les .MOV originaux)
  rsync -ahP \
    --include='*.mp4' \
    --include='*.web.mp4' \
    --include='*.webm' \
    --include='*-cover.jpg' \
    --include='*.jpg' \
    --include='*.png' \
    --exclude='*.MOV' \
    --exclude='*.mov' \
    --exclude='.DS_Store' \
    --exclude='*.bak' \
    --exclude='*.original.*' \
    "$src" "$dst"

  echo "✓ $app img/ à jour"
}

case "$APP" in
  studio) push_dir "lesgriotsxstudio" ;;
  lagriotheque) push_dir "lagriotheque" ;;
  all)
    push_dir "lesgriotsxstudio"
    push_dir "lagriotheque"
    ;;
  *)
    echo "App inconnue : '$APP'"
    exit 1
    ;;
esac

echo "▶ Terminé."
