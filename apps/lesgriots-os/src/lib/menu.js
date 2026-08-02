/**
 * Le menu, en un seul endroit.
 *
 * Deux consommateurs : la barre latérale, qui l'affiche, et le fil d'Ariane,
 * qui s'en sert pour dire où l'on se trouve. Tant que les deux lisaient des
 * tables séparées, l'un pouvait mentir sans que l'autre le sache.
 *
 * `RAIL_SECTIONS` est le menu de l'organisme de formation, et le seul depuis
 * que le Studio est parti dans apps/studio-os : `NAV`, son menu à lui, est
 * parti avec. Un menu sans écran derrière ne rend service à personne.
 */

export const RAIL_SECTIONS = [
  {
    id: 'pilotage', icon: 'home', label: 'Pilotage',
    links: [
      { href: '/apercu', label: "Vue d'ensemble" },
      { href: '/agenda', label: 'Agenda', indice: 'Dates de session et jalons' },
    ],
  },
  {
    id: 'commercial', icon: 'pricing', label: 'Gestion commerciale', compteur: 'pipeline',
    links: [
      { href: '/pipeline-formations', label: 'Tunnel de vente', indice: 'Opportunités, du contact à la facture' },
      { href: '/recyclages', label: 'Suivi des recyclages', indice: 'Formations à renouveler' },
      { href: '/inscriptions', label: 'Inscriptions', indice: 'Demandes reçues par formulaire' },
      { divider: true },
      { href: '/opportunites-archivees', label: 'Opportunités archivées', indice: 'Affaires closes ou perdues' },
    ],
  },
  {
    id: 'sessions', icon: 'sessions', label: 'Sessions de formation', compteur: 'sessions',
    links: [
      { href: '/sessions-list', label: 'Toutes mes sessions', indice: 'Toutes les sessions en cours' },
      { divider: true },
      { href: '/sessions-list?vue=archivees', label: 'Sessions archivées', indice: 'Sessions clôturées et déclarées' },
    ],
  },
  {
    id: 'bibliotheque', icon: 'formations', label: 'Bibliothèque',
    links: [
      { href: '/catalogue', label: 'Programmes', indice: 'Contenus de référence' },
      { href: '/catalogue?vue=evaluations', label: 'Évaluations', indice: 'Modèles de questionnaires' },
      { divider: true },
      { href: '/catalogue?vue=programmes-archives', label: 'Programmes archivés', indice: 'Retirés du catalogue' },
      { href: '/catalogue?vue=blocs-archives', label: 'Blocs pédagogiques archivés', indice: 'Modules réutilisables' },
    ],
  },
  {
    id: 'rapports', icon: 'finances', label: "Rapports d'activité",
    links: [
      { href: '/apercu', label: "Suivi de l'activité" },
      { href: '/facturation', label: 'Suivi des factures', indice: 'Émises, payées, en retard' },
      { href: '/pipeline-formations', label: 'Suivi commercial', indice: 'Conversion et pipeline' },
      { href: '/bpf', label: 'Bilan pédagogique et financier', indice: 'Déclaration annuelle' },
      { href: '/qualite', label: 'Suivi qualité', indice: 'Satisfaction et réclamations' },
      { href: '/amelioration-continue', label: 'Amélioration continue', indice: 'Actions correctives Qualiopi' },
    ],
  },
  {
    id: 'donnees', icon: 'donnees', label: 'Données',
    links: [
      { href: '/entreprises', label: 'Entreprises', indice: 'Clients et financeurs' },
      { href: '/apprenants', label: 'Apprenants', indice: 'Personnes formées' },
      { href: '/intervenants', label: 'Intervenants', indice: 'Formateurs et sous-traitants' },
      { href: '/financeurs', label: 'Financeurs externes', indice: 'OPCO, CPF, France Travail' },
      { href: '/lieux', label: 'Lieux de formation', indice: 'Salles et adresses' },
    ],
  },
  {
    // Ce menu avait été écrit sur le modèle de Digiforma, avant que les écrans
    // existent : sept entrées sur onze menaient ailleurs que ce qu'elles
    // annonçaient. Cinq portaient un « ?vue= » que personne ne lisait, et
    // « Comptes d'accès » ouvrait les coordonnées bancaires.
    //
    // Il ne reste ici que ce qui existe vraiment. Ce qui manque n'a pas
    // disparu : il est listé, avec sa raison d'être, dans « Ce qui reste à
    // construire ». Un menu qui ment coûte plus cher qu'un menu court.
    id: 'configuration', icon: 'settings', label: 'Configuration',
    links: [
      { href: '/parametres-formation', label: "Identité de l’organisme" },
      { href: '/organisme', label: 'Pièces de l’organisme', indice: 'Modèles de documents' },
      { divider: true },
      { href: '/emails', label: "Modèles d'e-mails" },
      { href: '/espace-apprenant', label: 'Espace apprenant', indice: 'Marque et accès' },
      { href: '/workflows', label: 'Workflows agence', indice: 'Automatisations internes' },
      { divider: true },
      { href: '/a-construire', label: 'Ce qui reste à construire', indice: 'Écrans à venir' },
    ],
  },
];

