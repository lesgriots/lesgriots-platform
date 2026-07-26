# AUDIT & REFONTE — LES GRIOTS OS · Juillet 2026

Audit complet (UI/UX, sécurité, données, infra) suivi d'un chantier de correction. Objectif : un outil **multi-utilisateurs avec rôles**, **full responsive**, **déployable sur le VPS OVH** pour Moos et l'équipe.

Verdict avant chantier : fonctionnellement riche mais **inutilisable en équipe et indéfendable en prod** — auth désactivée par défaut, un header `Bearer` bidon suffisait à passer le middleware, 86 routes API sur 88 sans aucun contrôle d'accès, zéro media query, suppressions sans confirmation fiable, erreurs réseau avalées en silence.

---

## 1. SÉCURITÉ & MULTI-USER — corrigé ✅

| Angle mort | État |
|---|---|
| Middleware : présence d'un Bearer/cookie = authentifié (jamais validé) | ✅ Corrigé — le middleware ne fait qu'un tri rapide ; la vraie validation (session en DB, clé API timing-safe) est dans `src/lib/api-guard.js` |
| Auth désactivée par défaut, même en prod | ✅ En production l'auth est **toujours** active ; `AUTH_ENABLED` ne joue qu'en dev |
| 86/88 routes API sans contrôle d'accès | ✅ Toutes wrappées par `withGuard(permission, handler)` — RBAC existant (admin / manager / collaborateur) enfin branché partout |
| `/api/data` : tout le monde voyait tout (finances comprises) | ✅ Filtré par rôle : collaborateur sans données financières ni clients ; manager sans expenses/IP revenues |
| Erreurs 500 fuitant message/stack | ✅ try/catch global dans withGuard, log serveur complet, client reçoit `Erreur serveur` |
| Pas de validation d'entrées | ✅ Champs essentiels requis (400 sinon), cast numérique, troncature payloads géants — sur projects, clients, providers, tasks, formations, sessions, apprenants |
| `OS_API_KEY` vide → MCP cassé dès l'auth activée | ✅ Clé générée, configurée dans `.env.local` **et** dans la config MCP de Claude Desktop ; `mcp-server.js` envoie désormais `x-api-key` |
| Secrets non vérifiés au boot | ✅ `src/instrumentation.js` : refuse de démarrer en prod sans `AUTH_SECRET`/`OS_API_KEY` |

**Testé en réel (AUTH_ENABLED=true)** : sans auth → 401 ; page → redirect /login ; Bearer bidon → 401 ; cookie bidon → 401 ; clé API valide → 200 (17 projets, `meta.role: admin`) ; clé fausse → 401.

## 2. UI/UX — corrigé ✅

- **Confirmations destructives** : les 22 `window.confirm` remplacés par un vrai `ConfirmDialog` stylé (hook `useConfirm`, provider monté dans le layout).
- **Anti double-submit** : boutons désactivés + « Enregistrement… » pendant les saves (Dashboard, finances, settings, tasks…).
- **Feedback systématique** : toast succès/erreur sur chaque écriture, message d'erreur API remonté ; `res.ok` vérifié partout.
- **Erreurs de lecture visibles** : bandeau « Réessayer » sur les 10 pages principales ; l'auto-refresh 10 s affiche « Données non actualisées — reconnexion… » au lieu d'échouer en silence (et n'écrase plus l'état).
- **Dirty-check** : formulaires modaux (projet, client, dépense, revenu IP, prestataire) protégés à la fermeture + `beforeunload`.
- **Empty states** : complétés (tasks, etc.).

## 3. FULL RESPONSIVE — fait ✅

- `src/styles/responsive.css` (breakpoints 768/1024) + hook `useMediaQuery`.
- **Sidebar → drawer mobile** avec hamburger fixe + overlay ; desktop inchangé.
- Modales plein écran mobile, kanbans en scroll-snap horizontal, tableaux-grilles empilés en 1 colonne, layouts 2 colonnes repliés, anti-zoom iOS (font-size 16px), cibles tactiles 40px.
- Login, TopBar, formations traités.
- Limites connues : drag & drop kanban non tactile (utiliser les menus des cartes) ; ⌘K/⌘J sans équivalent tactile (la recherche reste accessible via le bouton TopBar).

## 4. DÉPLOIEMENT VPS — packagé ✅

Tout est calé sur le monorepo `lesgriots-platform` (voir **docs/DEPLOY-OS.md** là-bas — procédure complète copy-pastable) :

- `infra/systemd/lesgriots-os.service` (port 3010, hardening), `infra/nginx/lesgriots-os.conf` (**os.lesgriots.com**, certbot), cible `os` dans `deploy.sh`.
- Backups : `scripts/backup-db.sh` (sqlite3 `.backup` WAL-safe, gzip, rotation 30) + wrapper cron dans le monorepo. **La DB n'était sauvegardée nulle part.**
- `.env.example` complet ; `.gitignore` renforcé.
- Prérequis VPS documentés : node 20+, build-essential (better-sqlite3), python3 + reportlab (générateurs PDF), sqlite3.

**Vérifié** : `npm run build` prod OK (58 pages, 0 erreur) ; serveur dev relancé et fonctionnel.

## 5. RESTE À FAIRE (par toi, ou prochaine session)

1. **Intégrer l'app au monorepo** (`apps/lesgriots-os/`) — commande rsync prête dans DEPLOY-OS.md — puis push GitHub (le repo local n'a **pas de remote**).
2. Déploiement effectif : DNS `os.lesgriots.com`, `/etc/lesgriots-os.env` (secrets **neufs**, pas ceux du Mac), certbot, transfert initial de la DB via le script de backup (jamais `cp` du fichier live), cron backup, test d'un devis PDF en prod.
3. **Google OAuth** : credentials à créer (console.cloud.google.com) — sans ça, seul le login par invitation/magic link fonctionne. Redirect URIs listés dans `.env.example`.
4. Inviter l'équipe (système d'invitations en place, rôles admin/manager/collaborateur).
5. Dette non traitée (P2) : `formations/page.jsx` (10 458 lignes) et `Dashboard.jsx` (6 815 lignes) à découper un jour ; couleurs hardcodées vs tokens ; dirty-check des modaux formations ; accessibilité (aria) ; rapatriement des backups hors VPS.
