# Backoffice Griothèque

Admin Next.js pour gérer les contenus du site `apps/lagriotheque/` : formations, workshops, intervenants, sessions, ressources, et textes mutualisés.

## Stack

- Next.js 14.2.5 (App Router)
- Stockage JSON local (`griotheque.json`, gitignored)
- HTTP Basic Auth (`ADMIN_PASSWORD` dans `.env.local`)
- Port 3031 (pour cohabiter avec le backoffice studio sur 3030)

## Lancer en local

```bash
cd apps/backoffice-griotheque
npm install                  # première fois uniquement
cp .env.local.example .env.local  # créer le fichier de config
# Éditer .env.local et mettre ADMIN_PASSWORD=<mot-de-passe>
npm run dev
```

Puis ouvrir http://localhost:3031 (utilisateur: `admin`, mot de passe: celui défini dans `.env.local`).

## Structure des données

| Collection | Description | Champs principaux |
|---|---|---|
| `formations` | Formations longues (1-3 jours) | title, tagline, overview, discipline, media, duration, format, location, price, cpf/opco, trainer, description, audience, prerequisites, objectives, chapters, program |
| `workshops` | Formats courts | mêmes champs en plus léger |
| `trainers` | Intervenants | name, role, bio, photo |
| `sessions` | Dates concrètes | date, formation_id (ou workshop_id), places, status |
| `resources` | Téléchargeables | title, type, format, href, available |
| `defaults` | Textes mutualisés | methods, evaluation, accessibility, location |

## Comment ça marche

1. Édite les contenus dans l'admin (http://localhost:3031)
2. Clique "↳ Exporter vers le site" — ça régénère `apps/lagriotheque/data.jsx`
3. Recharge `http://localhost:8082` (site griothèque) pour voir les changements

Le site fonctionne en autonomie même si le backoffice est éteint — il lit `data.jsx` qui contient une copie statique.

## Defaults (textes mutualisés)

Les 4 textes `methods`, `evaluation`, `accessibility`, `location` peuvent être utilisés en fallback sur chaque formation/workshop. Si un de ces champs est vide dans une formation, l'export émet `location: DEFAULT_LOCATION` au lieu d'un littéral. Permet de changer le texte d'un coup pour toutes les formations.

## Architecture des fichiers

```
backoffice-griotheque/
├── app/
│   ├── page.jsx                    # Accueil : 6 cards (1 par entité)
│   ├── layout.jsx                  # Layout terminal + nav 6 sections
│   ├── formations/                 # /formations + /formations/[id]
│   ├── workshops/
│   ├── trainers/
│   ├── sessions/
│   ├── resources/
│   ├── defaults/                   # éditeur des 4 textes mutualisés
│   ├── api/
│   │   ├── formations/             # GET (list), POST (upsert) + [id] (GET/PUT/DELETE)
│   │   ├── workshops/, trainers/, sessions/, resources/
│   │   ├── defaults/               # GET, PUT
│   │   ├── export/                 # POST → régénère data.jsx
│   │   ├── preview/                # GET → sert les images du site
│   │   └── upload/                 # POST → upload dans lagriotheque/img/
│   └── components/
│       ├── EntityList.jsx          # Tableau générique réutilisé partout
│       └── Type.jsx                # Typewriter
├── lib/
│   ├── db.js                       # CRUD JSON sur griotheque.json
│   └── exporter.js                 # Génère lagriotheque/data.jsx
├── middleware.js                   # HTTP Basic Auth
└── griotheque.json                 # Base de données (gitignored)
```

## Variables d'environnement

| Variable | Description | Exemple |
|---|---|---|
| `ADMIN_PASSWORD` | Mot de passe HTTP Basic | `kJ8mN2pL...` |

## État actuel (Phase 1)

✅ **Fait**
- Squelette complet : nav, accueil, 5 listes + page defaults
- API CRUD pour les 6 entités
- Exporter générant le bon format `data.jsx`
- Auth HTTP Basic
- Style aligné sur le backoffice studio

🚧 **À venir**
- Formulaires d'édition pour chaque entité (création/édition)
- Seed initial : importer l'état actuel de `lagriotheque/data.jsx` dans `griotheque.json`
- Upload de médias (image ET vidéo) pour les formations
- Validation des champs
- Multi-utilisateurs (plus tard, quand pertinent)
