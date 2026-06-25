# Déploiement en production

## Cible

VPS OVH (Strasbourg) — Ubuntu 24.04 LTS — `51.210.4.77` — 6 vCores, 12 Go RAM, 100 Go SSD.

## Architecture cible

```
PUBLIC :
  lesgriotsxstudio.com    → site Studio          (statique)
  lagriotheque.com        → site Griothèque      (statique, à venir)
  lesgriots.com           → landing holding      (à venir)

ADMIN (centralisé) :
  admin.lesgriots.com/             → hub admin de tout l'écosystème
    ├── /studio/                   → BO Studio        (Next.js port 3030)
    ├── /griotheque/               → BO Griothèque    (à venir, port 3031)
    └── ...                        → futurs BO
```

Un seul certificat SSL pour `admin.lesgriots.com`, isolation des cookies des sites publics, hub admin unique.

## Pré-requis (une seule fois)

Le VPS doit être provisionné : SSH par clé, user `debian` (SSH) + user `deployment` (owns code), firewall UFW (ports 22/80/443), fail2ban, nginx, certbot, Node.js 20 LTS, sqlite3.

Structure cible sur le VPS :

```
/var/www/ecosystem/production/lesgriots-platform/   # clone monorepo (user deployment)
  ├── apps/
  │   ├── lesgriotsxstudio/        # servi par nginx en statique
  │   ├── lagriotheque/            # idem (à venir)
  │   ├── backoffice/              # BO Studio Next.js (systemd, port 3030)
  │   └── backoffice-griotheque/   # BO Griothèque (à venir, port 3031)
  └── infra/                       # confs & scripts (référence)

/etc/nginx/sites-available/        # confs nginx
/etc/systemd/system/               # services systemd
/etc/nginx/.htpasswd               # Basic auth admin.lesgriots.com
/etc/lesgriotsxstudio-backoffice.env  # secrets BO (hors-Git)
```

## DNS (à faire une fois)

Chez OVH, pour chaque domaine :

- `lesgriotsxstudio.com`     → A `51.210.4.77` + AAAA `2001:41d0:404:200::4537`
- `www.lesgriotsxstudio.com` → A `51.210.4.77` + AAAA même
- `admin.lesgriots.com`      → A `51.210.4.77` + AAAA même

> ⚠️ Toucher au DNS a un effet immédiat (TTL = 1h). À faire posément, domaine par domaine.

## Premier déploiement Studio (procédure complète)

### 1. Sur le VPS — provisioning initial

```bash
# Clone du monorepo (user deployment)
sudo -u deployment git clone https://github.com/lesgriots/lesgriots-platform.git \
  /var/www/ecosystem/production/lesgriots-platform

# Installation des deps du BO
cd /var/www/ecosystem/production/lesgriots-platform/apps/backoffice
sudo -u deployment npm install --omit=dev
sudo -u deployment npm run build

# Copier les confs nginx
sudo cp /var/www/ecosystem/production/lesgriots-platform/infra/nginx/lesgriotsxstudio.conf \
  /etc/nginx/sites-available/
sudo cp /var/www/ecosystem/production/lesgriots-platform/infra/nginx/admin.conf \
  /etc/nginx/sites-available/admin.lesgriots.com.conf

# Activer
sudo ln -s /etc/nginx/sites-available/lesgriotsxstudio.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/admin.lesgriots.com.conf /etc/nginx/sites-enabled/

# Créer le .htpasswd (Basic auth)
sudo htpasswd -c /etc/nginx/.htpasswd moos
# Mot de passe demandé interactivement

# Tester puis recharger nginx
sudo nginx -t
sudo systemctl reload nginx

# Service systemd pour le BO
sudo cp /var/www/ecosystem/production/lesgriots-platform/infra/systemd/lesgriotsxstudio-backoffice.service \
  /etc/systemd/system/

# Créer le fichier env (variables hors-Git)
sudo nano /etc/lesgriotsxstudio-backoffice.env
# Y mettre :
#   ADMIN_PASSWORD=<mot-de-passe-app-BO>

sudo systemctl daemon-reload
sudo systemctl enable --now lesgriotsxstudio-backoffice
sudo systemctl status lesgriotsxstudio-backoffice
```

### 2. HTTPS via Certbot

```bash
sudo certbot --nginx -d lesgriotsxstudio.com -d www.lesgriotsxstudio.com
sudo certbot --nginx -d admin.lesgriots.com
```

Certbot ajoute les blocs HTTPS automatiquement et configure le renouvellement.

### 3. Pousser les vidéos (depuis ta machine locale)

```bash
cd ~/Downloads/lesgriots-platform/infra
./scripts/deploy-videos.sh studio
```

Les vidéos `.web.mp4` + covers sont rsync vers le VPS. **Ne sont jamais dans Git** (cf `.gitignore`).

## Déploiements suivants — workflow

### Mise à jour du site Studio (statique)

```bash
# Sur ta machine
git push                                       # push tes changements
cd ~/Downloads/lesgriots-platform/infra
./scripts/deploy.sh studio                     # git pull sur le VPS
```

Effet immédiat — nginx sert les nouveaux fichiers.

### Mise à jour du BO Studio (Next.js)

```bash
git push
./scripts/deploy.sh studio-bo                  # git pull + npm install + build + restart
```

Downtime : ~5 secondes pendant le restart systemd.

### Pousser de nouvelles vidéos

```bash
# Tu déposes ta vidéo dans apps/lesgriotsxstudio/img/, tu la convertis si besoin
./scripts/deploy-videos.sh studio
```

## Rollback (si un déploiement casse tout)

```bash
ssh debian@51.210.4.77
cd /var/www/ecosystem/production/lesgriots-platform
sudo -u deployment git log --oneline -5
sudo -u deployment git checkout <commit-précédent>
# pour le BO uniquement :
cd apps/backoffice
sudo -u deployment npm run build
sudo systemctl restart lesgriotsxstudio-backoffice
```

Pour revenir à la dernière version stable : `git checkout main`.

## Vérifications post-deploy

```bash
curl -I https://lesgriotsxstudio.com           # → 200 OK
curl -I https://admin.lesgriots.com/studio/    # → 401 (Basic auth — normal)
sudo systemctl status lesgriotsxstudio-backoffice  # → active (running)
```

## Maintenance courante

- **Logs nginx** : `sudo journalctl -u nginx -f`
- **Logs BO** : `sudo journalctl -u lesgriotsxstudio-backoffice -f`
- **Espace disque** : `df -h`
- **RAM** : `htop`
- **Renouvellement certifs** : auto (cron certbot). Vérifier : `sudo certbot certificates`

## Ajouter un nouveau pilier admin (futur)

Quand le BO Griothèque ou Production sera prêt :

1. Service systemd dédié (`apps/<pilier>` + port différent)
2. Décommenter le bloc `location /<pilier>/` dans `infra/nginx/admin.conf`
3. `sudo cp` + `sudo nginx -t && sudo systemctl reload nginx`
4. C'est tout — le sous-path est actif sous `admin.lesgriots.com/<pilier>/`

Le certif HTTPS est déjà couvert (1 seul cert pour `admin.lesgriots.com`).
