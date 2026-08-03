/**
 * formulaire-inscription.mjs — ce qu'on demande à quelqu'un qui s'inscrit.
 *
 * Le formulaire se compose de trois couches, et le partage entre elles n'est
 * pas cosmétique : c'est lui qui évite de dupliquer une fiche formation le
 * jour où le même programme tourne en inter et en intra.
 *
 *   1. LE SOCLE. Prénom, nom, e-mail. Ce ne sont pas des questions, c'est
 *      l'identité de la personne, et l'e-mail est la clé qui rattache
 *      l'inscription à une fiche apprenant existante. Jamais modifiable.
 *
 *   2. LE FINANCEMENT. Une mécanique administrative, identique pour toutes
 *      les formations, et c'est pourquoi elle ne se configure nulle part.
 *      L'OS l'affiche en inter, la masque en intra : là, l'entreprise a déjà
 *      signé la convention, et redemander le SIRET à chacun des huit
 *      salariés revient à récolter huit réponses contradictoires sur une
 *      question déjà tranchée.
 *
 *   3. LE PÉDAGOGIQUE. Le niveau de départ, l'objectif, les prérequis, les
 *      aménagements. Là, oui, c'est propre à chaque programme : les
 *      prérequis de DaVinci ne sont pas ceux du récit de marque. On le règle
 *      une fois sur la fiche formation, et cela vaut pour toutes ses
 *      sessions, inter comme intra.
 *
 * Un champ peut porter une condition `si` : il n'apparaît, et n'est exigé,
 * que si une autre réponse le demande. La condition est évaluée deux fois,
 * dans le navigateur pour l'affichage et sur le serveur pour le contrôle.
 * Une seule des deux, et le formulaire se contourne ou se bloque à tort.
 */

const texte = (v) => String(v ?? '').trim();

/** Les champs d'identité, toujours présents, jamais modifiables. */
export const SOCLE = [
  { cle: 'firstName', libelle: 'Prénom', type: 'texte', obligatoire: true, socle: true },
  { cle: 'lastName', libelle: 'Nom', type: 'texte', obligatoire: true, socle: true },
  { cle: 'email', libelle: 'Adresse e-mail', type: 'email', obligatoire: true, socle: true },
];

export const TYPES = ['texte', 'email', 'tel', 'zone', 'liste', 'case', 'encart'];

/** Les types qui n'attendent pas de réponse : ils informent, ils ne demandent rien. */
const MUETS = new Set(['encart']);

export const OPTIONS_FINANCEMENT = [
  'Mon employeur',
  'Un OPCO',
  'À titre personnel',
  'Mon Compte Formation (CPF)',
  'France Travail',
  'Je ne sais pas encore',
];

const PAR_ENTREPRISE = ['Mon employeur', 'Un OPCO'];

/**
 * Le bloc financement. Il n'est pas configurable, et c'est voulu : la
 * question « qui paie » ne dépend pas du programme mais du droit. Selon la
 * réponse, ce n'est d'ailleurs pas le même contrat qui suit, ni le même
 * calendrier d'encaissement.
 */
