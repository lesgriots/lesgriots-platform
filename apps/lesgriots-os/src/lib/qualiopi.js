/**
 * LES GRIOTS OS — Cockpit Qualiopi (Référentiel National Qualité).
 *
 * Indicateurs RNQ applicables aux actions de formation (catégorie L.6313-1 1°).
 * Certains indicateurs sont calculables automatiquement depuis la base
 * (statut 'auto'), les autres se pilotent par preuves manuelles rattachées
 * (table qualiopi_evidence).
 *
 * Statuts : 'ok' (≥ 80%), 'attention' (≥ 40%), 'manquant' (< 40%), null (non calculable).
 */

export const INDICATORS = [
  { num: 1,  critere: 1, label: 'Diffusion d’une information accessible et exhaustive sur les prestations' },
  { num: 2,  critere: 1, label: 'Indicateurs de résultats communiqués au public' },
  { num: 3,  critere: 1, label: 'Taux d’obtention des certifications (si certifiant)' },
  { num: 4,  critere: 2, label: 'Analyse du besoin du bénéficiaire' },
  { num: 5,  critere: 2, label: 'Objectifs opérationnels et évaluables de la prestation' },
  { num: 6,  critere: 2, label: 'Contenus et modalités adaptés aux objectifs et publics' },
  { num: 8,  critere: 2, label: 'Positionnement et évaluation des acquis à l’entrée' },
  { num: 9,  critere: 3, label: 'Information des publics sur les conditions de déroulement' },
  { num: 10, critere: 3, label: 'Adaptation de la prestation et de l’accompagnement aux bénéficiaires' },
  { num: 11, critere: 3, label: 'Évaluation de l’atteinte des objectifs et attestations' },
  { num: 12, critere: 3, label: 'Prévention des abandons et engagement des bénéficiaires' },
  { num: 17, critere: 4, label: 'Moyens humains et techniques adaptés' },
  { num: 19, critere: 4, label: 'Ressources pédagogiques à disposition des bénéficiaires' },
  { num: 21, critere: 5, label: 'Compétences des intervenants (formateurs qualifiés)' },
  { num: 22, critere: 5, label: 'Gestion des compétences internes' },
  { num: 23, critere: 5, label: 'Développement continu des connaissances et compétences' },
  { num: 24, critere: 6, label: 'Veille légale et réglementaire de la formation' },
  { num: 25, critere: 6, label: 'Veille sur les évolutions des compétences et métiers' },
  { num: 26, critere: 6, label: 'Veille handicap et mobilisation des expertises (référent handicap)' },
  { num: 27, critere: 6, label: 'Conformité de la sous-traitance et du portage salarial' },
  { num: 28, critere: 6, label: 'Coordination des apprentissages en situation de travail (si concerné)' },
  { num: 29, critere: 6, label: 'Insertion professionnelle et poursuite de parcours (si concerné)' },
  { num: 30, critere: 7, label: 'Recueil des appréciations des parties prenantes' },
  { num: 31, critere: 7, label: 'Traitement des réclamations et difficultés' },
  { num: 32, critere: 7, label: 'Amélioration continue à partir des appréciations et réclamations' },
];

function pctStatus(pct) {
  if (pct === null) return null;
  if (pct >= 80) return 'ok';
  if (pct >= 40) return 'attention';
  return 'manquant';
}

function pct(part, total) {
  if (!total) return null;
  return Math.round((part / total) * 100);
}

/**
 * Calcule le statut de chaque indicateur.
 * Retourne un tableau [{ indicator, critere, label, mode, pct, status, detail, evidence_count }].
 */
