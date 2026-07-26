# Déploiement de LES GRIOTS OS

Procédure complète pour la **première mise en production** de LES GRIOTS OS
(pilotage Agence + Production + Formations), puis les mises à jour courantes.

## Fiche d'identité

| | |
|---|---|
| URL publique | `https://app.lagriotheque.com` |
| Port local | `3010` (convention : 3030 BO Studio · 3031 BO Griothèque) |
| Code sur le VPS | `/var/www/ecosystem/production/lesgriots-platform/apps/lesgriots-os/` |
| Unité systemd | `lesgriots-os` (`infra/systemd/lesgriots-os.service`) |
| Vhost nginx | `infra/nginx/app.lagriotheque.com.conf` → `/etc/nginx/sites-available/app.lagriotheque.com.conf` |
| Secrets prod | `/etc/lesgriots-os.env` (hors-Git, chmod 600) |
| Base de données | `apps/lesgriots-os/data/lesgriots.db` (SQLite, **jamais dans Git**) |
| Sauvegardes | `apps/lesgriots-os/data/backups/` (cron quotidien, rotation 30) |
| Stack | Next.js 15 · better-sqlite3 (module natif) · Python 3 + reportlab (PDF) |

**Pas de Basic auth nginx** sur ce sous-domaine (contrairement à
`admin.lesgriots.com`) : l'app a son propre login (Google OAuth + whitelist
utilisateurs + RBAC), et le serveur MCP s'authentifie par header `x-api-key`
— un Basic auth nginx bloquerait le MCP et le callback OAuth. Choix documenté
dans `infra/nginx/app.lagriotheque.com.conf`.

---

## 0. Intégrer l'app au monorepo (une seule fois, sur ton Mac)

L'app vit aujourd'hui **hors** du monorepo, dans `~/Claude Tools/lesgriots-os`
(repo git local sans remote). Elle doit être copiée dans
`apps/lesgriots-os/` du monorepo — **sans** `node_modules`, `.next`, `data`
(la base part par `scp`, pas par Git), ni le `.git` local, ni les `.env`.

```bash
cd ~/Downloads/lesgriots-platform

rsync -av \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='data/' \
  --exclude='.git/' \
  --exclude='.env*' \
  --exclude='__pycache__/' \
  --exclude='.DS_Store' \
  ~/Claude\ Tools/lesgriots-os/ \
  apps/lesgriots-os/

# Vérifier que rien de sensible ne part dans Git :
git status apps/lesgriots-os          # NE DOIT montrer NI .env NI *.db
git add apps/lesgriots-os
git commit -m "feat: intègre LES GRIOTS OS dans apps/lesgriots-os"
git push
```

> ⚠️ Le `.env.example` (modèle sans valeurs) **doit** être commité ; le
> `.env.local` (vraies valeurs) ne doit **jamais** l'être — le `.gitignore`
> de l'app le couvre, mais vérifie le `git status` avant de pousser.

Après ça, `~/Claude Tools/lesgriots-os` reste ta copie de travail locale si
tu veux, mais **la source de vérité du code devient le monorepo**. Pour
éviter les divergences, le plus simple est de travailler directement dans
`apps/lesgriots-os/` ensuite.

## 1. DNS chez OVH (une seule fois)

Sur la zone `lagriotheque.com` (manager OVH → Domaines → Zone DNS) :

| Type | Sous-domaine | Cible |
|------|--------------|-------|
| A    | `os`         | `51.210.4.77` |
| AAAA | `os`         | `2001:41d0:404:200::4537` |

TTL par défaut (1h). Attendre la propagation avant certbot :

```bash
dig +short app.lagriotheque.com          # doit répondre 51.210.4.77
```

## 2. Google OAuth (une seule fois)

Sur https://console.cloud.google.com/apis/credentials, dans le client OAuth
« Web application » de l'OS (ou en créer un) :

- **Authorized redirect URIs** → ajouter :
  `https://app.lagriotheque.com/api/auth/google`
- Noter `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` pour l'étape 4.

## 3. Prérequis système sur le VPS

