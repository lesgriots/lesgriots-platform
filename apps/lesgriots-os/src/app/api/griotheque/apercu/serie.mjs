/**
 * La série temporelle du tableau de bord.
 *
 * Deux courbes, une seule vérité de chaque côté :
 *   · réalisé      — sessions terminées, cumulées à leur date de fin ;
 *   · prévisionnel — sessions à venir ou en cours, cumulées à leur date de début.
 *
 * Le pipeline n'entre pas ici. Une affaire au stade « devis envoyé » n'est pas
 * du chiffre d'affaires, et la mélanger à la courbe rendrait les deux illisibles.
 */

export const PERIODES = {
  '30j':   { label: '30 jours',   jours: 30,   pas: 'jour' },
  '90j':   { label: '90 jours',   jours: 90,   pas: 'semaine' },
  '12m':   { label: '12 mois',    jours: 365,  pas: 'mois' },
  'annee': { label: 'Année civile', pas: 'mois' },
  'tout':  { label: 'Tout',        pas: 'mois' },
};

const jour = (d) => new Date(d).toISOString().slice(0, 10);
const ajoute = (d, n) => jour(new Date(new Date(d).getTime() + n * 86400000));

export function bornes(cle, aujourdhui, premiereDate) {
  const p = PERIODES[cle] || PERIODES['12m'];
  if (cle === 'annee') {
    const an = aujourdhui.slice(0, 4);
    return { debut: `${an}-01-01`, fin: `${an}-12-31`, pas: 'mois' };
  }
  if (cle === 'tout') {
    return { debut: premiereDate || ajoute(aujourdhui, -365), fin: ajoute(aujourdhui, 180), pas: 'mois' };
  }
  // On regarde en avant, mais pas indéfiniment : trois mois d'horizon suffisent
  // à voir ce qui est posé sans étirer la courbe sur du vide.
  const horizon = Math.min(90, Math.round(p.jours / 2));
  return { debut: ajoute(aujourdhui, -p.jours), fin: ajoute(aujourdhui, horizon), pas: p.pas };
}

function seaux(debut, fin, pas) {
  const liste = [];
  if (pas === 'mois') {
    let [a, m] = debut.split('-').map(Number);
    const [af, mf] = fin.split('-').map(Number);
    while (a < af || (a === af && m <= mf)) {
      liste.push({ cle: `${a}-${String(m).padStart(2, '0')}`, fin: `${a}-${String(m).padStart(2, '0')}-31` });
      m += 1; if (m > 12) { m = 1; a += 1; }
    }
    return liste;
  }
  const pasJours = pas === 'semaine' ? 7 : 1;
  let d = debut;
  while (d <= fin) { liste.push({ cle: d, fin: ajoute(d, pasJours - 1) }); d = ajoute(d, pasJours); }
  return liste;
}

/**
 * @param {Array} sessions  lignes {start_date, end_date, tarif, status}
 */
export function construireSerie(sessions, cle, aujourdhui) {
  const dates = sessions.map((s) => s.start_date).filter(Boolean).sort();
  const { debut, fin, pas } = bornes(cle, aujourdhui, dates[0]);
  const cases = seaux(debut, fin, pas);

  let realise = 0;
  let prevu = 0;
  const points = [];

  for (const c of cases) {
    for (const s of sessions) {
      if (String(s.status || '').toLowerCase() === 'cancelled') continue;
      const montant = Number(s.tarif) || 0;
      if (!montant) continue;
      const termine = s.end_date && s.end_date < aujourdhui;
      const dateRef = termine ? s.end_date : s.start_date;
      if (!dateRef || dateRef < debut || dateRef > c.fin) continue;
      // Chaque session n'est comptée qu'une fois, au seau qui la contient.
      const seauPrecedent = cases[cases.indexOf(c) - 1];
      if (seauPrecedent && dateRef <= seauPrecedent.fin) continue;
      if (termine) realise += montant; else prevu += montant;
    }
    points.push({ cle: c.cle, realise, previsionnel: realise + prevu, futur: c.cle > aujourdhui.slice(0, c.cle.length) });
  }

  return { debut, fin, pas, points, total_realise: realise, total_previsionnel: prevu };
}
