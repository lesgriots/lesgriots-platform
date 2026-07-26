#!/usr/bin/env bash
#
# backup-db.sh — sauvegarde à chaud de la base SQLite de LES GRIOTS OS.
#
# Utilise `sqlite3 .backup` : copie cohérente même si le serveur Next.js
# écrit en même temps (WAL-safe), contrairement à un simple `cp` qui peut
# produire un fichier corrompu.
#
# Sortie : data/backups/lesgriots-YYYYMMDD-HHMM.db.gz
# Rotation : garde les 30 sauvegardes les plus récentes.
#
# Usage :
#   ./scripts/backup-db.sh
#
# Variables surchargables :
#   DB_PATH     chemin de la base       (défaut : <app>/data/lesgriots.db)
#   BACKUP_DIR  dossier des sauvegardes (défaut : <app>/data/backups)
#   KEEP        nombre de sauvegardes conservées (défaut : 30)
#
# Cron quotidien sur le VPS (3h du matin), dans `crontab -e` du user
# `deployment` :
#   0 3 * * * /var/www/ecosystem/production/lesgriots-platform/apps/lesgriots-os/scripts/backup-db.sh >> /var/log/lesgriots-os-backup.log 2>&1

set -euo pipefail

# Dossier de l'app = parent du dossier scripts/ (résolu dynamiquement :
# fonctionne en local sur le Mac comme sur le VPS).
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DB_PATH="${DB_PATH:-$APP_DIR/data/lesgriots.db}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/data/backups}"
KEEP="${KEEP:-30}"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "✗ sqlite3 introuvable (Ubuntu : sudo apt install sqlite3)" >&2
  exit 1
fi

if [[ ! -f "$DB_PATH" ]]; then
  echo "✗ Base introuvable : $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M)"
TARGET="$BACKUP_DIR/lesgriots-$STAMP.db"

# Sauvegarde à chaud (WAL-safe)
sqlite3 "$DB_PATH" ".backup '$TARGET'"
gzip -f "$TARGET"
echo "✓ Sauvegarde : $TARGET.gz"

# Rotation : garder les $KEEP plus récentes.
# Le timestamp YYYYMMDD-HHMM dans le nom rend le tri lexical inverse
# équivalent à un tri chronologique (du plus récent au plus ancien).
count=0
while IFS= read -r f; do
  count=$((count + 1))
  if ((count > KEEP)); then
    rm -f -- "$f"
    echo "  rotation : $(basename "$f") supprimée"
  fi
done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'lesgriots-*.db.gz' | sort -r)

echo "✓ Rotation OK ($KEEP sauvegardes max conservées)."
