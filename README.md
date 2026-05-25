# LES GRIOTS — Plateforme Web

Monorepo de LES GRIOTS SASU. Regroupe les **3 sites publics** (plateforme éditoriale, formations, agence créative) et l'**app de gestion interne** (dashboard projets / clients / prestataires / devis).

Développé en local, déployé sur le VPS OVH. Une seule source de vérité, un seul `git clone`.

## Structure

```
lesgriots-platform/
├── apps/
│   ├── lesgriots/          # plateforme éditoriale (statique)
│   ├── lagriotheque/       # formations / La Griothèque (statique)
│   ├── lesgriotsxstudio/   # agence créative (statique)
│   └── dashboard/          # app de gestion interne (Next.js + SQLite)
├── infra/                  # nginx, systemd, scripts de déploiement
└── docs/                   # ARCHITECTURE, DEPLOY, SECRETS, ONBOARDING
```

## Lancer en local

Chaque app a son propre README avec la procédure exacte :

- [apps/lesgriots/README.md](apps/lesgriots/README.md)
- [apps/lagriotheque/README.md](apps/lagriotheque/README.md)
- [apps/lesgriotsxstudio/README.md](apps/lesgriotsxstudio/README.md)
- [apps/dashboard/README.md](apps/dashboard/README.md)

## Déploiement

Tout est documenté dans [docs/DEPLOY.md](docs/DEPLOY.md).

TL;DR : `cd infra && ./scripts/deploy.sh <nom-app>`

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — comment les apps s'articulent
- [docs/DEPLOY.md](docs/DEPLOY.md) — procédure de déploiement sur le VPS
- [docs/SECRETS.md](docs/SECRETS.md) — gestion des secrets et variables d'env
- [docs/ONBOARDING.md](docs/ONBOARDING.md) — pour un nouveau dev / une agence

## Contact

Moos Coulibaly — LES GRIOTS SASU