Le provisioning de base (nginx, certbot, UFW, fail2ban, Node 20, sqlite3,
build-essential, user `deployment`) est déjà fait par
`infra/scripts/install-vps.sh`. Il manque potentiellement Python + reportlab
pour la génération des PDF :

```bash
ssh debian@51.210.4.77

# Vérifs rapides
node -v        # ≥ v20
sqlite3 --version
gcc --version  # build-essential (compilation de better-sqlite3)

# Python 3 + reportlab (génération devis/factures/conventions PDF)
sudo apt-get update
sudo apt-get install -y python3 python3-reportlab

# Vérif : doit s'exécuter sans erreur
python3 -c "import reportlab; print(reportlab.Version)"
```

> Si `python3-reportlab` n'est pas dispo dans la version voulue :
> `sudo apt-get install -y python3-pip && sudo pip3 install --break-system-packages reportlab`.
> L'app appelle `python3` via `execFileSync` — reportlab doit être visible
> par le `python3` système du user `deployment`.

## 4. Secrets de prod : `/etc/lesgriots-os.env`

```bash
# Générer les secrets (à coller ci-dessous ET à ranger dans ton
# gestionnaire de mots de passe — cf. docs/SECRETS.md)
openssl rand -hex 32     # → AUTH_SECRET
openssl rand -hex 32     # → OS_API_KEY

sudo tee /etc/lesgriots-os.env > /dev/null <<'EOF'
# LES GRIOTS OS — secrets de production (hors-Git)
NODE_ENV=production
PORT=3010

# ⚠️ true OBLIGATOIRE en prod (sinon l'app est ouverte à tous)
AUTH_ENABLED=true
AUTH_SECRET=<colle-ici-le-1er-openssl-rand>
OS_API_KEY=<colle-ici-le-2e-openssl-rand>

GOOGLE_CLIENT_ID=<depuis-la-console-Google>
GOOGLE_CLIENT_SECRET=<depuis-la-console-Google>
NEXTAUTH_URL=https://app.lagriotheque.com
EOF

sudo chmod 600 /etc/lesgriots-os.env
```

> ⚠️ Ne réutilise PAS le `AUTH_SECRET` de ton `.env.local` de dev : la prod
> a ses propres secrets.

## 5. Build de l'app sur le VPS

```bash
# Récupérer le code (le monorepo est déjà cloné)
cd /var/www/ecosystem/production/lesgriots-platform
sudo -u deployment git pull --ff-only

# Installer + builder (npm ci COMPLET : next build a besoin des devDeps ;
# better-sqlite3 est compilé nativement à l'install, d'où build-essential)
cd apps/lesgriots-os
sudo -u deployment npm ci
sudo -u deployment npm run build
```

## 6. Transfert initial de la base de données

La base part de ton Mac **via une sauvegarde à chaud** (jamais un `cp` du
fichier live : avec le WAL tu risques une copie corrompue).

```bash
# ── Sur ton Mac ──
cd ~/Claude\ Tools/lesgriots-os
# (idéalement : arrête le serveur dev / le MCP local avant)
./scripts/backup-db.sh
# → data/backups/lesgriots-YYYYMMDD-HHMM.db.gz  (prends la plus récente)

scp data/backups/lesgriots-*.db.gz debian@51.210.4.77:/tmp/

# ── Sur le VPS ──
ssh debian@51.210.4.77
cd /var/www/ecosystem/production/lesgriots-platform/apps/lesgriots-os
sudo mkdir -p data
sudo gunzip -c /tmp/lesgriots-*.db.gz | sudo tee data/lesgriots.db > /dev/null
sudo chown -R deployment:deployment data
sudo chmod 750 data && sudo chmod 640 data/lesgriots.db
rm /tmp/lesgriots-*.db.gz

# Vérif d'intégrité
sudo -u deployment sqlite3 data/lesgriots.db "PRAGMA integrity_check;"   # → ok
sudo -u deployment sqlite3 data/lesgriots.db "SELECT COUNT(*) FROM projects;"
```

