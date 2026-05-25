# Architecture

Vue d'ensemble : qui fait quoi, où vit la donnée.

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
