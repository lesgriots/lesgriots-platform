#!/usr/bin/env bash
#
# deploy.sh — déploie une app sur le VPS depuis ta machine locale.
#
# Usage :
#   ./deploy.sh studio          # = lesgriotsxstudio (site statique)
#   ./deploy.sh studio-bo       # = BO Studio Next.js (git pull + build + restart)
#   ./deploy.sh os              # = LES GRIOTS OS Next.js (git pull + build + restart)
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
  echo "Usage : ./deploy.sh <studio|studio-bo|os|lesgriots|lagriotheque|all>"
  exit 1
fi

# Alias pratiques
case "$APP" in
  studio) APP="lesgriotsxstudio" ;;
esac

echo "▶ Déploiement de '$APP' sur $VPS_HOST ..."

case "$APP" in
  lesgriots|lagriotheque|lesgriotsxstudio|all)
    # Sites statiques (HTML + Babel standalone) : git pull, puis re-export.
    # data.jsx et index.html sont GÉNÉRÉS sur le serveur par l'exporteur
    # (Sync du BO) → on les checkout avant le pull pour éviter le conflit,
    # puis on relance l'export juste après : il régénère data.jsx depuis la
    # DB (source de vérité) ET re-bump les ?v= de tous les .jsx/.css —
    # indispensable pour percer le cache Cloudflare après un déploiement
    # de code (leçon du 13/07/2026 : fullscreen "cassé" = viewer.jsx
    # périmé servi par le cache).
    ssh -t "$VPS_USER@$VPS_HOST" "sudo -u $DEPLOY_USER git -C $REPO_PATH checkout -- apps/lesgriotsxstudio/data.jsx apps/lesgriotsxstudio/index.html 2>/dev/null; sudo -u $DEPLOY_USER git -C $REPO_PATH pull --ff-only"

    echo "  → régénération data.jsx + cache-bust des versions (exporteur)"
    ssh -t "$VPS_USER@$VPS_HOST" "cd $REPO_PATH/apps/backoffice && sudo -u $DEPLOY_USER node --input-type=module -e \"import(process.cwd()+'/lib/exporter.js').then(m=>m.exportToDataJsx()).then(r=>console.log('export ok, v='+r.cacheBust)).catch(e=>{console.error('export KO: '+e.message);process.exit(1)})\""

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
    # npm modifie package-lock.json sur le serveur à chaque install → on le
    # checkout avant le pull (le lockfile de référence est celui du repo).
    # Idem pour les fichiers générés par l'exporteur.
    ssh -t "$VPS_USER@$VPS_HOST" "sudo -u $DEPLOY_USER git -C $REPO_PATH checkout -- apps/backoffice/package-lock.json apps/lesgriotsxstudio/data.jsx apps/lesgriotsxstudio/index.html 2>/dev/null; sudo -u $DEPLOY_USER git -C $REPO_PATH pull --ff-only"

    echo "  → npm install + build"
    ssh -t "$VPS_USER@$VPS_HOST" "sudo -u $DEPLOY_USER bash -c 'cd $BO_PATH && npm install --omit=dev && npm run build'"

    echo "  → restart du service systemd"
    ssh -t "$VPS_USER@$VPS_HOST" "sudo systemctl restart lesgriotsxstudio-backoffice"

    echo "  → vérification (doit être 'active (running)')"
    ssh -t "$VPS_USER@$VPS_HOST" "systemctl is-active lesgriotsxstudio-backoffice"

    echo "✓ BO Studio à jour sur https://admin.lesgriots.com/studio/"
    ;;

  os)
    # LES GRIOTS OS = app Next.js (apps/lesgriots-os) servie par systemd sur :3010,
    # exposée par nginx sur https://os.lesgriots.com (cf. docs/DEPLOY-OS.md).
    # ⚠️ La base data/lesgriots.db n'est PAS touchée par un déploiement
    #    (gitignorée, elle vit uniquement sur le VPS + sauvegardes).
    OS_PATH="$REPO_PATH/apps/lesgriots-os"

    echo "  → git pull (user $DEPLOY_USER)"
    # npm modifie package-lock.json sur le serveur à chaque install → on le
    # checkout avant le pull (le lockfile de référence est celui du repo).
    # Idem pour les fichiers générés par l'exporteur.
    ssh -t "$VPS_USER@$VPS_HOST" "sudo -u $DEPLOY_USER git -C $REPO_PATH checkout -- apps/backoffice/package-lock.json apps/lesgriotsxstudio/data.jsx apps/lesgriotsxstudio/index.html 2>/dev/null; sudo -u $DEPLOY_USER git -C $REPO_PATH pull --ff-only"

    echo "  → npm ci + build (npm ci COMPLET : next build a besoin des devDeps,"
    echo "    et better-sqlite3 est un module natif recompilé si l'ABI Node change)"
    ssh -t "$VPS_USER@$VPS_HOST" "sudo -u $DEPLOY_USER bash -c 'cd $OS_PATH && npm ci && npm run build'"

    echo "  → restart du service systemd"
    ssh -t "$VPS_USER@$VPS_HOST" "sudo systemctl restart lesgriots-os"

    echo "  → vérification (doit être 'active')"
    ssh -t "$VPS_USER@$VPS_HOST" "systemctl is-active lesgriots-os"

    echo "✓ LES GRIOTS OS à jour sur https://os.lesgriots.com"
    ;;

  *)
    echo "App inconnue : '$APP'"
    echo "Apps connues : studio (= lesgriotsxstudio), studio-bo (= BO Next.js), os (= LES GRIOTS OS), lesgriots, lagriotheque, all"
    exit 1
    ;;
esac

echo "▶ Terminé."