export const BLOC_FINANCEMENT = [
  {
    cle: 'financement', bloc: 'financement',
    libelle: 'Comment cette formation sera-t-elle financée ?',
    type: 'liste', obligatoire: true, options: OPTIONS_FINANCEMENT,
  },

  // ── Employeur ou OPCO : de quoi éditer la convention et la facture ──
  {
    cle: 'siret', bloc: 'financement', libelle: 'SIRET de l’entreprise',
    type: 'texte', obligatoire: true, si: { cle: 'financement', valeurs: PAR_ENTREPRISE },
    aide: 'Quatorze chiffres. Il nous sert à rattacher votre inscription au dossier de votre entreprise.',
  },
  {
    cle: 'raisonSociale', bloc: 'financement', libelle: 'Raison sociale',
    type: 'texte', obligatoire: true, si: { cle: 'financement', valeurs: PAR_ENTREPRISE },
  },
  {
    cle: 'adresseFacturation', bloc: 'financement', libelle: 'Adresse de facturation',
    type: 'zone', obligatoire: true, si: { cle: 'financement', valeurs: PAR_ENTREPRISE },
  },
  {
    cle: 'signataireNom', bloc: 'financement', libelle: 'Qui signe la convention ?',
    type: 'texte', obligatoire: true, si: { cle: 'financement', valeurs: PAR_ENTREPRISE },
    aide: 'La personne qui peut engager l’entreprise. Sans sa signature, la formation ne peut pas démarrer.',
  },
  {
    cle: 'signataireEmail', bloc: 'financement', libelle: 'Son adresse e-mail',
    type: 'email', obligatoire: true, si: { cle: 'financement', valeurs: PAR_ENTREPRISE },
  },
  {
    cle: 'factureEmail', bloc: 'financement', libelle: 'Adresse pour la facture',
    type: 'email', obligatoire: false, si: { cle: 'financement', valeurs: PAR_ENTREPRISE },
    aide: 'Laissez vide si c’est la même personne.',
  },
  {
    cle: 'bonCommande', bloc: 'financement', libelle: 'Numéro de bon de commande',
    type: 'texte', obligatoire: false, si: { cle: 'financement', valeurs: PAR_ENTREPRISE },
    aide: 'Si votre entreprise en exige un sur ses factures, nous l’y ferons figurer.',
  },
  {
    cle: 'dossierOpco', bloc: 'financement', libelle: 'Numéro de dossier OPCO',
    type: 'texte', obligatoire: false, si: { cle: 'financement', valeurs: ['Un OPCO'] },
    aide: 'Si la demande de prise en charge est déjà déposée.',
  },

  // ── À titre personnel : ce n'est plus une convention, c'est un contrat ──
  {
    cle: 'adressePostale', bloc: 'financement', libelle: 'Votre adresse postale',
    type: 'zone', obligatoire: true, si: { cle: 'financement', valeurs: ['À titre personnel'] },
    aide: 'Obligatoire : votre contrat de formation doit vous identifier précisément.',
  },
  {
    cle: 'encartRetractation', bloc: 'financement', type: 'encart',
    si: { cle: 'financement', valeurs: ['À titre personnel'] },
    libelle: 'Vous financez vous-même cette formation',
    aide: 'Vous recevrez donc un contrat de formation professionnelle, et non une convention. '
      + 'Vous disposez de dix jours après signature pour vous rétracter, sans avoir à vous justifier. '
      + 'Aucune somme ne vous sera demandée avant la fin de ce délai, et le premier versement ne '
      + 'dépassera pas 30 % du prix.',
  },

  // ── CPF : le dossier ne se monte pas ici ──
  {
    cle: 'encartCpf', bloc: 'financement', type: 'encart',
    si: { cle: 'financement', valeurs: ['Mon Compte Formation (CPF)'] },
    libelle: 'Les inscriptions CPF se font sur moncompteformation.gouv.fr',
    aide: 'Nous ne pouvons pas les enregistrer ici. Envoyez tout de même ce formulaire : nous vous '
      + 'transmettons le lien direct vers la session et nous suivons votre dossier de notre côté.',
  },

  // ── France Travail ──
  {
    cle: 'conseillerFT', bloc: 'financement', libelle: 'Nom de votre conseiller France Travail',
    type: 'texte', obligatoire: false, si: { cle: 'financement', valeurs: ['France Travail'] },
    aide: 'Pour que nous puissions faire établir l’AIF.',
  },
  {
    cle: 'identifiantFT', bloc: 'financement', libelle: 'Votre identifiant France Travail',
    type: 'texte', obligatoire: false, si: { cle: 'financement', valeurs: ['France Travail'] },
  },
];

/** Les clés du bloc financement, pour ne jamais les redemander ailleurs. */
export const CLES_FINANCEMENT = new Set(BLOC_FINANCEMENT.map((c) => c.cle));

/**
 * Ce qu'un formulaire demande quand personne n'a rien réglé.
 *
 * Trois questions de positionnement, et ce n'est pas du confort : en inter
 * personne ne cadre la demande à votre place, en intra la DRH dit ce dont
 * elle a besoin, pas où en est chacun. C'est l'analyse du besoin de
 * l'indicateur 4, et c'est le seul moment où on peut la poser. L'aménagement,
 * lui, est l'indicateur 26.
 */