> ⚠️ À partir de maintenant, **la prod est la seule vraie base**. Ne re-scp
> jamais une base locale par-dessus sans réfléchir : tu écraserais les
> données saisies en prod. Sens unique : Mac → VPS **une seule fois**.

## 7. nginx + systemd + HTTPS

```bash
cd /var/www/ecosystem/production/lesgriots-platform

# nginx
sudo cp infra/nginx/app.lagriotheque.com.conf /etc/nginx/sites-available/app.lagriotheque.com.conf
sudo ln -sf /etc/nginx/sites-available/app.lagriotheque.com.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# systemd
sudo cp infra/systemd/lesgriots-os.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now lesgriots-os
sudo systemctl status lesgriots-os        # → active (running)

# HTTPS (le DNS de l'étape 1 doit être propagé)
sudo certbot --nginx -d app.lagriotheque.com
```

## 8. Premier login

L'utilisateur admin `moos.coulibaly@gmail.com` est **auto-créé au premier
démarrage** (seed dans `initSchema()` de `src/lib/db.mjs`) — et il existe
déjà dans la base transférée. Il n'y a donc rien à créer :

1. Ouvre `https://app.lagriotheque.com` → redirection vers `/login`
2. « Se connecter avec Google » avec `moos.coulibaly@gmail.com`
3. Tu arrives sur le dashboard en rôle **admin**.

Tout autre compte Google est **refusé** (`not_authorized`) tant qu'il n'a pas
été invité depuis l'app (système d'invitations, rôles manager/collaborateur).

## 9. Brancher le MCP sur la prod

Sur ton Mac, dans la config Claude du MCP (`mcp-server.js`) :

```json
{
  "env": {
    "OS_URL": "https://app.lagriotheque.com",
    "OS_API_KEY": "<la-valeur-de-/etc/lesgriots-os.env>"
  }
}
```

Le MCP passe par le header `x-api-key` — c'est précisément pour ça que
`app.lagriotheque.com` n'a **pas** de Basic auth nginx.

Test rapide :

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://app.lagriotheque.com/api/projects
# → 401 (auth requise : normal)
curl -s -o /dev/null -w "%{http_code}\n" -H "x-api-key: <OS_API_KEY>" https://app.lagriotheque.com/api/projects
# → 200
```

## 10. Sauvegarde quotidienne (timer systemd)

> ⚠️ **Ce VPS n'a pas de `cron` installé** (`cron.service` inexistant, la
> planification y passe par les timers systemd). Ne pas suivre les tutoriels
> `crontab -e` : ils échouent silencieusement avec `crontab: command not found`.

```bash
cd /var/www/ecosystem/production/lesgriots-platform

# Le fichier de log doit être écrivable par deployment
sudo touch /var/log/lesgriots-os-backup.log
sudo chown deployment:deployment /var/log/lesgriots-os-backup.log
sudo chmod +x infra/scripts/backup.sh apps/lesgriots-os/scripts/backup-db.sh

# Unités (service oneshot + timer quotidien 03:00, Persistent=true)
sudo cp infra/systemd/lesgriots-os-backup.service \
        infra/systemd/lesgriots-os-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now lesgriots-os-backup.timer

# Vérifs
systemctl list-timers lesgriots-os-backup.timer --no-pager
sudo -u deployment /var/www/ecosystem/production/lesgriots-platform/infra/scripts/backup.sh
sudo ls -la apps/lesgriots-os/data/backups
```

Sortie : `apps/lesgriots-os/data/backups/lesgriots-AAAAMMJJ-HHMM.db.gz`,
rotation sur les 30 plus récentes.

## 11. Mises à jour courantes

```bash
# Sur ton Mac, après avoir commité dans apps/lesgriots-os :
git push
cd ~/Downloads/lesgriots-platform/infra
./scripts/deploy.sh os          # git pull + npm ci + build + restart
```

Downtime ≈ 5 s pendant le restart systemd. La base n'est **jamais** touchée
par un déploiement (gitignorée). Les migrations de schéma s'exécutent toutes
seules au redémarrage (`initSchema()`).

## 12. Rollback

```bash
# Sauvegarde de sécurité AVANT toute manœuvre (les migrations de schéma
# ne sont pas réversibles) :
ssh debian@51.210.4.77 "sudo -u deployment /var/www/ecosystem/production/lesgriots-platform/apps/lesgriots-os/scripts/backup-db.sh"

