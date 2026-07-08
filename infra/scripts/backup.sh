#!/usr/bin/env bash
#
# backup.sh — sauvegarde la base SQLite de LES GRIOTS OS (apps/lesgriots-os).
# À lancer SUR le VPS (manuellement ou via un cron quotidien).
#
# La base data/lesgriots.db n'étant pas dans Git, c'est la seule protection
# contre une perte de données (avec le snapshot OVH). Cf. docs/SECRETS.md.
#
# La logique de sauvegarde (sqlite3 .backup à chaud WAL-safe + gzip +
# rotation 30) vit dans l'app elle-même — apps/lesgriots-os/scripts/backup-db.sh —
# pour fonctionner à l'identique en local (Mac) et en prod. Ce wrapper est
# le point d'entrée VPS/cron.
#
# Sauvegardes produites :
#   apps/lesgriots-os/data/backups/lesgriots-YYYYMMDD-HHMM.db.gz
#
# Cron quotidien à 3h (crontab du user deployment : `sudo -u deployment crontab -e`) :
#   0 3 * * * /var/www/ecosystem/production/lesgriots-platform/infra/scripts/backup.sh >> /var/log/lesgriots-os-backup.log 2>&1
#
# 💡 Penser à copier régulièrement data/backups/ HORS du VPS
#    (rsync vers le Mac / Dropbox) pour survivre à une panne disque OVH.

set -euo pipefail

REPO_PATH="${REPO_PATH:-/var/www/ecosystem/production/lesgriots-platform}"
OS_BACKUP_SCRIPT="$REPO_PATH/apps/lesgriots-os/scripts/backup-db.sh"

if [[ ! -x "$OS_BACKUP_SCRIPT" ]]; then
  echo "✗ Script introuvable ou non exécutable : $OS_BACKUP_SCRIPT" >&2
  echo "  (l'app OS est-elle bien déployée dans apps/lesgriots-os ? cf. docs/DEPLOY-OS.md)" >&2
  exit 1
fi

exec "$OS_BACKUP_SCRIPT"