export const DEFAUT = [
  { cle: 'phone', libelle: 'Téléphone', type: 'tel', obligatoire: true,
    aide: 'Uniquement pour vous joindre en cas d’imprévu sur la session.' },
  {
    cle: 'niveau', libelle: 'Où en êtes-vous sur ce sujet ?',
    type: 'liste', obligatoire: true,
    options: ['Je débute complètement', 'J’ai déjà pratiqué un peu, seul',
      'Je pratique régulièrement', 'Je suis à l’aise, je viens me perfectionner'],
  },
  {
    cle: 'objectif', libelle: 'Qu’est-ce que vous voulez pouvoir faire à la fin de cette formation ?',
    type: 'zone', obligatoire: true,
    aide: 'Deux ou trois lignes suffisent. Le formateur les lit avant la session et ajuste.',
  },
  { cle: 'metier', libelle: 'Quel est votre métier ou votre activité aujourd’hui ?', type: 'texte', obligatoire: false },
  {
    cle: 'amenagement', libelle: 'Avez-vous besoin d’un aménagement particulier ?',
    type: 'zone', obligatoire: false,
    aide: 'Situation de handicap, contrainte de santé, besoin matériel : dites-le-nous, nous étudions ce qui est possible.',
  },
  {
    cle: 'connu_comment', libelle: 'Comment nous avez-vous connus ?',
    type: 'liste', obligatoire: false,
    options: ['Instagram', 'LinkedIn', 'Bouche-à-oreille', 'Recherche Google',
      'Mon employeur', 'Un ancien stagiaire', 'Autre'],
  },
];

/** Nettoie une définition venue du client avant de l'écrire en base. */
export function assainir(champs) {
  if (!Array.isArray(champs)) return [];
  const vus = new Set(SOCLE.map((c) => c.cle));
  return champs
    .filter((c) => c && texte(c.libelle))
    .map((c, i) => {
      const cle = texte(c.cle).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40) || `champ_${i + 1}`;
      return {
        cle,
        libelle: texte(c.libelle).slice(0, 200),
        type: TYPES.includes(c.type) ? c.type : 'texte',
        obligatoire: Boolean(c.obligatoire),
        aide: texte(c.aide).slice(0, 300),
        options: c.type === 'liste'
          ? (Array.isArray(c.options) ? c.options : String(c.options || '').split('\n'))
            .map(texte).filter(Boolean).slice(0, 30)
          : [],
      };
    })
    // Une clé en double ferait silencieusement disparaître une réponse.
    .filter((c) => (vus.has(c.cle) ? false : vus.add(c.cle)))
    .slice(0, 30);
}

/**
 * La suite : ce qui se passe une fois le formulaire envoyé.
 *
 * Un formulaire d'inscription tient lieu d'entretien préalable. Il recueille
 * le besoin et le niveau de départ ; ce qu'il ne peut pas faire, c'est
 * l'échange de vive voix quand le dossier le mérite. D'où le rendez-vous
 * proposé juste après l'envoi, au moment où la personne est encore là.
 */
export const SUITE_DEFAUT = {
  message: 'Nous examinons chaque candidature une par une : le parcours, les attentes, l’adéquation avec le niveau du groupe. Vous aurez notre réponse sous 3 jours ouvrés.',
  lienRdv: '',
  libelleRdv: 'Réserver un créneau d’échange',
  texteRdv: 'Vous préférez en parler de vive voix ? Choisissez un créneau, nous ferons le point sur votre projet et votre niveau de départ.',
};

export function assainirSuite(brut) {
  const lien = texte(brut?.lienRdv).slice(0, 400);
  // Un lien de rendez-vous mal formé afficherait un bouton mort : on ne garde
  // que ce qui part vraiment sur le web.
  const valide = /^https:\/\/\S+$/i.test(lien) ? lien : '';
  return {
    message: texte(brut?.message).slice(0, 1000) || SUITE_DEFAUT.message,
    lienRdv: valide,
    libelleRdv: texte(brut?.libelleRdv).slice(0, 120) || SUITE_DEFAUT.libelleRdv,
    texteRdv: texte(brut?.texteRdv).slice(0, 500) || SUITE_DEFAUT.texteRdv,
  };
}

/** La définition écrite pour ce programme, ou celle par défaut. */
export function formulaireDeFormation(db, formationId) {
  const vide = { champs: DEFAUT, suite: SUITE_DEFAUT, personnalise: false };
  if (!formationId) return vide;
  const ligne = db.prepare(
    'SELECT champs, suite FROM formulaires_inscription WHERE formation_id = ?',
  ).get(formationId);
  if (!ligne) return vide;
  try {
    const champs = JSON.parse(ligne.champs || '[]');
    const suite = JSON.parse(ligne.suite || '{}');
    return {
      champs: Array.isArray(champs) ? champs : DEFAUT,
      suite: { ...SUITE_DEFAUT, ...(suite && typeof suite === 'object' ? suite : {}) },
      personnalise: true,
    };
  } catch {
    return vide;
  }
}

