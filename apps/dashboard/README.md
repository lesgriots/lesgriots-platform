# Dashboard — App de gestion interne LES GRIOTS

Application d'administration interne : pilotage des projets, clients, prestataires, dépenses, tâches (Kanban PPM) et génération de devis PDF. C'est l'outil de gestion quotidien de la SASU.

## Stack

- **Next.js 15** (App Router)
- **better-sqlite3** — base de données locale (`data/lesgriots.db`)
- **Python reportlab** — génération des devis PDF
- **Serveur MCP** (`mcp-server.js`) — accès depuis Claude

## Lancer en local

```bash
cd apps/dashboard
npm install
npm run dev
```

Puis ouvrir http://localhost:3000

## ⚠️ Règles critiques (ne pas casser)

1. **Chemin DB** : toujours `path.join(process.cwd(), 'data', 'lesgriots.db')` dans `src/lib/db.mjs`. Jamais `import.meta.url` (Next.js le recompile vers un mauvais dossier → DB fantôme vide).
2. **Écrire en base via l'API REST ou le MCP, jamais via Python directement** : le serveur garde une connexion SQLite en mémoire. Une écriture Python directe n'est pas vue par le serveur et peut corrompre le WAL.
3. **La base active est `data/lesgriots.db`** (jamais `lesgriots.db` à la racine).

## ⚠️ La base de données n'est PAS dans Git

`data/lesgriots.db` est volontairement gitignored : c'est de la donnée (avec des infos clients), pas du code. **Conséquence : elle n'est sauvegardée nulle part par défaut.** Voir [docs/SECRETS.md](../../docs/SECRETS.md) et le script `infra/scripts/backup.sh` pour la stratégie de sauvegarde.

## Migrations DB

Toutes les migrations sont dans `src/lib/db.mjs` → `initSchema()`. Elles s'exécutent automatiquement au démarrage. Pattern :

```js
const cols = db.prepare("PRAGMA table_info(ma_table)").all().map(c => c.name);
if (!cols.includes('nouveau_champ')) {
  db.exec("ALTER TABLE ma_table ADD COLUMN nouveau_champ TEXT DEFAULT ''");
}
```

## Tables principales

`projects`, `clients`, `client_contacts`, `providers`, `expenses`, `tasks`, `ppm_logs`.

Piliers : `STUDIO` · `PROD` · `GRIOTHEQUE`
Stages : `lead → need → qualify → quoted → negotiation → signed → active → delivered → paid → lost`

## En production

Tourne en service systemd derrière nginx en reverse proxy, sur le sous-domaine `admin.` (protégé par HTTP Basic auth en plus du login interne). Voir [docs/DEPLOY.md](../../docs/DEPLOY.md).
