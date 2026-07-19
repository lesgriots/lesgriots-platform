#!/usr/bin/env bash
#
# migrate-griotheque-hub.sh — Bascule le BO Griothèque sur le hub
# admin.lesgriots.com/griotheque/ et pose la redirection de l'ancien domaine.
# À lancer SUR LE VPS avec un user sudo (debian). Idempotent : relançable.
#
# Prérequis : le BO a été rebuildé avec basePath "/griotheque" (npm run build).
#
# Sûr par construction : sauvegarde des deux confs nginx avant modification,
# rollback automatique des deux si nginx -t échoue.
set -euo pipefail

REPO=/var/www/ecosystem/production/lesgriots-platform
CONF=/etc/nginx/sites-available/admin.lesgriots.com.conf
OLDCONF=/etc/nginx/sites-available/admin.lagriotheque.com.conf
SNIPPET_SRC="$REPO/infra/nginx/snippets/admin-griotheque.conf"
SNIPPET_DST=/etc/nginx/snippets/admin-griotheque.conf
REDIR_SRC="$REPO/infra/nginx/admin.lagriotheque.com.conf"
SERVICE=lagriotheque-backoffice
STAMP=$(date +%F-%H%M%S)

echo "▶ 1/4 — restart du BO Griothèque (nouveau build basePath /griotheque)"
sudo systemctl restart "$SERVICE"
sleep 2
if ! systemctl is-active --quiet "$SERVICE"; then
  echo "✗ $SERVICE n'est pas actif. Logs :"
  sudo journalctl -u "$SERVICE" -n 30 --no-pager
  exit 1
fi
echo "  ✓ $SERVICE actif (port 3031)"

echo "▶ 2/4 — hub : include du snippet /griotheque/"
sudo cp "$SNIPPET_SRC" "$SNIPPET_DST"
BACKUP_HUB=""
if grep -q "admin-griotheque.conf" "$CONF"; then
  echo "  = include déjà présent (conf hub inchangée)"
else
  BACKUP_HUB="$CONF.bak-$STAMP"
  sudo cp "$CONF" "$BACKUP_HUB"
  echo "  ✓ sauvegarde : $BACKUP_HUB"
  sudo sed -i 's|^\([[:space:]]*server_name[[:space:]]\+admin\.lesgriots\.com;\)|\1\n    include /etc/nginx/snippets/admin-griotheque.conf;|' "$CONF"
  echo "  ✓ include ajouté (blocs 80 et 443)"
fi

echo "▶ 3/4 — ancien domaine : redirection + endpoints publics préservés"
BACKUP_OLD="$OLDCONF.bak-$STAMP"
sudo cp "$OLDCONF" "$BACKUP_OLD"
echo "  ✓ sauvegarde : $BACKUP_OLD"
sudo cp "$REDIR_SRC" "$OLDCONF"

echo "▶ 4/4 — test + reload nginx"
if ! sudo nginx -t 2>/dev/null; then
  echo "✗ nginx -t a échoué → rollback des deux confs"
  [ -n "$BACKUP_HUB" ] && sudo cp "$BACKUP_HUB" "$CONF"
  sudo cp "$BACKUP_OLD" "$OLDCONF"
  sudo nginx -t
  exit 1
fi
sudo systemctl reload nginx
echo "  ✓ nginx rechargé"

echo
echo "✅ Terminé."
echo "   BO Griothèque : https://admin.lesgriots.com/griotheque/"
echo "   Ancien domaine : https://admin.lagriotheque.com → 301 vers le hub"
echo "   Endpoints publics conservés : /api/leads, /api/subscribe,"
echo "   /api/stripe/create-payment-intent (réécrits vers /griotheque/api/…)"