export function computeQualiopiStatus(db) {
  // ── Données de base ──
  const totalFormations = db.prepare(
    "SELECT COUNT(*) as c FROM formations WHERE status != 'archived'"
  ).get().c;
  const formationsAvecProgramme = db.prepare(`
    SELECT COUNT(*) as c FROM formations
    WHERE status != 'archived'
      AND (COALESCE(description,'') != '' OR COALESCE(program,'{}') NOT IN ('', '{}', '[]'))
  `).get().c;
  const formationsAvecObjectifs = db.prepare(`
    SELECT COUNT(*) as c FROM formations
    WHERE status != 'archived' AND COALESCE(objectives,'[]') NOT IN ('', '[]')
  `).get().c;
  const formationsAvecAccessibilite = db.prepare(`
    SELECT COUNT(*) as c FROM formations
    WHERE status != 'archived' AND COALESCE(accessibility,'') != ''
  `).get().c;

  const sessionsTerminees = db.prepare(
    "SELECT COUNT(*) as c FROM sessions WHERE status = 'completed'"
  ).get().c;
  const sessAvecPositionnement = db.prepare(`
    SELECT COUNT(DISTINCT s.id) as c FROM sessions s
    JOIN evaluations e ON e.session_id = s.id AND e.type = 'positionnement'
    WHERE s.status = 'completed'
  `).get().c;
  const sessAvecAcquis = db.prepare(`
    SELECT COUNT(DISTINCT s.id) as c FROM sessions s
    JOIN evaluations e ON e.session_id = s.id AND e.type = 'acquis'
    WHERE s.status = 'completed'
  `).get().c;
  /*
   * Une ligne d'émargement n'est pas une présence.
   *
   * À chaque inscription, l'OS pré-crée une ligne par apprenant et par journée,
   * matin et après-midi à zéro : le tableau est prêt à être rempli. Le contrôle
   * vérifiait l'existence de ces lignes, donc il était vrai dès le premier
   * inscrit. Une session terminée sans une seule signature comptait comme
   * conforme, et le tableau de bord affichait un indicateur 9 au vert devant
   * un dossier vide.
   *
   * On compte désormais ce qui a été signé : une demi-journée cochée dans le
   * tableau, ou une signature déposée par un apprenant depuis son espace.
   */
  const sessAvecEmargement = db.prepare(`
    SELECT COUNT(DISTINCT s.id) as c FROM sessions s
    WHERE s.status = 'completed'
      AND (EXISTS (SELECT 1 FROM emargements em
                   WHERE em.session_id = s.id AND (em.matin = 1 OR em.apres_midi = 1))
        OR EXISTS (SELECT 1 FROM signatures sg WHERE sg.session_id = s.id))
  `).get().c;
  const sessAvecSatisfaction = db.prepare(`
    SELECT COUNT(DISTINCT s.id) as c FROM sessions s
    JOIN evaluations e ON e.session_id = s.id AND e.type IN ('satisfaction','froid')
    WHERE s.status = 'completed'
  `).get().c;
  const satisfactionMoyenne = db.prepare(`
    SELECT ROUND(AVG(score), 2) as avg_score FROM evaluations
    WHERE type = 'satisfaction' AND score IS NOT NULL
  `).get().avg_score;

  const formateursQualifies = db.prepare(`
    SELECT COUNT(*) as c FROM formateurs WHERE COALESCE(qualifications,'') != ''
  `).get().c;
  const totalFormateurs = db.prepare('SELECT COUNT(*) as c FROM formateurs').get().c;

  // ── Preuves manuelles par indicateur ──
  const evidenceRows = db.prepare(
    'SELECT indicator, COUNT(*) as c FROM qualiopi_evidence GROUP BY indicator'
  ).all();
  const evidenceCount = {};
  for (const r of evidenceRows) evidenceCount[r.indicator] = r.c;

  // ── Calculs auto par indicateur (quand pertinent) ──
  const AUTO = {
    1: () => ({
      pct: pct(formationsAvecProgramme, totalFormations),
      detail: `${formationsAvecProgramme}/${totalFormations} formations avec programme/description publiés`,
    }),
    5: () => ({
      pct: pct(formationsAvecObjectifs, totalFormations),
      detail: `${formationsAvecObjectifs}/${totalFormations} formations avec objectifs opérationnels définis`,
    }),
    8: () => ({
      pct: pct(sessAvecPositionnement, sessionsTerminees),
      detail: `${sessAvecPositionnement}/${sessionsTerminees} sessions terminées avec évaluation de positionnement`,
    }),
    9: () => ({
      pct: pct(sessAvecEmargement, sessionsTerminees),
      detail: `${sessAvecEmargement}/${sessionsTerminees} sessions terminées avec émargements ou signatures`,
    }),
    11: () => ({
      pct: pct(sessAvecAcquis, sessionsTerminees),
      detail: `${sessAvecAcquis}/${sessionsTerminees} sessions terminées avec évaluation des acquis`,
    }),
    21: () => ({
      pct: pct(formateursQualifies, totalFormateurs),
      detail: `${formateursQualifies}/${totalFormateurs} formateurs avec qualifications renseignées`,
    }),
    26: () => ({
      pct: pct(formationsAvecAccessibilite, totalFormations),
      detail: `${formationsAvecAccessibilite}/${totalFormations} formations avec volet accessibilité/handicap renseigné`,
    }),
    30: () => ({
      pct: pct(sessAvecSatisfaction, sessionsTerminees),
      detail: `${sessAvecSatisfaction}/${sessionsTerminees} sessions terminées avec enquête de satisfaction`
        + (satisfactionMoyenne != null ? ` · score moyen ${satisfactionMoyenne}/5` : ''),
    }),
  };

  return INDICATORS.map(ind => {
    const auto = AUTO[ind.num] ? AUTO[ind.num]() : null;
    return {
      indicator: ind.num,
      critere: ind.critere,
      label: ind.label,
      mode: auto ? 'auto' : 'manuel',
      pct: auto ? auto.pct : null,
      status: auto ? pctStatus(auto.pct) : null,
      detail: auto ? auto.detail : 'Pilotage par preuves manuelles',
      evidence_count: evidenceCount[ind.num] || 0,
    };
  });
}