/**
 * Demande-t-on le financement sur cette session ?
 *
 * Par défaut on le déduit du type : en inter oui, en intra non. Le réglage de
 * la session tranche quand le cas déborde de la règle, et il déborde dans les
 * deux sens : un intra dont chaque salarié monte son propre dossier, un inter
 * entièrement préfinancé par France Travail où la question n'a plus d'objet.
 */
export function financementDemande(session) {
  const choix = texte(session?.demander_financement).toLowerCase();
  if (choix === 'oui') return true;
  if (choix === 'non') return false;
  return !String(session?.type_session || 'INTER').toLowerCase().includes('intra');
}

/**
 * Redondants avec le bloc financement quand il est monté. « Entreprise ou
 * structure » en texte libre reste une question honnête sur un formulaire
 * qui ne demande pas le SIRET ; à côté de « Raison sociale », c'est la même
 * question posée deux fois, avec deux réponses possibles.
 */
const REDONDANTS = new Set(['company']);

/**
 * Le formulaire complet d'une session : identité, financement, pédagogie.
 *
 * Les questions du programme portant une clé du bloc financement sont
 * écartées, que le bloc soit monté ou non, et c'est le point important. Les
 * définitions écrites avant la séparation contiennent leur propre question
 * « financement » : la laisser vivre, c'est la poser deux fois en inter, et
 * la poser quand même en intra, là où l'on a justement décidé de ne plus la
 * poser. Le financement est une mécanique de l'OS ; il n'appartient plus à
 * la fiche formation, y compris pour les fiches d'hier.
 */
export function formulaireDeSession(db, sessionId) {
  const s = db.prepare(
    'SELECT formation_id, type_session, demander_financement FROM sessions WHERE id = ?',
  ).get(sessionId);
  const { champs, suite, personnalise } = formulaireDeFormation(db, s?.formation_id);
  const financement = financementDemande(s);
  const pedagogie = champs.filter((c) => !CLES_FINANCEMENT.has(c.cle)
    && !(financement && REDONDANTS.has(c.cle)));
  return {
    champs: [...SOCLE, ...(financement ? BLOC_FINANCEMENT : []), ...pedagogie],
    suite,
    personnalise,
    financement,
  };
}

/** Une condition `si` est-elle remplie par les réponses déjà données ? */
export function conditionRemplie(champ, reponses) {
  if (!champ?.si) return true;
  const valeur = reponses?.[champ.si.cle];
  return Array.isArray(champ.si.valeurs) && champ.si.valeurs.includes(valeur);
}

/**
 * Le formulaire vaut entretien préalable : ses réponses valent trace de
 * positionnement. On les résume en clair sur l'inscription, plutôt que de
 * laisser un auditeur ouvrir du JSON pour savoir ce que la personne a
 * déclaré à l'entrée.
 */
export function resumePositionnement(reponses) {
  if (!reponses?.length) return '';
  const date = new Date().toLocaleDateString('fr-FR');
  const lignes = reponses.map((r) => `${r.libelle} : ${r.valeur === true ? 'oui' : r.valeur}`);
  return [`Déclaré au formulaire d’inscription le ${date}`, ...lignes].join('\n');
}

/**
 * Confronte les réponses reçues à la définition. Renvoie les réponses
 * retenues et, le cas échéant, le premier manque, en toutes lettres : un
 * formulaire qui refuse sans dire quoi corriger est un formulaire qu'on
 * abandonne.
 *
 * Un champ dont la condition n'est pas remplie est ignoré, y compris s'il est
 * obligatoire : exiger le SIRET de quelqu'un qui paie de sa poche bloquerait
 * l'inscription sur une question qu'il n'a jamais vue.
 */
export function verifierReponses(champs, brut) {
  const reponses = [];
  for (const champ of champs) {
    if (champ.socle || MUETS.has(champ.type)) continue;
    if (!conditionRemplie(champ, brut)) continue;

    const valeur = champ.type === 'case'
      ? Boolean(brut?.[champ.cle])
      : texte(brut?.[champ.cle]).slice(0, 2000);

    if (champ.obligatoire && (champ.type === 'case' ? !valeur : !texte(valeur))) {
      return { erreur: `« ${champ.libelle} » est obligatoire.` };
    }
    if (champ.type === 'liste' && valeur && champ.options?.length && !champ.options.includes(valeur)) {
      return { erreur: `« ${champ.libelle} » : réponse inattendue.` };
    }
    if (champ.type === 'case' ? valeur : texte(valeur)) {
      reponses.push({ cle: champ.cle, libelle: champ.libelle, valeur, bloc: champ.bloc || '' });
    }
  }
  return { reponses };
}
