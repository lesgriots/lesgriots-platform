#!/usr/bin/env bash
#
# redeploy-os.sh — met à jour LES GRIOTHÈQUE OS en production.
#
#   pull → npm ci (si les dépendances ont changé) → build → restart → contrôle
#
# Usage (sur le VPS) :
#   sudo /var/www/ecosystem/production/lesgriots-platform/infra/scripts/redeploy-os.sh
#   sudo …/redeploy-os.sh --deps      # force la réinstallation des dépendances
#
# Le build tourne au premier plan mais journalise dans /tmp/os-redeploy.log :
# en cas d'échec, le service N'EST PAS redémarré et l'ancien build reste servi.

set -u
REPO=/var/www/ecosystem/production/lesgriots-platform
APP="$REPO/apps/lesgriots-os"
LOG=/tmp/os-redeploy.log
DEPS=0
[ "${1:-}" = "--deps" ] && DEPS=1

: > "$LOG"
echo "→ git pull" | tee -a "$LOG"
sudo -u deployment git -C "$REPO" pull --ff-only >> "$LOG" 2>&1 || { echo "✗ pull"; tail -3 "$LOG"; exit 1; }

# Réinstalle si demandé, si node_modules manque, ou si le verrou a bougé.
if [ "$DEPS" = "1" ] || [ ! -d "$APP/node_modules" ] || \
   [ "$APP/package-lock.json" -nt "$APP/node_modules" ]; then
  echo "→ npm ci" | tee -a "$LOG"
  ( cd "$APP" && sudo -u deployment npm ci >> "$LOG" 2>&1 ) || { echo "✗ npm ci"; tail -5 "$LOG"; exit 1; }
fi

echo "→ build" | tee -a "$LOG"
( cd "$APP" && sudo -u deployment npm run build >> "$LOG" 2>&1 ) || {
  echo "✗ BUILD ÉCHOUÉ — service inchangé, ancien build toujours servi"
  grep -iE "error|ReferenceError|Failed to compile" "$LOG" | head -5
  exit 1
}

echo "→ restart" | tee -a "$LOG"
systemctl restart lesgriots-os
sleep 5

ETAT=$(systemctl is-active lesgriots-os)
CODE=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: app.lagriotheque.com' http://127.0.0.1:3010/login)
echo "✓ service=$ETAT  /login=$CODE"
[ "$ETAT" = "active" ] && [ "$CODE" = "200" ] || exit 1
