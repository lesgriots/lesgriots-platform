/**
 * Les nomenclatures officielles d'un organisme de formation.
 *
 * Ces trois listes ne sont pas décoratives : le type d'action et la spécialité
 * se retrouvent tels quels dans le bilan pédagogique et financier. Les saisir
 * à la création évite d'avoir à les retrouver un an plus tard, session par
 * session, la veille du dépôt.
 */

/** Article L.6313-1 du code du travail : les quatre natures d'action. */
export const TYPES_ACTION = [
  'Action de formation',
  'Bilan de compétences',
  'Action de validation des acquis de l’expérience',
  'Action de formation par apprentissage',
];

/**
 * Spécialités NSF — la liste courte, celle qui sert ici.
 *
 * La nomenclature complète compte plus de quatre-vingts groupes. Plutôt que
 * d'en recopier une version approximative, on retient ceux qui correspondent
 * vraiment à nos formations, et on laisse la saisie libre pour le reste :
 * un code faux dans un BPF coûte plus cher qu'un champ à taper.
 */
export const SPECIALITES = [
  '100 - Formations générales',
  '132 - Arts plastiques',
  '133 - Musique, arts du spectacle',
  '134 - Autres disciplines artistiques et spécialités artistiques plurivalentes',
  '312 - Commerce, vente',
  '315 - Ressources humaines, gestion du personnel, gestion de l’emploi',
  '320 - Spécialités plurivalentes de la communication',
  '321 - Journalisme et communication',
  '322 - Techniques de l’imprimerie et de l’édition',
  '323 - Techniques de l’image et du son, métiers connexes du spectacle',
  '324 - Secrétariat, bureautique',
  '326 - Informatique, traitement de l’information, réseaux de transmission',
  '333 - Enseignement, formation',
  '335 - Animation culturelle, sportive et de loisirs',
  '413 - Développement des capacités comportementales et relationnelles',
  '415 - Développement des capacités d’apprentissage',
];

/** Ce qu'on peut viser au bout d'une formation. */
export const DIPLOMES = [
  'Aucun',
  'Certification professionnelle (RNCP)',
  'Certification ou habilitation (RS)',
  'Bloc de compétences',
  'Certification de branche',
  'Autre',
];

/** Les fuseaux qu'on rencontre vraiment. */
export const FUSEAUX = [
  ['Europe/Paris', 'UTC +01:00 Europe/Paris'],
  ['Europe/London', 'UTC +00:00 Europe/Londres'],
  ['America/New_York', 'UTC −05:00 New York'],
  ['Africa/Abidjan', 'UTC +00:00 Abidjan'],
  ['Africa/Dakar', 'UTC +00:00 Dakar'],
  ['Africa/Douala', 'UTC +01:00 Douala'],
  ['Indian/Reunion', 'UTC +04:00 La Réunion'],
  ['America/Guadeloupe', 'UTC −04:00 Guadeloupe'],
  ['America/Martinique', 'UTC −04:00 Martinique'],
  ['America/Cayenne', 'UTC −03:00 Guyane'],
];

/** Inter, intra : le mot qui change la facture et la ligne du BPF. */
export const TYPES_SESSION = [
  ['INTER', 'Inter-entreprise'],
  ['INTRA', 'Intra-entreprise'],
];
