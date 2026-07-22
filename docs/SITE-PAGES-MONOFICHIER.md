# lesgriots.com — un seul site, pages activables

## Ce qui change

Avant : deux fichiers jumeaux, `site.html` (site complet) et `attente.html`
(page « bientôt »). Le BO exportait les deux et un toggle choisissait lequel
devenait `index.html`. Résultat : toute modif de contenu devait être faite
**deux fois**, et l'une des deux finissait oubliée.

Maintenant : **un seul fichier**, `site.html`. Il porte son propre état dans un
bloc de config injecté à l'export :

```html
<!-- BO:PAGES -->
<script id="lg-pages">window.LG_MODE="live";window.LG_PAGES={"about":true,"boutique":true};</script>
<!-- /BO:PAGES -->
```

- `LG_MODE = "attente"` → la home est verrouillée (vidéo + logo + « Bientôt »),
  rien d'autre n'est accessible. Remplace l'ancienne page d'attente, depuis le
  même fichier.
- `LG_MODE = "live"` → le site est navigable.
- `LG_PAGES` → un interrupteur par page. `false` = l'entrée disparaît du menu et
  son panneau n'est pas câblé. Pages gérées aujourd'hui : `about`, `boutique`.

`attente.html` n'est plus utilisé par l'export (fichier laissé en place, inerte).

## Où on pilote

BO Les Griots → **Pages du site** (`/site-mode`) :

- un choix maître **En attente / En ligne** ;
- un interrupteur **Activée / Éteinte** par page.

Chaque changement enregistre l'état (`/api/site-mode`) puis republie
(`/api/export` → `index.html`). Bascule en quelques secondes, pas d'action
manuelle.

## Fichiers touchés

- `apps/lesgriots/site.html` — bloc `BO:PAGES`, `data-page` sur les liens de
  menu, garde attente dans `startArrival()`, garde `data-off` dans `wirePanel()`,
  mention `.stage-soon` « Bientôt ».
- `apps/lesgriots/styles.css` — règles `.lg-attente` (menu masqué, verrou
  scroll, mention visible) et masquage des liens `a[data-off]`.
- `apps/backoffice-lesgriots/lib/db.js` — `pages` dans le store, `getPages` /
  `setPages`, `mode` normalisé en `live` / `attente` (l'ancien `coming-soon`
  est lu comme `attente`).
- `apps/backoffice-lesgriots/app/api/site-mode/route.js` — persiste mode +
  pages (ne copie plus de fichier).
- `apps/backoffice-lesgriots/app/api/export/route.js` — injecte `BO:PAGES`,
  n'hydrate plus `attente.html`, publie toujours `site.live.html` → `index.html`.
- `apps/backoffice-lesgriots/app/site-mode/page.jsx` — interface toggles.
- `infra/nginx/snippets/lesgriots-pages.conf` — commentaire mis à jour (les
  règles restent : elles bloquent l'accès direct à `site.html`).

## Déploiement (VPS)

Depuis `/var/www/ecosystem/production/lesgriots-platform` :

1. `git pull`
2. Rebuild du BO :
   ```
   cd apps/backoffice-lesgriots
   npm install        # seulement si package.json a changé (ici non)
   npm run build
   sudo systemctl restart lesgriots-backoffice
   ```
3. **Régénérer le site** : ouvrir le BO → « Pages du site » → régler le mode +
   les pages voulus (ça exporte automatiquement). Ou cliquer « ↑ Sync » une
   fois. Sans cette étape, `index.html` en ligne reste l'ancienne version (sans
   le bloc de config).
4. Vérifier `https://lesgriots.com` (mode live : menu + pages actives ; mode
   attente : home seule).

Aucune migration de données : `lesgriots.json` existant fonctionne tel quel
(`mode` ancien lu comme attente, `pages` par défaut toutes actives).

## Ajouter une page activable plus tard

1. Donner un `data-page="<clé>"` au lien de menu dans `site.html`.
2. Ajouter la clé dans `PAGE_KEYS` (`lib/db.js`) et dans `PAGE_META`
   (`site-mode/page.jsx`).
3. Rebuild + export.
