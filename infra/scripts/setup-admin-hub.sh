#!/usr/bin/env bash
#
# setup-admin-hub.sh — Branche le BO Les Griots sur le hub admin.lesgriots.com.
# À lancer SUR LE VPS avec un user sudo (debian). Idempotent : relançable.
#
#   bash infra/scripts/setup-admin-hub.sh
#
# Résultat : https://admin.lesgriots.com/lesgriots/  (Next.js port 3032)
#
# Sûr par construction :
#   - ne réécrit JAMAIS la conf nginx gérée par Certbot : ajoute une seule
#     ligne `include` d'un snippet (sauvegarde avant, rollback si nginx -t rate)
#   - purement additif : /studio/ n'est pas touché
set -euo pipefail

REPO=/var/www/ecosystem/production/lesgriots-platform
DEPLOY_USER=deployment
BO="$REPO/apps/backoffice-lesgriots"
CONF=/etc/nginx/sites-available/admin.lesgriots.com.conf
SNIPPET_SRC="$REPO/infra/nginx/snippets/admin-lesgriots.conf"
SNIPPET_DST=/etc/nginx/snippets/admin-lesgriots.conf
SERVICE_SRC="$REPO/infra/systemd/lesgriots-backoffice.service"
SERVICE=lesgriots-backoffice
ENVFILE=/etc/lesgriots-backoffice.env

echo "▶ 1/6 — git pull du monorepo"
sudo -u "$DEPLOY_USER" git -C "$REPO" pull --ff-only

echo "▶ 2/6 — build du BO Les Griots (port 3032)"
sudo -u "$DEPLOY_USER" bash -c "cd '$BO' && npm install --omit=dev && npm run build"
echo "  ✓ build OK"

echo "▶ 3/6 — fichier d'environnement"
if [ ! -f "$ENVFILE" ]; then
  echo "ADMIN_PASSWORD=changeme" | sudo tee "$ENVFILE" >/dev/null
  sudo chmod 600 "$ENVFILE"
  echo "  ⚠️  $ENVFILE créé avec ADMIN_PASSWORD=changeme — CHANGE-LE :"
  echo "      sudo nano $ENVFILE && sudo systemctl restart $SERVICE"
else
  echo "  = $ENVFILE déjà présent (conservé)"
fi

echo "▶ 4/6 — service systemd"
sudo cp "$SERVICE_SRC" "/etc/systemd/system/$SERVICE.service"
sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE"
sudo systemctl restart "$SERVICE"
sleep 2
if ! systemctl is-active --quiet "$SERVICE"; then
  echo "✗ Le service $SERVICE n'est pas actif. Logs :"
  sudo journalctl -u "$SERVICE" -n 30 --no-pager
  exit 1
fi
echo "  ✓ $SERVICE actif (port 3032)"

echo "▶ 5/6 — nginx : include du snippet (sans toucher au bloc Certbot)"
sudo mkdir -p /etc/nginx/snippets
sudo cp "$SNIPPET_SRC" "$SNIPPET_DST"

if grep -q "admin-lesgriots.conf" "$CONF"; then
  echo "  = include déjà présent (conf inchangée)"
else
  BACKUP="$CONF.bak-$(date +%F-%H%M%S)"
  sudo cp "$CONF" "$BACKUP"
  echo "  ✓ sauvegarde : $BACKUP"
  # Ajoute l'include juste après CHAQUE server_name (bloc 80 ET bloc 443).
  sudo sed -i 's|^\([[:space:]]*server_name[[:space:]]\+admin\.lesgriots\.com;\)|\1\n    include /etc/nginx/snippets/admin-lesgriots.conf;|' "$CONF"
  if ! sudo nginx -t 2>/dev/null; then
    echo "✗ nginx -t a échoué → rollback de la conf"
    sudo cp "$BACKUP" "$CONF"
    sudo nginx -t
    exit 1
  fi
  echo "  ✓ include ajouté"
fi

echo "▶ 6/6 — test + reload nginx"
sudo nginx -t
sudo systemctl reload nginx
echo "  ✓ nginx rechargé"

echo
echo "✅ Terminé."
echo "   BO Les Griots : https://admin.lesgriots.com/lesgriots/"
echo "   (Basic auth du hub, puis le BO)"
echo "   Vérif rapide : curl -sI -u '<user>:<pass>' https://admin.lesgriots.com/lesgriots/ | head -1"
