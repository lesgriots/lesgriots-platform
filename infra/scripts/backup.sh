#!/usr/bin/env bash
#
# backup.sh — sauvegarde la base SQLite du dashboard.
# À lancer SUR le VPS (manuellement ou via un cron quotidien).
#
# La base n'étant pas dans Git, c'est la seule protection contre une perte
# de données. Garde les 14 dernières sauvegardes.

set -euo pipefail

DB="/srv/dashboard/data/lesgriots.db"
BACKUP_DIR="/srv/backups/dashboard"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"

mkdir -p "$BACKUP_DIR"

# .backup = méthode propre SQLite (cohérente même si le serveur écrit en même temps)
sqlite3 "$DB" ".backup '$BACKUP_DIR/lesgriots_$STAMP.db'"

# Compression
gzip "$BACKUP_DIR/lesgriots_$STAMP.db"

echo "✓ Sauvegarde : $BACKUP_DIR/lesgriots_$STAMP.db.gz"

# Rotation : ne garder que les 14 plus récentes
ls -1t "$BACKUP_DIR"/lesgriots_*.db.gz | tail -n +15 | xargs -r rm --
echo "✓ Rotation effectuée (14 dernières conservées)."

# Pour un cron quotidien à 3h du matin, ajouter dans `crontab -e` :
#   0 3 * * * /srv/dashboard/../lesgriots-platform/infra/scripts/backup.sh >> /var/log/dashboard-backup.log 2>&1
