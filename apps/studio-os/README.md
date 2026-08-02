# STUDIO OS · le code de l'agence, mis de côté

Ce dossier n'est pas une application. C'est le Studio tel qu'il vivait dans
l'OS de La Griothèque au 2 août 2026, sorti d'un bloc le jour où l'organisme
de formation a pris son propre domaine.

## Pourquoi il est parti

`app.lagriotheque.com` sert l'organisme de formation. Le Studio, c'est un
autre métier : des projets clients, un pipeline d'agence, des prestataires,
un TJM, une trésorerie. Deux métiers dans une seule application, cela veut
dire deux menus, deux thèmes, deux vocabulaires, et un écran d'accueil qui
parle de la mauvaise chose à la mauvaise personne. Le Studio aura sa propre
adresse : ce dossier en est la graine.

## Ce qu'il contient

Les chemins sont ceux d'origine, à la racine près, pour qu'ils se reposent
tels quels dans un nouveau projet Next.

    src/app/(dashboard)/page.jsx        Mission Control, le cockpit des trois piliers
    src/app/(dashboard)/projects/       projets, brief, phases
    src/app/(dashboard)/pipeline/       le pipeline de l'agence
    src/app/(dashboard)/clients/        la fiche client, vue agence
    src/app/(dashboard)/providers/      les prestataires
    src/app/(dashboard)/team/           l'équipe
    src/app/(dashboard)/tasks/          les tâches
    src/app/(dashboard)/finances/       trésorerie, dépenses, prévisionnel
    src/app/(dashboard)/pricing/        le TJM
    src/components/                     les blocs qui ne servaient qu'à ces écrans
    src/components/layout/Sidebar.jsx   l'ancien menu, celui des deux mondes
    src/lib/constants.js                disciplines, catégories de dépenses, phases

## Ce qui est resté dans l'OS de la Griothèque

Les routes d'API et la base de données. `/api/projects`, `/api/tasks`,
`/api/providers`, `/api/cockpit`, `/api/treasury` et leurs voisines répondent
encore, et les tables sont intactes : rien n'a été effacé, seuls les écrans
sont partis. C'est volontaire. Séparer les données demande de décider ce qui
appartient à qui, et la table `clients` par exemple sert aux deux métiers :
c'est elle que la Griothèque affiche sous le nom d'« entreprises ».

## Pour relancer le projet

1. `npx create-next-app` à côté, même version de Next que l'OS.
2. Copier `src/` par-dessus, plus `src/components/ui`, `src/lib/menu.js` et
   `src/styles/` récupérés depuis `apps/lesgriots-os`.
3. Décider du sort des données : soit le nouveau projet interroge l'API de
   l'OS, soit on sépare les tables. Le premier chemin est plus rapide, le
   second plus propre.
