#!/usr/bin/env bash
#
# setup-lesgriots.sh — Première mise en ligne de lesgriots.com (page coming-soon).
# À lancer SUR LE VPS, avec un user sudo (debian). Idempotent : relançable sans risque.
#
#   bash setup-lesgriots.sh
#
# Ce que ça fait :
#   1. git pull du monorepo (user deployment)
#   2. vérifie que la page coming-soon est bien présente
#   3. active le vhost nginx statique de lesgriots.com (sans écraser un bloc HTTPS Certbot)
#   4. nginx -t + reload
#   5. HTTPS via Certbot (si pas déjà fait)
set -euo pipefail

REPO=/var/www/ecosystem/production/lesgriots-platform
DEPLOY_USER=deployment
EMAIL=moos.coulibaly@gmail.com
CONF_SRC="$REPO/infra/nginx/lesgriots.conf"
CONF_DST=/etc/nginx/sites-available/lesgriots.com.conf
CONF_LINK=/etc/nginx/sites-enabled/lesgriots.com.conf

echo "▶ 1/5 — git pull du monorepo"
# Neutralise d'éventuelles modifs locales du VPS sur les fichiers du site,
# pour que le pull --ff-only passe (la source de vérité, c'est le repo).
sudo -u "$DEPLOY_USER" git -C "$REPO" checkout -- apps/lesgriots/index.html apps/lesgriots/styles.css 2>/dev/null || true
sudo -u "$DEPLOY_USER" git -C "$REPO" pull --ff-only

echo "▶ 2/5 — vérification de la page coming-soon"
if ! grep -q 'class="logo"' "$REPO/apps/lesgriots/index.html" 2>/dev/null; then
  echo "✗ La page coming-soon n'est pas dans le repo."
  echo "  → As-tu fait 'git push' depuis ton Mac ? Fais-le puis relance ce script."
  exit 1
fi
echo "  ✓ coming-soon présent"

echo "▶ 3/5 — activation du vhost lesgriots.com"
if [ ! -f "$CONF_DST" ]; then
  sudo cp "$CONF_SRC" "$CONF_DST"
  echo "  ✓ conf installée depuis le repo"
else
  echo "  = conf déjà présente (conservée — Certbot a pu l'étendre, on n'écrase pas)"
fi
sudo ln -sf "$CONF_DST" "$CONF_LINK"
echo "  ✓ vhost activé (sites-enabled)"

echo "▶ 4/5 — test de conf + reload nginx"
sudo nginx -t
sudo systemctl reload nginx
echo "  ✓ nginx rechargé"

echo "▶ 5/5 — HTTPS (Certbot)"
if sudo certbot certificates 2>/dev/null | grep -q "Domains:.*\blesgriots\.com\b"; then
  echo "  = certificat lesgriots.com déjà présent"
else
  if ! sudo certbot --nginx -d lesgriots.com -d www.lesgriots.com \
        --non-interactive --agree-tos -m "$EMAIL" --redirect; then
    echo "  ⚠️ Certbot non-interactif a échoué. Lance-le à la main :"
    echo "     sudo certbot --nginx -d lesgriots.com -d www.lesgriots.com"
  fi
fi

echo
echo "✅ Terminé."
echo "   Vérifie :  curl -I https://lesgriots.com   (attendu : HTTP/2 200)"
