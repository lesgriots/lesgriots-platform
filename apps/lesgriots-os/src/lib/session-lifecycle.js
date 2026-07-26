/**
 * LES GRIOTS OS — Cycle de vie d'une session de formation (Griothèque Pro).
 *
 * Génère la checklist standard des étapes administratives et pédagogiques
 * d'une session, calculée depuis start_date / end_date.
 *
 * Convention : offset négatif = J-x avant le début (ancre start_date),
 * offset positif ou nul côté 'end' = J+x après la fin (ancre end_date).
 * Chaque étape référence l'indicateur Qualiopi (RNQ) concerné dans meta.
 */

export const CHECKLIST_STEPS = [
  { key: 'convention',          label: 'Conventions signées',                        offset: -30, anchor: 'start', indicator: 5 },
  { key: 'programme',           label: 'Programme transmis',                         offset: -30, anchor: 'start', indicator: 1 },
  { key: 'convocations',        label: 'Convocations envoyées',                      offset: -14, anchor: 'start', indicator: null },
  { key: 'positionnement',      label: 'Questionnaires de positionnement envoyés',   offset: -14, anchor: 'start', indicator: 8 },
  { key: 'rappel',              label: 'Rappel + infos pratiques',                   offset: -7,  anchor: 'start', indicator: null },
  { key: 'handicap',            label: 'Besoins spécifiques vérifiés',               offset: -7,  anchor: 'start', indicator: 26 },
  { key: 'emargement',          label: 'Émargements du/des jour(s)',                 offset: 0,   anchor: 'start', indicator: 9 },
  { key: 'satisfaction_chaud',  label: 'Enquête à chaud envoyée',                    offset: 1,   anchor: 'end',   indicator: 30 },
  { key: 'attestations',        label: 'Attestations & certificats émis',            offset: 1,   anchor: 'end',   indicator: 11 },
  { key: 'facturation',         label: 'Facturation émise',                          offset: 7,   anchor: 'end',   indicator: null },
  { key: 'bilan_formateur',     label: 'Bilan formateur recueilli',                  offset: 7,   anchor: 'end',   indicator: 30 },
  { key: 'satisfaction_froid',  label: 'Enquête à froid envoyée',                    offset: 90,  anchor: 'end',   indicator: 30 },
];

/** Ajoute `days` jours à une date ISO 'YYYY-MM-DD' et retourne 'YYYY-MM-DD'. */
export function addDays(isoDate, days) {
  if (!isoDate) return '';
  const d = new Date(`${String(isoDate).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Génère les étapes standard pour une session donnée.
 * @param {object} session — ligne de la table sessions (start_date, end_date requis)
 * @returns {Array<{step_key, label, due_at, meta}>}
 */
export function generateChecklist(session) {
  if (!session) return [];
  const start = String(session.start_date || '').slice(0, 10);
  const end = String(session.end_date || start).slice(0, 10);

  return CHECKLIST_STEPS.map(step => {
    const base = step.anchor === 'end' ? end : start;
    return {
      step_key: step.key,
      label: step.label,
      due_at: addDays(base, step.offset),
      meta: JSON.stringify({
        indicator: step.indicator,
        offset: step.offset,
        anchor: step.anchor,
      }),
    };
  });
}
