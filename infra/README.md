# Infra — déploiement & serveur

Tout ce qui sert à mettre en ligne et faire tourner la plateforme sur le VPS.

```
infra/
├── nginx/                  # 1 vhost par site + 1 pour l'admin
│   ├── lesgriots.conf
│   ├── lagriotheque.conf
│   ├── lesgriotsxstudio.conf
│   └── admin.conf          # reverse proxy vers le dashboard (port 3000)
├── systemd/
│   └── dashboard.service   # fait tourner le dashboard en permanence
└── scripts/
    ├── deploy.sh           # déployer une app (depuis ta machine)
    └── backup.sh           # sauvegarder la base SQLite (sur le VPS)
```

## Cible

VPS OVH (Strasbourg) — Ubuntu 24.04 LTS — `51.210.4.77`.

## Mémo

- Déployer un site : `./scripts/deploy.sh lesgriots` (depuis ta machine, après `git push`)
- Déployer le dashboard : `./scripts/deploy.sh dashboard`
- Les confs nginx vont dans `/etc/nginx/sites-available/` (lien dans `sites-enabled/`)
- Le service systemd va dans `/etc/systemd/system/dashboard.service`
- HTTPS : géré par Certbot (il édite les confs nginx tout seul)

Procédure complète : [../docs/DEPLOY.md](../docs/DEPLOY.md).
