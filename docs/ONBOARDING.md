# Onboarding — pour un nouveau dev / une agence

Bienvenue. Objectif : être opérationnel en 30 minutes.

## 1. Cloner le repo

```bash
git clone <url-du-repo-github>
cd lesgriots-platform
```

## 2. Lancer un site statique en local

```bash
cd apps/lesgriots
python3 -m http.server 8081
# Ouvrir http://localhost:8081
```

Pareil pour `lagriotheque` (8082) et `lesgriotsxstudio` (8083).

## 3. Lancer le dashboard en local

```bash
cd apps/dashboard
npm install
npm run dev
# Ouvrir http://localhost:3000
```

(Pour les variables d'env du dashboard, voir [SECRETS.md](SECRETS.md).)

## 4. Lire la doc, dans cet ordre

1. [README.md](../README.md) — vue d'ensemble
2. [ARCHITECTURE.md](ARCHITECTURE.md) — comment ça s'articule
3. [DEPLOY.md](DEPLOY.md) — comment c'est déployé
4. [SECRETS.md](SECRETS.md) — gestion des secrets

## 5. Workflow Git (solo)

```bash
git checkout -b feature/ma-modif
# ... travailler, commits réguliers ...
git commit -m "feat(lesgriots): ajout de la page contact"
git push -u origin feature/ma-modif
# Ouvrir une Pull Request vers main sur GitHub
```

Conventions de commit : `feat:` (nouveauté), `fix:` (bug), `chore:` (technique), `docs:` (doc).

## Règles à ne pas casser

- Le dashboard écrit en base **via l'API/MCP, jamais Python en direct** (voir son README).
- Ne **jamais** éditer le code directement sur le serveur — toujours via Git.
- Ne **jamais** commiter un `.env` ou la base `.db`.
