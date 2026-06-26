#!/usr/bin/env bash
#
# add-bo-studio.sh — ajoute le BO Studio à un VPS qui a déjà le site studio.
#
# Pré-requis (déjà en place depuis le 1er déploiement) :
#   ✓ nginx, certbot, node, ufw, user deployment, repo cloné
#   ✓ site lesgriotsxstudio.com déjà servi par nginx
#   ✓ DNS lesgriotsxstudio.com → 51.210.4.77 actif
#
# Ce que ce script fait UNIQUEMENT (rien d'autre, rien à réinstaller) :
#   1. Pull la dernière version du repo
#   2. Build du BO Studio (npm install + npm run build)
#   3. Pose la conf nginx admin.lesgriots.com + recharge
#   4. Pose le service systemd lesgriotsxstudio-backoffice
#   5. Demande mot de passe .htpasswd + ADMIN_PASSWORD (si pas déjà créés)
#   6. Lance certbot pour admin.lesgriots.com
#
# Pré-requis DNS : avant de lancer, créer chez OVH :
#   - admin.lesgriots.com → A 51.210.4.77
#
# Usage (sur le VPS, en root) :
#   sudo bash /var/www/ecosystem/production/lesgriots-platform/infra/scripts/add-bo-studio.sh

set -euo pipefail

REPO_PATH="/var/www/ecosystem/production/lesgriots-platform"
DEPLOY_USER="deployment"
BO_PATH="$REPO_PATH/apps/backoffice"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${BLUE}▶${NC} $*"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*" >&2; }
ask()  { read -rp "$(echo -e "${YELLOW}?${NC} $1 ")" "$2"; }

[[ $EUID -ne 0 ]] && { err "Lance en root : sudo bash $0"; exit 1; }
[[ ! -d "$REPO_PATH/.git" ]] && { err "Repo introuvable à $REPO_PATH — ce script suppose un VPS déjà setup"; exit 1; }

# Dépendances système requises (apache2-utils = htpasswd).
# Idempotent : apt skip ce qui est déjà installé.
for cmd in htpasswd nginx node npm certbot; do
  if ! command -v "$cmd" &>/dev/null; then
    warn "$cmd manquant — installation"
    apt-get update -qq
    apt-get install -y apache2-utils nginx nodejs npm certbot python3-certbot-nginx
    break
  fi
done

log "Ajout BO Studio sur VPS déjà setup — $(date)"
echo

# ─── 1. Pull du repo ───────────────────────────────────────────────────
log "1/6 — Pull du repo"
sudo -u "$DEPLOY_USER" git -C "$REPO_PATH" pull --ff-only
ok "Repo à jour"

# ─── 2. Build du BO ────────────────────────────────────────────────────
log "2/6 — Build du BO Studio"
sudo -u "$DEPLOY_USER" bash -c "cd '$BO_PATH' && npm install --omit=dev && npm run build"
ok "BO buildé"

# ─── 3. Conf nginx admin.lesgriots.com ────────────────────────────────
log "3/6 — Conf nginx admin.lesgriots.com"
cp "$REPO_PATH/infra/nginx/admin.conf" /etc/nginx/sites-available/admin.lesgriots.com.conf
ln -sf /etc/nginx/sites-available/admin.lesgriots.com.conf /etc/nginx/sites-enabled/

# .htpasswd Basic auth
if [[ ! -f /etc/nginx/.htpasswd ]]; then
  warn "Création du .htpasswd (Basic auth nginx pour admin.lesgriots.com)"
  htpasswd -c /etc/nginx/.htpasswd moos
else
  ok ".htpasswd existe déjà"
fi

# Test + reload nginx
if nginx -t 2>&1 | grep -q "successful"; then
  systemctl reload nginx
  ok "nginx rechargé"
else
  err "nginx config invalide"
  nginx -t
  exit 1
fi

# ─── 4. Fichier env du BO ─────────────────────────────────────────────
log "4/6 — Fichier env du BO"
ENV_FILE="/etc/lesgriotsxstudio-backoffice.env"
if [[ ! -f "$ENV_FILE" ]]; then
  ask "Mot de passe admin du BO Studio (ADMIN_PASSWORD applicatif) :" BO_PASSWORD
  cat > "$ENV_FILE" <<EOF
# Variables d'environnement BO Studio — généré le $(date)
ADMIN_PASSWORD=$BO_PASSWORD
NODE_ENV=production
PORT=3030
EOF
  chmod 600 "$ENV_FILE"
  ok "$ENV_FILE créé"
else
  ok "$ENV_FILE existe déjà — pas réécrasé"
fi

# ─── 5. Service systemd ────────────────────────────────────────────────
log "5/6 — Service systemd"
cp "$REPO_PATH/infra/systemd/lesgriotsxstudio-backoffice.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable lesgriotsxstudio-backoffice
systemctl restart lesgriotsxstudio-backoffice
sleep 2
if systemctl is-active --quiet lesgriotsxstudio-backoffice; then
  ok "BO Studio actif sur localhost:3030"
else
  err "BO Studio ne démarre pas — logs :"
  journalctl -u lesgriotsxstudio-backoffice -n 30 --no-pager
  exit 1
fi

# ─── 6. Certbot HTTPS pour admin.lesgriots.com ────────────────────────
log "6/6 — HTTPS via certbot"
warn "Vérifie que admin.lesgriots.com → 51.210.4.77 dans DNS OVH (sinon certbot va planter)"
ask "Lancer certbot maintenant ? (o/n)" RUN_CERTBOT
if [[ "$RUN_CERTBOT" =~ ^[oOyY] ]]; then
  ask "Email pour Let's Encrypt :" EMAIL
  certbot --nginx \
    --non-interactive --agree-tos --email "$EMAIL" \
    -d admin.lesgriots.com || warn "certbot a échoué (DNS pas encore propagé ?)"
else
  warn "certbot skippé — lance plus tard avec :"
  echo "  sudo certbot --nginx -d admin.lesgriots.com"
fi

# ─── Récap ─────────────────────────────────────────────────────────────
echo
ok "BO Studio ajouté avec succès"
echo
log "Vérifications :"
echo "  curl -I https://admin.lesgriots.com/studio/   # → 401 Basic auth (= normal, login admin/<mdp>)"
echo "  systemctl status lesgriotsxstudio-backoffice  # → active (running)"
echo "  journalctl -u lesgriotsxstudio-backoffice -f  # logs en temps réel"
echo
log "Pour mettre à jour plus tard (depuis ta machine locale) :"
echo "  ./infra/scripts/deploy.sh studio-bo"
echo
log "Pour mettre à jour le site studio (statique) :"
echo "  ./infra/scripts/deploy.sh studio"
