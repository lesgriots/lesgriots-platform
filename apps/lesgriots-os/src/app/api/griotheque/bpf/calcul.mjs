/**
 * Le Bilan Pédagogique et Financier, calculé à partir des données réelles.
 *
 * Le BPF est une déclaration annuelle obligatoire à la DREETS. Rien n'y est
 * inventé : chaque montant vient d'une inscription facturée, chaque heure
 * d'une session tenue. Quand une case ne peut pas être déduite, elle reste à
 * zéro et attend une saisie — un BPF faux est pire qu'un BPF incomplet.
 *
 * Ventilation des produits : le dispositif est saisi en texte libre sur
 * l'inscription puis sur l'apprenant. On regroupe les variantes d'écriture,
 * exactement comme la page Financeurs, pour ne pas dépendre d'une orthographe.
 */

const sansAccent = (t) => String(t || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Les lignes C du Cerfa, dans l'ordre du formulaire. */
export const LIGNES_PRODUITS = [
  { cle: 'entreprises',   ref: '1',  label: 'Des entreprises pour la formation de leurs salariés' },
  { cle: 'apprentissage', ref: '2a', label: 'Organismes gestionnaires · contrats d’apprentissage' },
  { cle: 'pro',           ref: '2b', label: 'Organismes gestionnaires · contrats de professionnalisation' },
  { cle: 'reconversion',  ref: '2c', label: 'Organismes gestionnaires · promotion ou reconversion par alternance' },
  { cle: 'transition',    ref: '2d', label: 'Organismes gestionnaires · projets de transition professionnelle' },
  { cle: 'cpf',           ref: '2e', label: 'Organismes gestionnaires · compte personnel de formation' },
  { cle: 'autres_opco',   ref: '2f', label: 'Organismes gestionnaires · autres dispositifs' },
  { cle: 'pouvoirs',      ref: '3',  label: 'Des pouvoirs publics (État, Régions, France Travail…)' },
  { cle: 'particuliers',  ref: '4',  label: 'Des particuliers à leurs frais' },
  { cle: 'sous_traitance', ref: '5', label: 'D’autres organismes de formation (sous-traitance)' },
  { cle: 'autres',        ref: '6',  label: 'Autres produits au titre de la formation professionnelle' },
];

/** Où tombe un libellé de financement dans la ventilation du Cerfa. */
function ligneProduit(texte) {
  const t = sansAccent(texte);
  if (!t) return null;
  if (t.includes('cpf') || t.includes('compte personnel')) return 'cpf';
  if (t.includes('opco') || t.includes('faf') || t.includes('fifpl') || t.includes('agefice')) return 'autres_opco';
  if (t.includes('entreprise')) return 'entreprises';
  if (t.includes('personnel') || t.includes('auto')) return 'particuliers';
  if (t.includes('pole emploi') || t.includes('france travail') || t.includes('region') || t.includes('etat')) return 'pouvoirs';
  if (t.includes('sous-trait') || t.includes('sous trait')) return 'sous_traitance';
  return 'autres';
}

/**
 * @param {object} db     base ouverte
 * @param {number} annee  exercice déclaré
 */
export function calculerBpf(db, annee) {
  const debut = `${annee}-01-01`;
  const fin = `${annee}-12-31`;

  // ── Les inscriptions de l'exercice, rattachées à la date de session ──
  const lignes = db.prepare(`
    SELECT i.price_ht, i.financement AS fin_inscription, i.apprenant_id,
           a.financement AS fin_apprenant, a.situation_pro,
           s.id AS session_id, s.start_date, s.end_date, s.status,
           f.duration_hours
    FROM inscriptions i
    LEFT JOIN apprenants a ON a.id = i.apprenant_id
    LEFT JOIN sessions s ON s.id = i.session_id
    LEFT JOIN formations f ON f.id = s.formation_id
    WHERE s.start_date >= ? AND s.start_date <= ?
      AND COALESCE(s.status,'') <> 'cancelled'
  `).all(debut, fin);

  // ── C. Produits ────────────────────────────────────────────────────
  const produits = Object.fromEntries(LIGNES_PRODUITS.map((l) => [l.cle, 0]));
  let nonVentile = 0;
  for (const l of lignes) {
    const montant = Number(l.price_ht) || 0;
    if (!montant) continue;
    const cle = ligneProduit(l.fin_inscription || l.fin_apprenant);
    if (cle) produits[cle] += montant; else nonVentile += montant;
  }
  const totalProduits = Object.values(produits).reduce((t, v) => t + v, 0);

  // ── F. Bilan pédagogique ───────────────────────────────────────────
  const stagiaires = new Set(lignes.map((l) => l.apprenant_id).filter(Boolean)).size;
  const heuresStagiaires = lignes.reduce((t, l) => t + (Number(l.duration_hours) || 0), 0);

  const sessions = db.prepare(`
    SELECT COUNT(*) AS n FROM sessions
    WHERE start_date >= ? AND start_date <= ? AND COALESCE(status,'') <> 'cancelled'
  `).get(debut, fin).n;

  // Heures de formation dispensées : la durée de chaque session, une fois.
  const heuresDispensees = db.prepare(`
    SELECT COALESCE(SUM(f.duration_hours), 0) AS h
    FROM sessions s JOIN formations f ON f.id = s.formation_id
    WHERE s.start_date >= ? AND s.start_date <= ? AND COALESCE(s.status,'') <> 'cancelled'
  `).get(debut, fin).h;

  // ── E. Personnes dispensant les formations ─────────────────────────
  const formateurs = db.prepare(`
    SELECT COUNT(DISTINCT s.formateur_id) AS n FROM sessions s
    WHERE s.start_date >= ? AND s.start_date <= ? AND COALESCE(s.formateur_id,'') <> ''
  `).get(debut, fin).n;

  // ── Ce qui manque pour que la déclaration tienne ────────────────────
  const alertes = [];
  if (nonVentile) {
    alertes.push({
      niveau: 'bloquant',
      texte: `${Math.round(nonVentile)} € facturés sans dispositif de financement renseigné`,
      quoi: 'Ils ne peuvent être rattachés à aucune ligne du Cerfa. Renseigne le financement sur les inscriptions concernées.',
    });
  }
  const sansPrix = lignes.filter((l) => !Number(l.price_ht)).length;
  if (sansPrix) {
    alertes.push({
      niveau: 'attention',
      texte: `${sansPrix} inscription(s) sans montant`,
      quoi: 'Elles comptent dans les stagiaires mais pas dans les produits, ce qui déséquilibre la déclaration.',
    });
  }
  const sansDuree = db.prepare(`
    SELECT COUNT(*) AS n FROM sessions s LEFT JOIN formations f ON f.id = s.formation_id
    WHERE s.start_date >= ? AND s.start_date <= ? AND COALESCE(f.duration_hours, 0) = 0
  `).get(debut, fin).n;
  if (sansDuree) {
    alertes.push({
      niveau: 'attention',
      texte: `${sansDuree} session(s) sur une formation sans durée`,
      quoi: 'Les heures stagiaires seront sous-évaluées. Renseigne la durée dans la fiche du programme.',
    });
  }

  return {
    annee,
    produits,
    total_produits: totalProduits,
    non_ventile: nonVentile,
    pedagogique: {
      stagiaires,
      heures_stagiaires: heuresStagiaires,
      heures_dispensees: heuresDispensees,
      sessions,
      formateurs,
    },
    alertes,
    lignes_comptees: lignes.length,
  };
}
