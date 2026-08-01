/**
 * formulaire-inscription.mjs — ce qu'on demande à quelqu'un qui s'inscrit.
 *
 * Le formulaire se définit sur le PROGRAMME, pas sur la session. Un programme
 * tourne plusieurs fois, et refaire le formulaire à chaque date est l'endroit
 * exact où les versions divergent : c'est déjà arrivé au catalogue, avec cinq
 * copies de la même formation qui ont fini par ne plus rien dire de pareil.
 *
 * Trois champs ne se retirent jamais : le prénom, le nom et l'adresse
 * e-mail. Ce ne sont pas des questions, c'est l'identité de la personne, et
 * l'e-mail est la clé qui rattache l'inscription à une fiche apprenant
 * existante. Tout le reste se choisit.
 */

const texte = (v) => String(v ?? '').trim();

/** Les champs d'identité, toujours présents, jamais modifiables. */
export const SOCLE = [
  { cle: 'firstName', libelle: 'Prénom', type: 'texte', obligatoire: true, socle: true },
  { cle: 'lastName', libelle: 'Nom', type: 'texte', obligatoire: true, socle: true },
  { cle: 'email', libelle: 'Adresse e-mail', type: 'email', obligatoire: true, socle: true },
];

/**
 * Ce qu'un formulaire propose quand personne n'a rien réglé. Ces quatre
 * questions couvrent le minimum d'une inscription en inter : joindre la
 * personne, savoir qui paie, et savoir s'il faut aménager quelque chose.
 * L'aménagement n'est pas une politesse : c'est l'indicateur 26 du
 * référentiel, et le moment de la poser est celui de l'inscription.
 */
export const DEFAUT = [
  { cle: 'phone', libelle: 'Téléphone', type: 'tel', obligatoire: false },
  { cle: 'company', libelle: 'Entreprise ou structure', type: 'texte', obligatoire: false },
  {
    cle: 'financement',
    libelle: 'Comment cette formation sera-t-elle financée ?',
    type: 'liste',
    obligatoire: true,
    options: ['À titre personnel', 'Mon employeur', 'Un OPCO', 'Mon Compte Formation (CPF)', 'France Travail', 'Je ne sais pas encore'],
  },
  {
    cle: 'amenagement',
    libelle: 'Avez-vous besoin d’un aménagement particulier ?',
    type: 'zone',
    obligatoire: false,
    aide: 'Situation de handicap, contrainte de santé, besoin matériel : dites-le-nous, nous étudions ce qui est possible.',
  },
];

export const TYPES = ['texte', 'email', 'tel', 'zone', 'liste', 'case'];

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
  message: 'Nous avons bien reçu votre demande. Nous revenons vers vous sous 3 jours ouvrés pour valider votre inscription.',
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

/** Le formulaire complet d'une session : socle d'identité puis questions. */
export function formulaireDeSession(db, sessionId) {
  const s = db.prepare('SELECT formation_id FROM sessions WHERE id = ?').get(sessionId);
  const { champs, suite, personnalise } = formulaireDeFormation(db, s?.formation_id);
  return { champs: [...SOCLE, ...champs], suite, personnalise };
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
 */
export function verifierReponses(champs, brut) {
  const reponses = [];
  for (const champ of champs) {
    if (champ.socle) continue;
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
      reponses.push({ cle: champ.cle, libelle: champ.libelle, valeur });
    }
  }
  return { reponses };
}
