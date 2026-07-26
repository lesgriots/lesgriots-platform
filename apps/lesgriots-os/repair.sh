#!/bin/bash
# LES GRIOTS OS — Script de réparation DB
# Usage : double-clique ou ./repair.sh dans le terminal

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB="$SCRIPT_DIR/data/lesgriots.db"
BACKUP="$SCRIPT_DIR/data/lesgriots.db.bak_$(date +%Y%m%d_%H%M%S)"

echo "🔧 LES GRIOTS OS — Réparation DB"
echo ""

# 1. Arrêter le serveur
echo "⏹  Arrêt du serveur..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 2

# 2. Vérifier que la DB existe
if [ ! -f "$DB" ]; then
  echo "❌ DB introuvable : $DB"
  exit 1
fi

echo "📦 Backup : $BACKUP"
cp "$DB" "$BACKUP"

# 3. Dump + restauration propre
echo "🛠  Reconstruction de la base..."
python3 - <<PYEOF
import sqlite3, os, shutil

db_path = "$DB"
tmp_path = "/tmp/lesgriots_repair.db"

# Dump
src = sqlite3.connect(db_path)
dump = list(src.iterdump())
src.close()
print(f"   {len(dump)} lignes exportées")

# Recréer proprement
if os.path.exists(tmp_path):
    os.remove(tmp_path)

dst = sqlite3.connect(tmp_path)
dst.executescript('\n'.join(dump))
result = dst.execute('PRAGMA integrity_check').fetchone()
dst.commit()
dst.close()

if result != ('ok',):
    print(f"❌ Integrity check failed: {result}")
    exit(1)

# Vérifier les données
check = sqlite3.connect(tmp_path)
projets = check.execute('SELECT count(*) FROM projects').fetchone()[0]
clients = check.execute('SELECT count(*) FROM clients').fetchone()[0]
prestats = check.execute('SELECT count(*) FROM providers').fetchone()[0]
check.close()

print(f"   ✅ {projets} projets, {clients} clients, {prestats} prestataires")

# Remplacer
shutil.copy(tmp_path, db_path)
os.remove(tmp_path)

# Nettoyer WAL
for ext in ['-wal', '-shm']:
    p = db_path + ext
    if os.path.exists(p):
        os.remove(p)
        print(f"   🗑  {ext} supprimé")

print("   DB reconstruite avec succès")
PYEOF

# 4. Relancer le serveur
echo ""
echo "🚀 Redémarrage du serveur..."
cd "$SCRIPT_DIR"
npm run dev
