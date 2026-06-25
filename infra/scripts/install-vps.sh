#!/usr/bin/env bash
#
# install-vps.sh — provisionne le VPS LES GRIOTS en un seul lancement.
#
# À LANCER SUR LE VPS, EN ROOT, APRÈS UNE INSTALL FRAÎCHE D'UBUNTU 24.04.
#
# Procédure :
#   1. SSH sur le VPS (en tant que debian)
#   2. sudo su -        # passer root
#   3. curl -fsSL https://raw.githubusercontent.com/lesgriots/lesgriots-platform/main/infra/scripts/install-vps.sh | bash
#      OU
#      git clone https://github.com/lesgriots/lesgriots-platform.git /tmp/lgp
#      bash /tmp/lgp/infra/scripts/install-vps.sh
#
# Idempotent : peut être relancé sans dégât (skip ce qui est déjà fait).
#
# Ce que le script fait :
#   ✓ Installe les packages : nginx, certbot, nodejs, ufw, fail2ban, sqlite3, htpasswd, git
#   ✓ Crée l'user `deployment` (owns le code)
#   ✓ Configure UFW (22/80/443 ouvert)
#   ✓ Active fail2ban
#   ✓ Clone le monorepo dans /var/www/ecosystem/production/
#   ✓ npm install + build du BO Studio
#   ✓ Pose les confs nginx + recharge
#   ✓ Pose le service systemd du BO + démarre
#   ✓ Demande de créer le .htpasswd (Basic auth admin)
#   ✓ Demande de créer le fichier env (mots de passe app)
#   ✓ Lance certbot pour le HTTPS sur les 2 domaines
#
# Pré-requis DNS : avant de lancer, les A records doivent être posés chez OVH :
#   - lesgriotsxstudio.com → 51.210.4.77
#   - www.lesgriotsxstudio.com → 51.210.4.77
#   - admin.lesgriots.com → 51.210.4.77

set -euo pipefail

# ─── Config ────────────────────────────────────────────────────────────
REPO_URL="https://github.com/lesgriots/lesgriots-platform.git"
REPO_PATH="/var/www/ecosystem/production/lesgriots-platform"
DEPLOY_USER="deployment"
NODE_VERSION="20"
DOMAINS_HTTPS=(
  "lesgriotsxstudio.com -d www.lesgriotsxstudio.com"
  "admin.lesgriots.com"
)
# ───────────────────────────────────────────────────────────────────────

# Couleurs pour la lisibilité
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log()   { echo -e "${BLUE}▶${NC} $*"; }
ok()    { echo -e "${GREEN}✓${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC} $*"; }
err()   { echo -e "${RED}✗${NC} $*" >&2; }
ask()   { read -rp "$(echo -e "${YELLOW}?${NC} $1 ")" "$2"; }

# Doit être root
if [[ $EUID -ne 0 ]]; then
  err "Ce script doit être lancé en root (sudo su -)"
  exit 1
fi

log "Provisioning VPS LES GRIOTS — $(date)"
echo

# ─── 1. Packages système ───────────────────────────────────────────────
log "1/8 — Installation des packages système"
apt-get update -qq
apt-get install -y -qq \
  curl wget git \
  nginx \
  certbot python3-certbot-nginx \
  ufw fail2ban \
  sqlite3 \
  apache2-utils \
  build-essential \
  htop nano vim

# Node.js 20 via NodeSource (si pas déjà ≥ 20)
if ! command -v node &>/dev/null || [[ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]]; then
  log "Installation Node.js $NODE_VERSION"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
  apt-get install -y nodejs
fi

ok "Packages installés : $(node -v) / $(npm -v) / $(nginx -v 2>&1)"

# ─── 2. User deployment ────────────────────────────────────────────────
log "2/8 — User deployment"
if ! id -u "$DEPLOY_USER" &>/dev/null; then
  useradd --system --shell /bin/bash --create-home --home-dir "/home/$DEPLOY_USER" "$DEPLOY_USER"
  ok "User $DEPLOY_USER créé"
else
  ok "User $DEPLOY_USER existe déjà"
fi

mkdir -p /var/www/ecosystem/production
chown -R "$DEPLOY_USER:$DEPLOY_USER" /var/www/ecosystem

# ─── 3. Firewall UFW ───────────────────────────────────────────────────
log "3/8 — Firewall UFW"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
ok "UFW actif : $(ufw status | head -1 | awk '{print $2}')"

# ─── 4. Fail2ban ───────────────────────────────────────────────────────
log "4/8 — Fail2ban"
systemctl enable --now fail2ban
ok "Fail2ban actif"

# ─── 5. Clone du monorepo ──────────────────────────────────────────────
log "5/8 — Clone du monorepo"
if [[ ! -d "$REPO_PATH/.git" ]]; then
  sudo -u "$DEPLOY_USER" git clone "$REPO_URL" "$REPO_PATH"
  ok "Repo cloné dans $REPO_PATH"
else
  log "Repo existe — git pull"
  sudo -u "$DEPLOY_USER" git -C "$REPO_PATH" pull --ff-only
  ok "Repo à jour"
