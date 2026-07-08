# Infra — déploiement & serveur

Tout ce qui sert à mettre en ligne et faire tourner la plateforme sur le VPS.

```
infra/
├── nginx/                  # 1 vhost par site + 1 pour l'admin
│   ├── lesgriots.conf
│   ├── lagriotheque.conf
│   ├── lesgriotsxstudio.conf
│   ├── admin.conf          # hub admin (Basic auth) — BO Studio port 3030
│   └── lesgriots-os.conf   # LES GRIOTS OS → os.lesgriots.com (port 3010, pas de Basic auth)
├── systemd/
│   ├── lesgriotsxstudio-backoffice.service   # BO Studio (port 3030)
│   ├── lesgriots-os.service                  # LES GRIOTS OS (port 3010)
│   └── dashboard.service                     # obsolète (remplacé par lesgriots-os)
└── scripts/
    ├── install-vps.sh      # provisioning initial du VPS (root, une fois)
    ├── add-bo-studio.sh    # ajout du BO Studio sur VPS déjà setup
    ├── deploy.sh           # déployer une app (depuis ta machine)
    ├── deploy-videos.sh    # rsync des vidéos du site Studio
    └── backup.sh           # sauvegarde de la base SQLite de l'OS (sur le VPS, cron)
```

## Cible

VPS OVH (Strasbourg) — Ubuntu 24.04 LTS — `51.210.4.77`.

## Mémo

- Déployer un site statique : `./scripts/deploy.sh lesgriots` (depuis ta machine, après `git push`)
- Déployer le BO Studio : `./scripts/deploy.sh studio-bo`
- Déployer LES GRIOTS OS : `./scripts/deploy.sh os`
- Les confs nginx vont dans `/etc/nginx/sites-available/` (lien dans `sites-enabled/`)
- Les services systemd vont dans `/etc/systemd/system/`
- Les secrets de prod vont dans `/etc/<nom>.env` (chmod 600, chargés par systemd)
- HTTPS : géré par Certbot (il édite les confs nginx tout seul)
- Backup DB de l'OS : cron quotidien → `./scripts/backup.sh` (rotation 30)

Procédures complètes : [../docs/DEPLOY.md](../docs/DEPLOY.md) (sites + BO Studio)
et [../docs/DEPLOY-OS.md](../docs/DEPLOY-OS.md) (LES GRIOTS OS).
