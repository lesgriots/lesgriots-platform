# GRIOT DM — les automatisations Instagram de La Griothèque

Notre ManyChat maison, intégré au BO Griothèque (`admin.lesgriots.com/griotheque/instagram`).
Aucun abonnement : le code tourne sur notre VPS, les leads arrivent dans l'onglet **Leads**
du BO (source `instagram`) et dans **Systeme.io** (champ `source = instagram:<automatisation>`,
tag `Newsletter` si coché).

## Ce que ça fait

```
Commentaire « RECIT » sous un post
  → réponse publique tirée au sort (« Check tes DM @camille 📩 »)
  → 1er DM (réponse privée) + bouton « Je veux 👇 »
  → [option] vérifie l'abonnement au compte
  → [option] demande l'email  → lead BO + Systeme.io
  → livre : message + bouton lien (ressource du BO ou URL libre)
  → [option] message de relance (l'offre payante derrière la ressource)
```
Déclencheur possible aussi en **DM** (mot-clé envoyé en message, réponse à une story).

## Fichiers

| Où | Quoi |
|---|---|
| `apps/backoffice-griotheque/lib/griot-dm.js` | le moteur (parcours, mots-clés, email, livraison) |
| `lib/instagram-api.js` | appels Graph API, signature webhook, jeton |
| `lib/instagram-store.js` | stockage `instagram.json` (gitignoré : contient des données perso) |
| `lib/griot-dm-defaults.js` | textes par défaut |
| `app/api/instagram/*` | webhook (public), automatisations, contacts, statut, simulateur… |
| `app/instagram/*` | interface BO (liste, éditeur avec aperçu, contacts, journal, simulateur) |
| `infra/nginx/admin.lagriotheque.com.conf` | `location = /api/instagram/webhook` (public, sans Basic auth) |

`instagram.json` est séparé de `griotheque.json` exprès : le webhook écrit à chaque
commentaire, et les backups rotatifs de griotheque.json seraient noyés.
Sauvegarde quotidienne propre : `backups/instagram-AAAA-MM-JJ.json` (14 gardées).

## Règles Meta à connaître (elles dictent le design)

- **Une seule réponse privée par commentaire**, dans les 7 jours. Rien d'autre tant que la
  personne n'a pas répondu → d'où le bouton du 1er DM, qui ouvre la conversation.
- Après une réponse de la personne : **fenêtre de 24 h** pour lui écrire.
- Le compte doit être **professionnel** (créateur ou entreprise).
- Pour recevoir les commentaires de n'importe qui : app en **mode Live** + **accès avancé**
  (App Review) + **vérification d'entreprise** (Kbis de LES GRIOTS SASU).

## Branchement — une fois

### 1. L'app Meta
1. https://developers.facebook.com → *Mes apps* → *Créer une app* → cas d'usage
   **« Gérer les messages et le contenu sur Instagram »** (type Entreprise), rattachée au
   portefeuille business LES GRIOTS.
2. Produit **Instagram → Configuration de l'API avec connexion Instagram**.
3. *Générer des tokens d'accès* → ajouter le compte Instagram de La Griothèque → copier :
   le **jeton** (longue durée, 60 j) et l'**ID du compte Instagram**.
4. *Paramètres de l'app → Général* : copier la **clé secrète** (celle de la section
   Instagram si elle est distincte).
5. Sur le téléphone : Instagram → Paramètres → *Messages et réponses aux stories* →
   *Outils connectés* → **Autoriser l'accès aux messages**.

### 2. Les secrets sur le VPS
Dans `/etc/lagriotheque-backoffice.env` (chmod 600) :
```
IG_ACCESS_TOKEN=…        # jeton de l'étape 1.3
IG_USER_ID=…             # ID Instagram de l'étape 1.3
IG_APP_SECRET=…          # clé secrète de l'étape 1.4
IG_VERIFY_TOKEN=…        # une chaîne au hasard : openssl rand -hex 16
# IG_DRY_RUN=1           # optionnel : reçoit tout mais n'envoie rien
```
Puis `sudo systemctl restart lagriotheque-backoffice`.

### 3. Le déploiement du code
1. Mac : commit + push du monorepo.
2. VPS : `sudo -u deployment git pull --ff-only` dans `/var/www/ecosystem/production/lesgriots-platform`.
3. Build BO : `sudo -u deployment sh -c "cd apps/backoffice-griotheque && ./node_modules/.bin/next build"`,
   puis `sudo systemctl restart lagriotheque-backoffice`.
4. nginx : recopier `infra/nginx/admin.lagriotheque.com.conf` vers
   `/etc/nginx/sites-available/` (backup `.bak-griotdm-<date>` avant), `sudo nginx -t && sudo systemctl reload nginx`.
5. Test : `curl "https://admin.lagriotheque.com/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=<IG_VERIFY_TOKEN>&hub.challenge=ok"` → doit répondre `ok`.

### 4. Le webhook côté Meta
1. App → Instagram → *Configurer les webhooks* :
   URL de rappel `https://admin.lagriotheque.com/api/instagram/webhook`,
   jeton de vérification = `IG_VERIFY_TOKEN`.
2. S'abonner aux champs **comments**, **messages**, **messaging_postbacks**.
3. Dans le BO → Instagram → **Abonner les webhooks** (appelle `/me/subscribed_apps`).

### 5. Passage en public
Tant que l'app est en développement, seuls les comptes ayant un rôle sur l'app
(testeurs) déclenchent les webhooks : parfait pour tester avec un 2e compte perso.
Pour tout le monde :
1. *Paramètres de l'app* : icône, URL de politique de confidentialité
   (lagriotheque.com/cgv ou une page dédiée), catégorie, email.
2. **Vérification d'entreprise** (Kbis LES GRIOTS SASU).
3. **App Review** — demander l'accès avancé pour `instagram_business_basic`,
   `instagram_business_manage_comments`, `instagram_business_manage_messages`, avec une
   courte vidéo par permission (montrer : commentaire → réponse → DM → email → lien,
   et l'écran BO). Compter quelques jours à quelques semaines.
4. Passer l'app en **Live**.

## Au quotidien
- Créer une automatisation : BO → Instagram → *+ Automatisation*, l'aperçu à droite montre
  la conversation. La tester dans **Simulateur** avant de l'activer.
- Reprendre une conversation à la main : onglet **Contacts** → *Pause* sur la personne.
- Le **jeton** se rafraîchit seul tous les ~30 jours (bouton manuel dans l'en-tête).
- Varier les réponses publiques (3+ variantes) : des réponses identiques en série sont
  lues comme du spam par Instagram.
