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

## Une seule base, et c'est voulu

Les écrans sont partis, les données restent. `/api/projects`, `/api/tasks`,
`/api/providers`, `/api/cockpit`, `/api/treasury` et leurs voisines répondent
encore, et les tables sont intactes.

Ce n'est pas un reste à nettoyer, c'est la décision du 2 août 2026 : **on ne
sépare pas les données.** Le Studio OS ne sera pas un troisième silo, ce sera
le poste de pilotage de la maison entière. Les chiffres de la Griothèque
doivent y remonter, au même titre que ceux de l'agence et de la production :
un seul chiffre d'affaires, une seule trésorerie, une seule vue de ce que vaut
l'année.

D'où l'architecture visée :

    lesgriots.db          une base, celle d'aujourd'hui
      ├── app.lagriotheque.com   l'outil de l'organisme de formation : on y
      │                          travaille, on y produit les documents, on y
      │                          suit les apprenants
      └── le Studio OS           le poste de pilotage : il lit, il agrège, il
                                 compare les trois piliers

La table `clients` illustre pourquoi cela tient debout : c'est la même que la
Griothèque affiche sous le nom d'« entreprises ». Une entreprise qui fait
former ses équipes aujourd'hui peut devenir un client d'agence demain, et
personne n'a envie de la saisir deux fois.

## Pour relancer le projet

1. `npx create-next-app` à côté, même version de Next que l'OS.
2. Copier `src/` par-dessus, plus `src/components/ui` et `src/styles/`
   récupérés depuis `apps/lesgriots-os`.
3. Pointer sur la même base : `src/lib/db.mjs` de l'OS, même fichier SQLite.
   Attention, SQLite en WAL supporte plusieurs lecteurs mais un seul
   écrivain à la fois ; le Studio OS lira beaucoup et écrira peu, ça passe.
   Si un jour les deux écrivent fort, c'est le moment de passer à Postgres,
   pas de couper la base en deux.
4. Ce que le Studio OS devra demander à la Griothèque : le chiffre d'affaires
   par session et par mois, les encaissements, le prévisionnel des sessions
   signées mais non démarrées. Ces chiffres existent déjà en base ; c'est la
   vue qui manque, pas la donnée.
