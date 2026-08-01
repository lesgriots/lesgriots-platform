/**
 * mentions-organisme.mjs — les mentions qui décrivent la maison.
 *
 * Méthodes pédagogiques, moyens techniques, accessibilité, délais d'accès :
 * la réglementation les exige sur chaque programme, mais elles ne parlent pas
 * du programme. Elles parlent de l'organisme. Les faire saisir quinze fois,
 * c'est garantir qu'au bout d'un an quinze versions différentes circulent, et
 * qu'un auditeur tombe sur celle qui n'a pas été mise à jour.
 *
 * Elles s'écrivent donc une fois, dans les réglages, et chaque programme en
 * hérite. Un programme peut tout de même écrire la sienne quand elle diffère
 * vraiment : une formation à distance n'a pas les mêmes moyens techniques
 * qu'une formation en salle. Le champ du programme, s'il est rempli, gagne.
 */

const texte = (v) => String(v ?? '').trim();

/** La colonne du programme, et la clé de réglage qui lui sert de défaut. */
export const MENTIONS_HERITEES = [
  { champ: 'modalites_pedagogiques', reglage: 'mention_methodes', titre: 'Méthodes pédagogiques' },
  { champ: 'moyens_materiels', reglage: 'mention_moyens', titre: 'Moyens techniques et pédagogiques' },
  { champ: 'accessibility', reglage: 'mention_accessibilite', titre: 'Accessibilité et situation de handicap' },
  { champ: 'delais_acces', reglage: 'mention_delais', titre: 'Délais d’accès' },
];

export function reglagesDe(db) {
  return Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));
}

/**
 * La valeur qui vaut pour ce programme : la sienne si elle existe, sinon
 * celle de l'organisme. Renvoie aussi d'où elle vient, pour que l'interface
 * puisse le dire plutôt que de laisser croire à une saisie locale.
 */
export function mention(formation, reglages, champ) {
  const regle = MENTIONS_HERITEES.find((m) => m.champ === champ);
  const propre = texte(formation?.[champ]);
  if (propre) return { valeur: propre, origine: 'programme' };
  const herite = texte(reglages?.[regle?.reglage]);
  if (herite) return { valeur: herite, origine: 'organisme' };
  return { valeur: '', origine: 'absente' };
}

/** Les quatre d'un coup, résolues. */
export function mentionsResolues(formation, reglages) {
  return Object.fromEntries(MENTIONS_HERITEES.map((m) => [m.champ, mention(formation, reglages, m.champ)]));
}
