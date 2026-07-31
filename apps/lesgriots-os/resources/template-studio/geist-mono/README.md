# Pack de modèles Geist Mono

Sources récupérées le 29 juillet 2026 depuis l’archive `Créer des posts avec Geis Mono.zip`.

## Modèles disponibles

- **Programme de Formation** — support de programme pour l’organisme de formation.
- **Livret d’Accueil** — document d’accueil des apprenants.
- **Workbook** — support pédagogique à remettre pendant une formation.
- **Page Formation** — page de présentation d’une formation.
- **Dashboard OF** — maquette de tableau de bord pour organisme de formation.
- **Carrousel Formation** — support de communication pour les réseaux sociaux.
- **Photo de profil** — modèle de visuel de profil.

Les modèles sont au format `.dc.html` et contiennent des variables dynamiques de type `{{…}}`.

## Contenu récupéré

- `source/` : les modèles et les fichiers nécessaires à leur rendu (`doc-page.js`, `support.js`, logo).
- `assets/export/` : les trois visuels de profil fournis avec le pack.

## Statut d’intégration

Cette bibliothèque est volontairement séparée des données métier et des documents réglementaires existants. Les fichiers ont été récupérés et documentés ; ils ne génèrent pas encore automatiquement un PDF, une pièce jointe ou un e-mail dans l’application.

La prochaine étape sera de créer une vraie bibliothèque « Modèles de documents » dans LA GRIOTHÈQUE, puis de relier chaque modèle aux données d’une session avant génération et envoi.
