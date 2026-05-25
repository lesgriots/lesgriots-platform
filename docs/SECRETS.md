# Gestion des secrets

## Règle d'or : aucun secret dans Git. Jamais.

Le `.gitignore` couvre déjà `.env*`, `*.key`, `*.pem`, `*.db`. Si un secret est commité par erreur : le considérer comme compromis, le régénérer, et l'expurger de l'historique (`git filter-repo`).

## Où vivent les secrets

| Secret | En local | En prod | Régénération |
|--------|----------|---------|--------------|
| Variables du dashboard | `apps/dashboard/.env.local` | `/etc/dashboard.env` (chargé par systemd) | éditer les 2 fichiers, `systemctl restart dashboard` |
| Clé SSH de déploiement | `~/.ssh/id_ed25519` | clé publique dans `authorized_keys` du VPS | `ssh-keygen -t ed25519` puis `ssh-copy-id` |
| HTTP Basic admin | — | `/etc/nginx/.htpasswd` | `sudo htpasswd /etc/nginx/.htpasswd moos` |

## Stocker les secrets correctement

Les vraies valeurs vont dans un gestionnaire de mots de passe (1Password, Bitwarden, ou ton trousseau). Pas dans une note, pas dans un fichier texte, pas dans un message.

## ⚠️ La base SQLite du dashboard = donnée critique non versionnée

`data/lesgriots.db` contient toute ta donnée métier (clients, projets, devis) et **n'est pas dans Git**. Sa seule protection est la sauvegarde :

- En prod : cron quotidien via `infra/scripts/backup.sh` (garde 14 jours).
- Idéalement : copier aussi les sauvegardes hors du VPS (Dropbox, un autre serveur) pour survivre à une panne disque OVH.
- Snapshot OVH du VPS activé en complément.

## Si tu transmets le projet à un dev / une agence

Cette personne aura besoin de :
1. être ajoutée au repo GitHub privé
2. sa clé SSH publique ajoutée au VPS (`ssh-copy-id`)
3. les variables du dashboard (transmises via un canal sûr)
4. le mot de passe `.htpasswd` de l'admin

Tout le reste se reconstruit avec `git clone` + `npm install` + les README.
