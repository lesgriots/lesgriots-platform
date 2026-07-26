/**
 * LES GRIOTS OS — Questionnaires publics La Griothèque (Qualiopi).
 *
 * Définition des questionnaires servis par /api/public/questionnaire/[token].
 *
 * Types de questions :
 *   - 'note'   : échelle 1 à 5 (entre dans le calcul du score moyen)
 *   - 'nps'    : échelle 0 à 10 (hors score moyen)
 *   - 'choice' : choix unique parmi options
 *   - 'text'   : réponse libre
 *   - 'bool'   : oui / non
 *
 * Mapping vers la table evaluations :
 *   chaud → 'satisfaction' · froid → 'froid' · positionnement → 'positionnement'
 *   formateur → qualiopi_evidence (kind 'note', indicateur 30)
 */

export const QUESTIONNAIRE_TYPES = ['positionnement', 'chaud', 'froid', 'formateur'];

export const QUESTIONNAIRE_TYPE_TO_EVALUATION = {
  positionnement: 'positionnement',
  chaud: 'satisfaction',
  froid: 'froid',
};

export const QUESTIONNAIRES = {
  positionnement: {
    type: 'positionnement',
    label: 'Questionnaire de positionnement',
    intro: 'Ce questionnaire nous permet d’adapter la formation à votre niveau et à vos attentes. Il ne s’agit pas d’un examen.',
    indicator: 8,
    questions: [
      { key: 'niveau', label: 'Comment évaluez-vous votre niveau actuel sur le sujet de la formation ?', type: 'choice', required: true,
        options: ['Débutant·e', 'Notions de base', 'Intermédiaire', 'Avancé', 'Expert·e'] },
      { key: 'experience', label: 'Décrivez brièvement votre expérience en lien avec le sujet.', type: 'text', required: false },
      { key: 'attentes', label: 'Quelles sont vos attentes principales pour cette formation ?', type: 'text', required: true },
      { key: 'objectifs_pro', label: 'Quel objectif professionnel cette formation doit-elle servir ?', type: 'text', required: false },
      { key: 'besoins_specifiques', label: 'Avez-vous des besoins spécifiques (situation de handicap, aménagements, contraintes) ?', type: 'bool', required: true },
      { key: 'besoins_precision', label: 'Si oui, précisez pour que nous puissions adapter l’accueil et la pédagogie.', type: 'text', required: false },
    ],
  },

  chaud: {
    type: 'chaud',
    label: 'Enquête de satisfaction à chaud',
    intro: 'Votre retour nous aide à améliorer nos formations. Merci de répondre en toute franchise.',
    indicator: 30,
    questions: [
      { key: 'contenu', label: 'Qualité et pertinence du contenu', type: 'note', required: true },
      { key: 'animation', label: 'Qualité de l’animation par le formateur / la formatrice', type: 'note', required: true },
      { key: 'supports', label: 'Qualité des supports pédagogiques', type: 'note', required: true },
      { key: 'organisation', label: 'Organisation et logistique (accueil, lieu, horaires)', type: 'note', required: true },
      { key: 'objectifs', label: 'Atteinte des objectifs annoncés', type: 'note', required: true },
      { key: 'nps', label: 'Recommanderiez-vous cette formation ? (0 = pas du tout, 10 = certainement)', type: 'nps', required: true },
      { key: 'points_forts', label: 'Qu’avez-vous le plus apprécié ?', type: 'text', required: false },
      { key: 'ameliorations', label: 'Que pourrions-nous améliorer ?', type: 'text', required: false },
      { key: 'commentaires', label: 'Commentaires libres', type: 'text', required: false },
    ],
  },

  froid: {
    type: 'froid',
    label: 'Enquête de satisfaction à froid',
    intro: 'Quelques semaines après la formation, dites-nous ce qu’elle a changé dans votre pratique.',
    indicator: 30,
    questions: [
      { key: 'mise_en_pratique', label: 'Avez-vous pu mettre en pratique les acquis de la formation ?', type: 'note', required: true },
      { key: 'impact', label: 'Impact de la formation sur votre activité professionnelle', type: 'note', required: true },
      { key: 'impact_detail', label: 'Décrivez concrètement ce que la formation a changé pour vous.', type: 'text', required: false },
      { key: 'nps', label: 'Avec le recul, recommanderiez-vous cette formation ? (0 à 10)', type: 'nps', required: true },
      { key: 'commentaires', label: 'Commentaires libres', type: 'text', required: false },
    ],
  },

  formateur: {
    type: 'formateur',
    label: 'Bilan formateur',
    intro: 'Votre bilan nourrit notre démarche d’amélioration continue (indicateur Qualiopi 30).',
    indicator: 30,
    questions: [
      { key: 'deroulement', label: 'Comment la session s’est-elle déroulée dans l’ensemble ?', type: 'note', required: true },
      { key: 'groupe', label: 'Dynamique et niveau du groupe', type: 'text', required: false },
      { key: 'points_forts', label: 'Points forts de la session', type: 'text', required: true },
      { key: 'difficultes', label: 'Difficultés rencontrées (pédagogiques, logistiques, techniques)', type: 'text', required: false },
      { key: 'ajustements', label: 'Ajustements à prévoir pour les prochaines sessions', type: 'text', required: false },
      { key: 'commentaires', label: 'Commentaires libres', type: 'text', required: false },
    ],
  },
};

/**
 * Calcule le score moyen (1-5) à partir des réponses :
 * moyenne des questions de type 'note' uniquement.
 */
export function computeScore(type, answers) {
  const def = QUESTIONNAIRES[type];
  if (!def || !answers || typeof answers !== 'object') return null;
  const notes = [];
  for (const q of def.questions) {
    if (q.type !== 'note') continue;
    const v = Number(answers[q.key]);
    if (Number.isFinite(v) && v >= 1 && v <= 5) notes.push(v);
  }
  if (!notes.length) return null;
  return Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 100) / 100;
}