/**
 * Des écrans existent sans figurer au menu : la fiche d'une session, celle
 * d'une opportunité, un programme ouvert depuis la bibliothèque. Ils ont
 * pourtant une place évidente. On la déclare ici plutôt que de laisser le
 * fil muet.
 */
// [ section, libellé de l'étape, adresse de retour ]
// L'adresse de retour n'est pas toujours le préfixe : la fiche d'une session
// vit sous /sessions/… mais la liste, elle, est à /sessions-list.
const RATTACHEMENTS = {
  '/sessions': ['Sessions de formation', 'Toutes mes sessions', '/sessions-list'],
  '/opportunites': ['Gestion commerciale', 'Tunnel de vente', '/pipeline-formations'],
  '/formations': ['Bibliothèque', 'Programmes', '/catalogue'],
  '/evaluations': ["Rapports d'activité", 'Résultats des évaluations', '/evaluations'],
  '/settings': ['Configuration', 'Réglages', '/settings'],
  '/appareil': ['Configuration', 'Appareil', '/appareil'],
  '/legal': ['Configuration', 'Mentions légales', '/legal'],
};

/**
 * Le chemin qui mène à une route, tel qu'il se lit dans le menu.
 *
 *   /amelioration-continue → { section: "Rapports d'activité",
 *                              page: 'Amélioration continue',
 *                              href: '/amelioration-continue', fiche: false }
 *   /entreprises/42        → { section: 'Données', page: 'Entreprises',
 *                              href: '/entreprises', fiche: true }
 *
 * `fiche` distingue l'écran de liste de la fiche ouverte depuis cette liste :
 * sur une fiche, le fil doit ramener à la liste, et le nom de la fiche devient
 * la dernière étape.
 *
 * Une route inconnue ne renvoie rien : mieux vaut pas de fil du tout qu'un
 * fil inventé.
 */
export function cheminGriotheque(pathname) {
  const p = String(pathname || '').split('?')[0];
  if (!p || p === '/') return null;

  let exact = null;
  let parent = null;

  const retenir = (cible, section, page, retour = cible) => {
    if (p === cible) {
      if (!exact) exact = { section, page, href: retour, fiche: false };
      return;
    }
    if (p.startsWith(cible + '/') && (!parent || cible.length > parent.prefixe.length)) {
      parent = { section, page, href: retour, prefixe: cible, fiche: true };
    }
  };

  for (const section of RAIL_SECTIONS) {
    for (const lien of section.links) {
      // Les entrées à « ?vue= » ne se distinguent pas par le chemin seul :
      // deux d'entre elles revendiqueraient la même page.
      if (!lien.href || lien.href.includes('?')) continue;
      retenir(lien.href, section.label, lien.label);
    }
  }
  for (const [cible, [section, page, retour]] of Object.entries(RATTACHEMENTS)) {
    retenir(cible, section, page, retour);
  }

  return exact || parent;
}
