# lesgriots — Plateforme éditoriale

Site de la plateforme éditoriale LES GRIOTS — contenus, collaborations, manifeste afro-diasporique.

## Stack

HTML statique simple. Pas de React, pas de Babel — c'est du HTML/CSS/JS classique.

## Lancer en local

```bash
cd apps/lesgriots
python3 -m http.server 8081
# Ouvrir http://localhost:8081
```

## Structure des fichiers

```
lesgriots/
├── index.html              # Page principale
├── archive.html            # Archives
├── styles.css              # Styles
├── image-slot.js           # Logique slots images
├── assets/                 # Assets divers
├── screenshots/            # Captures de référence
└── uploads/                # Médias uploadés
```

## État actuel

Site en cours de redéfinition. Le contenu actuel est minimal et sert de placeholder.

**Backoffice Éditorial à venir** — pour gérer les articles, catégories, auteurs (cf. roadmap).
