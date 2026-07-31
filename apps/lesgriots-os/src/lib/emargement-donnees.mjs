/**
 * emargement-donnees.mjs — ce qu'une feuille d'émargement doit porter.
 *
 * La feuille est une pièce de preuve, pas un document d'accueil : elle est
 * signée, scannée, rangée, et ressortie devant un contrôleur des années plus
 * tard. Elle porte donc l'identité juridique de LES GRIOTS, comme la
 * convention et le devis, et rien de décoratif.
 *
 * Ce que la réglementation attend dessus : l'intitulé de l'action, ses dates
 * et son lieu, l'identité de l'organisme avec son numéro de déclaration
 * d'activité, le nom du formateur, et une signature par demi-journée pour
 * chaque stagiaire comme pour l'intervenant. Une page par journée : une
 * signature ne se pré-imprime pas sur une date qui n'est pas encore arrivée.
 */

const texte = (v) => String(v ?? '').trim();

const jourFr = (v) => {
  if (!v) return '';
  const d = new Date(String(v).length <= 10 ? `${v}T12:00:00` : v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
};

const jourCourt = (v) => {
  if (!v) return '';
  const d = new Date(String(v).length <= 10 ? `${v}T12:00:00` : v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Les journées couvertes par la session, bornes comprises, week-ends exclus. */
function journees(debut, fin) {
  const d0 = new Date(`${String(debut).slice(0, 10)}T12:00:00`);
  const d1 = new Date(`${String(fin || debut).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d0.getTime())) return [];
  const sortie = [];
  for (let d = new Date(d0); d <= (Number.isNaN(d1.getTime()) ? d0 : d1) && sortie.length < 60; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    sortie.push(d.toISOString().slice(0, 10));
  }
  return sortie.length ? sortie : [String(debut).slice(0, 10)];
}

/**
 * Les horaires écrits sur la feuille. Le champ libre de la session peut être
 * « 9h30 - 12h30 / 13h30 - 17h30 » : on le coupe en deux demi-journées. S'il
 * ne se laisse pas couper, les deux colonnes gardent leur intitulé nu, ce qui
 * reste juste : c'est la signature qui fait foi, pas l'horaire imprimé.
 */
function demiJournees(brut) {
  const t = texte(brut);
  const parts = t.split('/').map((x) => x.trim()).filter(Boolean);
  if (parts.length >= 2) return { matin: parts[0], apresMidi: parts.slice(1).join(' / ') };
  return { matin: '', apresMidi: '' };
}

export function construireEmargement(db, sessionId) {
  const s = db.prepare(`
    SELECT s.*, f.title AS formation_titre, f.duration_hours, f.duration_days
    FROM sessions s LEFT JOIN formations f ON f.id = s.formation_id WHERE s.id = ?
  `).get(sessionId);
  if (!s) throw new Error('Session introuvable.');

  const reglages = Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));

  const stagiaires = db.prepare(`
    SELECT a.first_name, a.last_name, a.company FROM apprenants a
    JOIN inscriptions i ON i.apprenant_id = a.id
    WHERE i.session_id = ? ORDER BY a.last_name ASC
  `).all(sessionId).map((a) => ({
    nom: [texte(a.last_name).toUpperCase(), texte(a.first_name)].filter(Boolean).join(' ') || 'Apprenant',
    entreprise: texte(a.company),
  }));

  const formateur = s.formateur_id
    ? db.prepare('SELECT first_name, last_name FROM formateurs WHERE id = ?').get(s.formateur_id)
    : null;
  const intervenant = [formateur?.first_name, formateur?.last_name].filter(Boolean).join(' ').trim()
    || texte(s.formateur_name)
    || texte(reglages.representant_name);

  const heures = Number(s.duration_hours) || 0;
  const { matin, apresMidi } = demiJournees(s.horaire);
  const lieu = texte(s.adresse) || texte(s.location);

  const pages = journees(s.start_date, s.end_date).map((jour) => ({
    jour: jourFr(jour),
    // Chaque page est autonome : imprimée seule, elle dit encore de quelle
    // action et de quel organisme elle est la preuve.
    stagiaires,
  }));

  return {
    titre: 'Feuille d’émargement',
    formation: texte(s.formation_titre) || 'Action de formation',
    periode: (() => {
      const d = jourCourt(s.start_date);
      const f = jourCourt(s.end_date);
      return f && f !== d ? `Du ${d} au ${f}` : `Le ${d}`;
    })(),
    lieu,
    duree: heures ? `${heures} heures` : '',
    modalite: { presentiel: 'Présentiel', distanciel: 'À distance', hybride: 'Mixte' }[s.modality] || 'Présentiel',
    intervenant,
    organisme: [
      texte(reglages.company_name) || 'LES GRIOTS',
      reglages.siret ? `SIRET ${reglages.siret}` : '',
      reglages.nda ? `Déclaration d’activité n° ${reglages.nda}` : '',
    ].filter(Boolean).join(' · '),
    matin: matin || 'Matin',
    apresMidi: apresMidi || 'Après-midi',
    libelleMatin: matin ? 'Matin' : '',
    libelleApresMidi: apresMidi ? 'Après-midi' : '',
    pages,
    faitA: texte(reglages.city) || '',
    piedDePage: [
      texte(reglages.company_name) || 'LES GRIOTS',
      reglages.siret ? `SIRET ${reglages.siret}` : '',
      reglages.nda ? `Déclaration d’activité n° ${reglages.nda}` : '',
      [texte(reglages.address), [reglages.postal_code, reglages.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      texte(reglages.email),
    ].filter(Boolean).join(' · '),
  };
}
