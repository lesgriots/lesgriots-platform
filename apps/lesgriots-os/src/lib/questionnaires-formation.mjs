/**
 * Les questions réellement posées à un apprenant.
 *
 * Trois règles, décidées une fois pour toutes :
 *
 *   1. Le positionnement d'un programme remplace le générique. Demander
 *      « évaluez votre niveau » à quelqu'un qui vient apprendre à filmer au
 *      téléphone n'apprend rien ; lui demander avec quel téléphone il filme,
 *      si. C'est aussi la meilleure preuve de l'indicateur 4.
 *
 *   2. Les enquêtes à chaud et à froid gardent leur tronc commun, identique
 *      pour toutes les formations. C'est ce qui permet de dire « ma
 *      satisfaction moyenne est de 4,6 » : si chaque programme avait ses
 *      propres questions notées, ce chiffre n'existerait plus. Les questions
 *      du programme s'ajoutent après.
 *
 *   3. Une question reste imposée dans tout positionnement : celle des
 *      besoins d'aménagement. C'est la preuve de l'indicateur 26, et elle ne
 *      se supprime pas depuis l'éditeur.
 */
import { QUESTIONNAIRES } from './questionnaires.js';

/** La palette. Un type sait s'afficher, se valider, se stocker et se compter. */
export const TYPES_QUESTION = [
  { cle: 'note', libelle: 'Note sur 5', aide: 'Compte dans la moyenne de satisfaction.' },
  { cle: 'nps', libelle: 'Recommandation de 0 à 10', aide: 'La question « recommanderiez-vous ».' },
  { cle: 'echelle', libelle: 'Échelle d’accord', aide: 'De « pas du tout d’accord » à « tout à fait d’accord ».' },
  { cle: 'choice', libelle: 'Choix unique', aide: 'Une seule réponse parmi une liste.' },
  { cle: 'multi', libelle: 'Choix multiple', aide: 'Plusieurs réponses possibles.' },
  { cle: 'bool', libelle: 'Oui / Non', aide: '' },
  { cle: 'text', libelle: 'Texte libre', aide: 'Ne compte dans aucune moyenne.' },
  { cle: 'nombre', libelle: 'Nombre', aide: '' },
  { cle: 'date', libelle: 'Date', aide: '' },
  { cle: 'section', libelle: 'Titre de section', aide: 'N’attend aucune réponse : sépare un long formulaire.' },
];
export const TYPES_VALIDES = TYPES_QUESTION.map((t) => t.cle);

export const ECHELLE_ACCORD = [
  'Pas du tout d’accord', 'Plutôt pas d’accord', 'Plutôt d’accord', 'Tout à fait d’accord',
];

/** La question que l'éditeur ne peut pas retirer d'un positionnement. */
export const QUESTION_IMPOSEE = QUESTIONNAIRES.positionnement.questions.find(
  (q) => q.key === 'besoins_specifiques',
);

/** L'écart au tronc enregistré pour ce programme, ou rien. */
function surMesure(db, formation_id, moment) {
  if (!formation_id) return null;
  try {
    const r = db.prepare(
      'SELECT questions FROM formation_questionnaires WHERE formation_id = ? AND moment = ?',
    ).get(formation_id, moment);
    if (!r) return null;
    const liste = JSON.parse(r.questions || '[]');
    return Array.isArray(liste) && liste.length ? liste : null;
  } catch (e) {
    console.error('[questionnaires] lecture sur mesure impossible :', e.message);
    return null;
  }
}

/**
 * La définition servie à l'apprenant : intitulé, intro et questions.
 * @param {'positionnement'|'chaud'|'froid'} type
 */
export function definitionEffective(db, formation_id, type) {
  const base = QUESTIONNAIRES[type];
  if (!base) return null;
  const propre = surMesure(db, formation_id, type);

  let questions;
  if (type === 'positionnement' && propre) {
    // Remplacement, mais la question d'aménagement revient toujours.
    questions = [...propre];
    if (QUESTION_IMPOSEE && !questions.some((q) => q.key === QUESTION_IMPOSEE.key)) {
      questions.push(QUESTION_IMPOSEE);
    }
  } else if (propre) {
    questions = [...base.questions, ...propre];   // ajout après le tronc
  } else {
    questions = base.questions;
  }

  return { ...base, questions, sur_mesure: Boolean(propre) };
}

/**
 * La moyenne, calculée sur les questions réellement posées.
 * Seules les notes sur 5 comptent : mélanger une échelle d'accord et une
 * note sur cinq donnerait un chiffre qui ne veut rien dire.
 */
export function calculerScore(questions, reponses) {
  if (!Array.isArray(questions) || !reponses || typeof reponses !== 'object') return null;
  const notes = [];
  for (const q of questions) {
    if (q.type !== 'note') continue;
    const v = Number(reponses[q.key]);
    if (Number.isFinite(v) && v >= 1 && v <= 5) notes.push(v);
  }
  if (!notes.length) return null;
  return Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 100) / 100;
}

/** Nettoie ce que l'éditeur envoie : on ne stocke que du connu. */
export function normaliser(liste) {
  if (!Array.isArray(liste)) return [];
  const vues = new Set();
  return liste.slice(0, 40).map((q, i) => {
    const type = TYPES_VALIDES.includes(q.type) ? q.type : 'text';
    let key = String(q.key || '').trim().replace(/[^a-z0-9_]/gi, '_').toLowerCase() || `q${i + 1}`;
    while (vues.has(key)) key = `${key}_`;
    vues.add(key);
    const propre = {
      key, type,
      label: String(q.label || '').slice(0, 400),
      required: type === 'section' ? false : Boolean(q.required),
    };
    if (type === 'choice' || type === 'multi') {
      propre.options = (Array.isArray(q.options) ? q.options : [])
        .map((o) => String(o).slice(0, 120)).filter(Boolean).slice(0, 20);
    }
    if (type === 'echelle') propre.options = ECHELLE_ACCORD;
    return propre;
  }).filter((q) => q.label);
}
