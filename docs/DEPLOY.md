# Déploiement en production

## Cible

VPS OVH (Strasbourg) — Ubuntu 24.04 LTS — `51.210.4.77` — 6 vCores, 12 Go RAM, 100 Go SSD.

## Pré-requis (une seule fois)

Le VPS doit être provisionné : SSH par clé, user non-root `moos`, firewall UFW (ports 22/80/443), fail2ban, nginx, certbot, Node.js. → étape « provisioning » à faire avant le premier déploiement.

Structure cible sur le VPS :

```
/srv/
├── lesgriots/           # git clone du site (sous-dossier apps/lesgriots)
├── lagriotheque/
├── lesgriotsxstudio/
├── dashboard/
└── backups/dashboard/   # sauvegardes SQLite
```

> Astuce : tu peux soit cloner tout le monorepo une fois et faire pointer nginx vers `lesgriots-platform/apps/<site>`, soit déployer chaque app dans son propre `/srv/<app>`. Le plus simple pour démarrer : cloner tout le monorepo dans `/srv/lesgriots-platform` et adapter les `root` nginx.

## DNS (à faire une fois)

Pour chaque domaine, créer chez le registrar :
- un enregistrement **A** → `51.210.4.77`
- un enregistrement **AAAA** → l'IPv6 du VPS (`2001:41d0:404:200::4537`)

Sous-domaine admin : `admin.lesgriotsxstudio.com` → même IP.

> ⚠️ Toucher au DNS a un effet immédiat et peut casser un site en prod. À faire posément, domaine par domaine.

## Déployer un site statique

```bash
# Depuis ta machine, après avoir poussé sur GitHub
cd infra
./scripts/deploy.sh lesgriots
```

Le script fait : SSH → `git pull` côté serveur. C'est tout (statique). Le site est à jour immédiatement.

## Déployer le dashboard

```bash
cd infra
./scripts/deploy.sh dashboard
```

Le script fait : SSH → `git pull` → `npm install` → `npm run build` → `systemctl restart dashboard`. Downtime ~5 secondes.

## HTTPS (Certbot)

La première fois, sur le VPS :

```bash
sudo certbot --nginx -d lesgriots.com -d www.lesgriots.com
sudo certbot --nginx -d lagriotheque.com -d www.lagriotheque.com
sudo certbot --nginx -d lesgriotsxstudio.com -d www.lesgriotsxstudio.com
sudo certbot --nginx -d admin.lesgriotsxstudio.com
```

Certbot ajoute tout seul les blocs HTTPS dans les confs nginx et configure le renouvellement automatique.

## Rollback (si un déploiement casse tout)

```bash
ssh moos@51.210.4.77
cd /srv/<app>
git log --oneline -5
git checkout <commit-précédent>
# pour le dashboard uniquement :
sudo systemctl restart dashboard
```

Pour revenir à la dernière version stable : `git checkout main`.

## Vérifications post-deploy

```bash
curl -I https://lesgriots.com              # → 200 OK
sudo systemctl status dashboard            # → active (running)
curl -I https://admin.lesgriotsxstudio.com # → 401 (auth requise = normal)
```

## Maintenance courante

- Logs nginx : `sudo journalctl -u nginx -f`
- Logs dashboard : `sudo journalctl -u dashboard -f`
- Espace disque / RAM : `df -h` · `htop`
- Sauvegarde DB : `./scripts/backup.sh` (idéalement en cron quotidien)
