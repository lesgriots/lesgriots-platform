# lagriotheque — Site formation

Site de La Griothèque — plateforme de formations et masterclasses afro-diasporiques de LES GRIOTS.

## Stack

Identique au site studio : HTML5 + React 18 via CDN + Babel standalone. Pas de build.

## Lancer en local

```bash
cd apps/lagriotheque
python3 -m http.server 8082
# Ouvrir http://localhost:8082
```

## Structure des fichiers

```
lagriotheque/
├── index.html              # Entrée principale
├── app.jsx                 # Composant racine + routing (hash-based)
├── data.jsx                # Toutes les données (FORMATIONS, TRAINERS, WORKSHOPS, SESSIONS, RESOURCES, DEFAULTS)
├── matrix-griot.jsx        # ASCII griot (logo)
├── styles.css              # Styles globaux
├── img/                    # Images formations, intervenants
├── fonts/                  # Geist Mono + Silkscreen (pour l'anneau LA GRIOTHÈQUE)
└── _ref_formation.html     # Référence design (peut être supprimée)
```

## Pages

- **Home** — Manifeste + intro
- **Notre Approche** — 6 critères ADN
- **Catalogue** — Liste des formations (poster style SUPSI)
- **Workshops** — Liste des workshops
- **Agenda** — Sessions à venir (formations + workshops)
- **Financement** — OPCO, FAF, CPF
- **Ressources** — Guides, articles, outils
- **CGV** — Conditions générales de vente
- **Contact** — Email, Instagram, LinkedIn

## Données

`data.jsx` contient toutes les données du site :

| Section | Description | Géré par |
|---|---|---|
| `FORMATIONS` | 3 formations (Stratégie de marque, Direction artistique, Storytelling) | Édité manuellement pour l'instant |
| `WORKSHOPS` | 3 workshops courts | Édité manuellement |
| `TRAINERS` | 3 intervenants | Édité manuellement |
| `SESSIONS` | 11 sessions datées | Édité manuellement |
| `RESOURCES` | 4 ressources téléchargeables | Édité manuellement |
| `DEFAULTS` | Textes mutualisés (méthodes, éval, accessibilité, lieux) | Édité manuellement |

**Backoffice Griothèque à venir** — pour éditer ces données via interface graphique (pas encore implémenté). Cf. `docs/ROADMAP.md`.

## Notes spécifiques

- Tarif unique : **300 € / jour** (TVA non applicable, art. 293 B du CGI)
- Qualiopi acquise · EDOF en cours · CPF à venir
- Financements actuels : OPCO, FAF, financement personnel
- Référente handicap : `formations@lesgriots.com`
