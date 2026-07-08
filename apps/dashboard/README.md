# Dashboard → devenu LES GRIOTS OS (`apps/lesgriots-os/`)

Ce dossier est un **vestige** : l'app de gestion interne décrite ici a été
renommée **LES GRIOTS OS** et vit désormais dans
[`apps/lesgriots-os/`](../lesgriots-os/) (pilotage Agence + Production +
Formations : projets, clients, prestataires, dépenses, tâches, formations,
génération de PDF, serveur MCP).

- **Déploiement en production** : [docs/DEPLOY-OS.md](../../docs/DEPLOY-OS.md)
  (sous-domaine `os.lesgriots.com`, port 3010, unité systemd `lesgriots-os`)
- **Secrets & sauvegardes de la base SQLite** : [docs/SECRETS.md](../../docs/SECRETS.md)
  et `infra/scripts/backup.sh`
- **Développement local** : voir le `README.md` de `apps/lesgriots-os/`

Les anciennes références « dashboard » (unité `dashboard.service`,
`/etc/dashboard.env`, port 3000, `/srv/dashboard`) sont obsolètes — la
convention en vigueur est celle de `infra/systemd/lesgriots-os.service`.

Ce dossier peut être supprimé une fois `apps/lesgriots-os/` intégré au
monorepo (cf. étape 0 de DEPLOY-OS.md).
