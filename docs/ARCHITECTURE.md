# Architecture

Vue d'ensemble : qui fait quoi, où vit la donnée.

## Convention back-offices (2026-07)

Tous les back-offices vivent sous **un seul hub** : `admin.lesgriots.com`, un
sous-path par pilier. `lesgriots.com` est la marque-mère → `admin.lesgriots.com`
est l'admin-mère. Un seul certificat, un seul Basic auth, un seul bookmark.

| Pilier      | URL admin                              | Port  | basePath Next.js | Service systemd            |
|-------------|----------------------------------------|-------|------------------|----------------------------|
| Studio      | `admin.lesgriots.com/studio/`          | 3030  | `/studio`        | `lesgriotsxstudio-backoffice` |
| Griothèque  | `admin.lesgriots.com/griotheque/`      | 3031  | `/griotheque`    | (BO Griothèque)            |
| Les Griots  | `admin.lesgriots.com/lesgriots/`       | 3032  | `/lesgriots`     | `lesgriots-backoffice`     |

Règles :
- 1 pilier = 1 sous-path `/<pilier>/` + 1 port dédié + 1 service systemd + `basePath: "/<pilier>"` en prod.
- Reverse proxy nginx **sans slash final** (`proxy_pass http://127.0.0.1:<port>;`) pour préserver le préfixe (sinon les assets `_next/` cassent).
- `os.lesgriots.com` (LES GRIOTS OS, port 3010) reste **hors** du hub : pas de basePath, pas de Basic auth (casserait son MCP et l'OAuth Google).
- L'ancien `admin.lagriotheque.com` **redirige** (301) vers `admin.lesgriots.com/griotheque/`.

Quand un pilier pourrait être cédé/vendu séparément, on repasserait ce pilier
sur son propre sous-domaine d'admin — mais tant que tout appartient à LES GRIOTS
SASU, le hub centralisé prime.

## Schéma

```
        ┌──────────────────────────── PUBLIC (HTTPS) ────────────────────────────┐
        │                                                                         │
   ┌────────────┐      ┌──────────────┐      ┌────────────────────┐
   │ lesgriots  │      │ lagriotheque │      │ lesgriotsxstudio   │
   │ éditorial  │      │ formations   │      │ agence créative    │
   │ (statique) │      │ (statique)   │      │ (statique)         │
   └────────────┘      └──────────────┘      └────────────────────┘
                                                                          │
        └───────────────────── PRIVÉ (HTTPS + auth) ─────────────────────┘
                                      │
                          ┌───────────────────────┐
                          │  dashboard (admin.)    │
                          │  Next.js, port 3000    │
                          │  → reverse proxy nginx │
                          └───────────┬───────────┘
                                      │
                          ┌───────────────────────┐
                          │  data/lesgriots.db     │
                          │  (SQLite, sur disque)  │
                          └───────────────────────┘
```

## Les 4 apps

| App | Rôle | Type | Accès |
|-----|------|------|-------|
| `lesgriots` | Plateforme éditoriale | Statique | Public |
| `lagriotheque` | Formations (Qualiopi) | Statique | Public |
| `lesgriotsxstudio` | Agence créative | Statique | Public |
| `dashboard` | Gestion interne (projets, clients, devis) | Next.js + SQLite | Privé (admin.) |

## Où vit la donnée

- **Sites statiques** : leur contenu est dans leur propre code (`.jsx` en dur). Indépendants les uns des autres.
- **Dashboard** : toute la donnée métier (projets, clients, prestataires, dépenses) est dans `data/lesgriots.db` (SQLite). Cette base **n'est pas dans Git** → voir la stratégie de sauvegarde dans [SECRETS.md](SECRETS.md) et `infra/scripts/backup.sh`.

> ⚠️ **À confirmer** : si le dashboard exporte encore un `data.jsx` vers le site `lesgriotsxstudio` (ancien couplage backoffice → studio), ce chemin devra être vérifié après restructuration. Sinon, ignorer ce point.

## Décisions techniques

- **Monorepo** : 4 apps liées, un seul `git clone`, déploiement coordonné, doc centralisée.
- **Pas de build pour les sites statiques** : simplicité maximale, nginx sert les fichiers tels quels. Si besoin d'optimisation plus tard → Vite.
- **SQLite pour le dashboard** : zéro serveur de DB à administrer, suffisant pour le volume actuel. Migration vers Postgres triviale si ça grossit.
- **Nginx en reverse proxy** devant le dashboard : l'app écoute en local sur 3000, nginx l'expose en HTTPS sur `admin.`.
- **Double auth sur l'admin** : HTTP Basic (nginx) + login interne de l'app.
- **Pas de Docker au début** : YAGNI. 3 sites statiques + 1 app Node se gèrent très bien avec nginx + systemd.
