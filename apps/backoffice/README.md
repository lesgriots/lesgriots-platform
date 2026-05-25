# Back Office — LESGRIOTSxSTUDIO

Petite app Next.js qui pilote le contenu du site studio (`../data.jsx`).

- **Stack** : Next.js 14 (App Router) + SQLite (better-sqlite3) + auth HTTP Basic.
- **Pas couplé au site** : c'est un dossier autonome. Le site reste 100 % statique.
- **Sync** : un bouton "Sync vers le site" régénère `../data.jsx` à partir de la DB.
- **Uploads** : les médias ajoutés via le formulaire vont directement dans `../img/`.

---

## Installation (première fois)

```bash
cd backoffice
npm install
cp .env.local.example .env.local
# ouvre .env.local et change ADMIN_PASSWORD
```

## Importer les projets actuels (seed)

À faire **une seule fois** pour amorcer la base avec ce qui est déjà dans `../data.jsx`.

```bash
node scripts/seed.mjs
```

Idempotent — si tu le rejoues, les projets existants sont remplacés (par id).

## Lancer le back office

```bash
npm run dev
```

→ ouvrir [http://localhost:3030](http://localhost:3030)

L'auth Basic demande :
- user : `admin`
- mot de passe : ce qui est dans `.env.local`

---

## Workflow quotidien

1. **Créer ou éditer** un projet via l'interface (les médias sont uploadés dans `../img/`).
2. Quand t'es content, clique **"Sync vers le site"** en haut à droite.
3. `data.jsx` est régénéré. Le site charge automatiquement les nouveaux projets — aucun build.

> Tu peux toujours éditer `data.jsx` à la main si tu veux. Mais re-seeder l'écraserait. Mieux : passer par l'UI.

---

## Champs d'un projet

| Champ        | Type                  | Notes                                            |
|--------------|------------------------|--------------------------------------------------|
| `id`         | string (slug)          | Immuable. Sert d'URL et de clé primaire.        |
| `position`   | int                    | Ordre dans la liste (asc).                       |
| `name`       | string                 | Titre affiché.                                   |
| `role`       | string \| string[]     | "Simple" ou "Multi" (séparé par `/` au rendu).   |
| `client`     | string                 |                                                  |
| `date`       | string                 | Format libre (ex `2025`).                        |
| `location`   | string                 |                                                  |
| `cover`      | string (path)          | Image principale (visible sur la home).          |
| `thumbVideo` | string (path) optional | mp4 court lu au hover.                           |
| `strip`      | string[] (paths)       | Carrousel d'images en haut de la fiche.          |
| `resources`  | object[]               | Bloc médias : `{type, src, poster?, label, aspect?}`. |
| `credits`    | object {RÔLE: noms[]}  | Crédits affichés en bas de fiche.                |
| `tags`       | string[]               |                                                  |
| `hidden`     | bool                   | Si vrai, le projet n'est PAS exporté.            |

---

## Sécurité

- `.env.local` n'est jamais commité (`.gitignore`).
- `studio.db` n'est jamais commité (`.gitignore`).
- L'auth Basic protège **toute** l'app — UI, API, uploads.
- Les uploads sont confinés à `../img/` ou `../img/<subdir>/` (slug propre).
- Le preview API (`/api/preview`) résout les chemins et refuse toute traversée hors du dossier site.

---

## API

| Méthode | Route                     | Action                                     |
|---------|---------------------------|--------------------------------------------|
| GET     | `/api/projects`           | Liste tous les projets                     |
| POST    | `/api/projects`           | Crée un projet (JSON body)                 |
| GET     | `/api/projects/:id`       | Lit un projet                              |
| PUT     | `/api/projects/:id`       | Met à jour                                 |
| DELETE  | `/api/projects/:id`       | Supprime                                   |
| POST    | `/api/upload`             | Upload multipart (champ `file`, opt `subdir`) → renvoie `{path, bytes}` |
| POST    | `/api/export`             | Régénère `../data.jsx` depuis la DB        |
| GET     | `/api/preview?p=…`        | Renvoie un média depuis `../` (preview UI) |

---

## Reset complet

```bash
rm studio.db studio.db-wal studio.db-shm
node scripts/seed.mjs   # recharger depuis data.jsx
```