ssh debian@51.210.4.77
cd /var/www/ecosystem/production/lesgriots-platform
sudo -u deployment git log --oneline -5
sudo -u deployment git checkout <commit-précédent>
cd apps/lesgriots-os
sudo -u deployment npm ci && sudo -u deployment npm run build
sudo systemctl restart lesgriots-os
```

Retour à la dernière version : `sudo -u deployment git checkout main` puis
rebuild + restart. Si la base a été abîmée, restaurer une sauvegarde :

```bash
sudo systemctl stop lesgriots-os
cd /var/www/ecosystem/production/lesgriots-platform/apps/lesgriots-os
sudo -u deployment bash -c 'gunzip -c data/backups/lesgriots-<STAMP>.db.gz > data/lesgriots.db'
sudo -u deployment rm -f data/lesgriots.db-wal data/lesgriots.db-shm
sudo systemctl start lesgriots-os
```

## 13. Vérifications post-deploy

```bash
curl -I https://app.lagriotheque.com                    # → 307/302 vers /login (auth active)
sudo systemctl status lesgriots-os                  # → active (running)
sudo journalctl -u lesgriots-os -n 50 --no-pager    # pas d'erreur au boot
sudo journalctl -u lesgriots-os -f                  # logs en temps réel
```

Checklist première mise en prod :

- [ ] `https://app.lagriotheque.com` répond en HTTPS et redirige vers `/login`
- [ ] Login Google OK avec `moos.coulibaly@gmail.com`
- [ ] Les projets/clients existants sont bien là (DB transférée)
- [ ] Génération d'un devis PDF OK (teste reportlab en conditions réelles)
- [ ] `curl -H "x-api-key: …"` → 200 (MCP fonctionnel)
- [ ] Cron backup posé + un fichier `.db.gz` présent dans `data/backups/`
- [ ] Secrets rangés dans le gestionnaire de mots de passe

---

## Journal de déploiement

**26/07/2026 — première mise en production.** Réalisée de bout en bout :

- app intégrée au monorepo dans `apps/lesgriots-os/` (étape 0 faite) ;
- prérequis VPS posés (`sqlite3`, `build-essential`, `python3-reportlab` 4.3.1) ;
- `npm ci` + `npm run build` OK sur le VPS (Node v22) ;
- secrets générés dans `/etc/lesgriots-os.env` (chmod 600) ;
- base transférée depuis le Mac par sauvegarde à chaud — intégrité vérifiée
  (38 tables, 15 projets, 6 clients, 31 apprenants, 16 sessions) ;
- unité `lesgriots-os` active sur le port 3010 ;
- vhost nginx `app.lagriotheque.com` installé et rechargé ;
- timer de sauvegarde quotidien actif.

**Domaine retenu : `app.lagriotheque.com`** (cahier des charges OS v1.0,
section 3) et non `os.lesgriots.com` qui n'a jamais été posé.

**Restait à la charge de Moos** (hors périmètre technique) :

1. **Enregistrement DNS** `A app → 51.210.4.77` sur la zone `lagriotheque.com`
   chez OVH, puis `sudo certbot --nginx -d app.lagriotheque.com`.
2. **Client Google OAuth** : les variables `GOOGLE_CLIENT_ID` /
   `GOOGLE_CLIENT_SECRET` étaient **vides** dans le `.env.local` de dev — le
   client OAuth n'avait jamais été créé. Sans lui, `AUTH_ENABLED=true` verrouille
   l'app pour tout le monde (état volontairement conservé : aucune donnée
   client/financière exposée). À créer sur
   https://console.cloud.google.com/apis/credentials avec l'URI de redirection
   `https://app.lagriotheque.com/api/auth/google`, puis renseigner les deux
   valeurs dans `/etc/lesgriots-os.env` et redémarrer `lesgriots-os`.