fi

# ─── 6. Build du BO Studio ─────────────────────────────────────────────
log "6/8 — Build du BO Studio (Next.js)"
BO_PATH="$REPO_PATH/apps/backoffice"
if [[ -d "$BO_PATH" ]]; then
  sudo -u "$DEPLOY_USER" bash -c "cd '$BO_PATH' && npm install --omit=dev && npm run build"
  ok "BO Studio buildé"
else
  warn "$BO_PATH n'existe pas — skip"
fi

# ─── 7. Configurations nginx + systemd ─────────────────────────────────
log "7/8 — Configurations nginx + systemd"

# nginx confs
cp "$REPO_PATH/infra/nginx/lesgriotsxstudio.conf" /etc/nginx/sites-available/lesgriotsxstudio.conf
cp "$REPO_PATH/infra/nginx/admin.conf"            /etc/nginx/sites-available/admin.lesgriots.com.conf

# Activer (idempotent : ln -sf écrase l'existant)
ln -sf /etc/nginx/sites-available/lesgriotsxstudio.conf      /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/admin.lesgriots.com.conf   /etc/nginx/sites-enabled/

# Désactive le default si présent
[[ -L /etc/nginx/sites-enabled/default ]] && rm /etc/nginx/sites-enabled/default

# Basic auth si pas déjà créé
if [[ ! -f /etc/nginx/.htpasswd ]]; then
  warn "Création du .htpasswd pour admin.lesgriots.com — choisis un mot de passe"
  htpasswd -c /etc/nginx/.htpasswd moos
else
  ok ".htpasswd existe déjà"
fi

# Fichier env du BO si pas déjà créé
ENV_FILE="/etc/lesgriotsxstudio-backoffice.env"
if [[ ! -f "$ENV_FILE" ]]; then
  warn "Création du fichier env du BO — saisis le mot de passe d'app"
  ask "Mot de passe admin du BO Studio :" BO_PASSWORD
  cat > "$ENV_FILE" <<EOF
# Variables d'environnement BO Studio
# Généré le $(date)
ADMIN_PASSWORD=$BO_PASSWORD
NODE_ENV=production
PORT=3030
EOF
  chmod 600 "$ENV_FILE"
  ok "$ENV_FILE créé"
else
  ok "$ENV_FILE existe déjà"
fi

# Service systemd
cp "$REPO_PATH/infra/systemd/lesgriotsxstudio-backoffice.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable lesgriotsxstudio-backoffice

# Test nginx avant reload
if nginx -t 2>&1 | grep -q "successful"; then
  systemctl reload nginx
  ok "nginx rechargé"
else
  err "nginx config invalide — corrige avant de continuer"
  nginx -t
  exit 1
fi

# Restart BO
systemctl restart lesgriotsxstudio-backoffice
sleep 2
if systemctl is-active --quiet lesgriotsxstudio-backoffice; then
  ok "BO Studio actif sur localhost:3030"
else
  err "BO Studio ne démarre pas — vérifier les logs"
  journalctl -u lesgriotsxstudio-backoffice -n 30 --no-pager
  exit 1
fi

# ─── 8. HTTPS via Certbot ──────────────────────────────────────────────
log "8/8 — Certificats HTTPS via Let's Encrypt"
warn "Vérifie que les A records DNS pointent bien vers ce serveur AVANT certbot."
ask "Lancer certbot maintenant ? (o/n)" RUN_CERTBOT
if [[ "$RUN_CERTBOT" =~ ^[oOyY] ]]; then
  ask "Ton email (pour les renouvellements urgents) :" EMAIL
  certbot --nginx \
    --non-interactive --agree-tos --email "$EMAIL" \
    -d lesgriotsxstudio.com -d www.lesgriotsxstudio.com || warn "certbot studio a échoué — DNS pas encore propagé ?"
  certbot --nginx \
    --non-interactive --agree-tos --email "$EMAIL" \
    -d admin.lesgriots.com || warn "certbot admin a échoué — DNS pas encore propagé ?"
  ok "Certifs posés"
else
  warn "certbot skippé — lance-le plus tard avec :"
  echo "  sudo certbot --nginx -d lesgriotsxstudio.com -d www.lesgriotsxstudio.com"
  echo "  sudo certbot --nginx -d admin.lesgriots.com"
fi

# ─── Récap final ───────────────────────────────────────────────────────
echo
ok "Installation terminée."
echo
log "Vérifications :"
echo "  curl -I http://lesgriotsxstudio.com           # → 200 ou 301 vers HTTPS"
echo "  curl -I http://admin.lesgriots.com/studio/    # → 401 Basic auth"
echo "  systemctl status lesgriotsxstudio-backoffice  # → active (running)"
echo
log "Prochaine étape (depuis ta machine locale) :"
echo "  ./infra/scripts/deploy-videos.sh studio       # push des vidéos"
echo
log "Pour mettre à jour plus tard :"
echo "  ./infra/scripts/deploy.sh studio              # site statique"
echo "  ./infra/scripts/deploy.sh studio-bo           # back office"
