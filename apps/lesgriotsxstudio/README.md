# lesgriotsxstudio — Site agence créative

Site vitrine de l'agence créative de LES GRIOTS. Stratégie, direction artistique, production audiovisuelle.

## Stack

- HTML5 + CSS3
- React 18 chargé depuis CDN (unpkg)
- Babel standalone pour transformer les `.jsx` au runtime
- Geist Mono local (`fonts/`)
- **Aucun build, aucun bundler** — tu ouvres `index.html` et ça marche

## Lancer en local

```bash
cd apps/lesgriotsxstudio
python3 -m http.server 8080
# Ouvrir http://localhost:8080
```

Alternative : `npx serve` ou n'importe quel serveur HTTP statique.

## Structure des fichiers

```
lesgriotsxstudio/
├── index.html              # Entrée principale (charge React + Babel + JSX)
├── app.jsx                 # Composant racine
├── boot.jsx                # Écran de chargement (LOADING terminal)
├── home.jsx                # Page Work (grille des projets)
├── home-index.jsx          # Vue I (liste terminale)
├── viewer.jsx              # Viewer projet (média + barre de lecture)
├── about.jsx               # Page About
├── ecosysteme.jsx          # Page Ecosystem (3 univers en orbite)
├── menu.jsx                # Menu navigation
├── matrix-griot.jsx        # ASCII griot (logo animé)
├── typewriter.jsx          # Composant Type (effet machine à écrire)
├── i18n.jsx                # Traductions FR/EN
├── data.jsx                # ⚠️ GÉNÉRÉ par le backoffice (ne pas éditer à la main)
├── styles.css              # Styles globaux
├── img/                    # Images, posters vidéo, covers projets
└── fonts/                  # Geist Mono (Regular, Medium, Bold)
```

## Modification du contenu

Pour éditer les projets, le contenu About, les pages actives : utiliser le **backoffice** (`apps/backoffice/`, port 3030). Il génère automatiquement `data.jsx` qui contient la liste des projets et `window.SITE_CONTENT`.

Pour éditer le code (composants, styles, layout) : modifier les fichiers `.jsx` / `.css` directement, recharger la page.

## Cache buster

`index.html` charge les `.jsx` avec un paramètre `?v=<timestamp>` pour forcer le rechargement après chaque modif. Incrémenter ce numéro à chaque changement de logic JS/CSS qui doit s'imposer aux visiteurs (sinon ils gardent l'ancienne version en cache).

## Notes

- Les videos sont servies depuis `img/` (pas de hosting externe pour l'instant)
- Le viewer a un comportement spécial mobile (HUD 4 coins) vs desktop (rail à droite)
- La page Eco a une vue solaire desktop et une vue 3 sections mobile
