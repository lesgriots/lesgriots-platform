# LES GRIOTS OS

Outil de pilotage Next.js + SQLite pour LES GRIOTS SASU — Agence, Production & Formations.

## Installation (Mac)

```bash
# 1. Entrer dans le dossier
cd lesgriots-os

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur de développement
npm run dev
```

Ouvre http://localhost:3000 dans ton navigateur.

## Stack

- **Next.js 15** — React framework
- **better-sqlite3** — base de données locale (module natif, nécessite une toolchain C++ à l'install)
- **Python 3 + reportlab** — génération des PDF (`src/lib/generate_*.py`)
- **Recharts** — graphiques et data viz
- **Serveur MCP** (`mcp-server.js`) — accès depuis Claude (header `x-api-key`)

## Variables d'environnement

Copier `.env.example` vers `.env.local` et remplir (Google OAuth, `AUTH_SECRET`,
`OS_API_KEY`…). Les commandes de génération des secrets sont commentées dedans.

## Données

Tes données sont stockées dans `data/lesgriots.db` (créé automatiquement au premier lancement).
La base n'est **pas** dans Git.

Sauvegarde à chaud (WAL-safe) + rotation 30 :

```bash
./scripts/backup-db.sh
# → data/backups/lesgriots-YYYYMMDD-HHMM.db.gz
```

## Déploiement

Le déploiement en production (VPS OVH) est piloté par le monorepo
**`lesgriots-platform`** — l'app est destinée à vivre dans
`lesgriots-platform/apps/lesgriots-os/` :

- **Procédure complète de mise en prod** : `lesgriots-platform/docs/DEPLOY-OS.md`
  (prérequis, transfert de la DB, nginx, systemd, certbot, DNS, backups, rollback)
- **Unité systemd** : `lesgriots-platform/infra/systemd/lesgriots-os.service` (port 3010)
- **Vhost nginx** : `lesgriots-platform/infra/nginx/lesgriots-os.conf` → https://os.lesgriots.com
- **Déploiement courant** : `lesgriots-platform/infra/scripts/deploy.sh os`
- **Secrets** : `lesgriots-platform/docs/SECRETS.md` (en prod : `/etc/lesgriots-os.env`)
