/**
 * programme-donnees.mjs — ce qu'un programme de formation doit dire.
 *
 * Le layout sait dessiner. Il ne sait pas ce qu'il doit contenir. Ce fichier
 * répond à la deuxième question : il va chercher dans la base tout ce qui
 * compose un programme, et il dit ce qui manque.
 *
 * La liste des mentions ci-dessous n'est pas une préférence de rédaction.
 * Elle vient du référentiel national qualité et de l'article L.6353-1 : un
 * programme sans objectifs, sans prérequis, sans modalités d'évaluation, sans
 * délais d'accès ou sans mention d'accessibilité est un programme qu'un
 * auditeur reprend. Le générateur refuse donc de produire un document
 * incomplet sans qu'on le lui demande explicitement.
 *
 * Le comparatif qui a servi de mètre étalon : un catalogue d'organisme du
 * même secteur, où chaque fiche porte le profil de l'intervenant, le déroulé
 * jour par jour, la durée de chaque module, les horaires réels, les moyens
 * techniques et les taux de satisfaction. Six choses que nous n'avions pas.
 */

/* ── Lire ce que la base contient vraiment ────────────────────────────── */

/**
 * Les listes arrivent sous trois écritures selon leur âge : un tableau JSON,
 * un texte à puces, ou un texte à retours à la ligne. On accepte les trois
 * plutôt que d'exiger une migration.
 */
export function liste(brut) {
  if (!brut) return [];
  if (Array.isArray(brut)) return brut.map(String).map((s) => s.trim()).filter(Boolean);
  const texte = String(brut).trim();
  if (!texte) return [];
  if (texte.startsWith('[')) {
    try {
      const j = JSON.parse(texte);
      if (Array.isArray(j)) return j.map(String).map((s) => s.trim()).filter(Boolean);
    } catch { /* ce n'était pas du JSON */ }
  }
  return texte
    .split(/\r?\n|·|;/)
    .map((s) => s.replace(/^\s*[-—•*]\s*/, '').trim())
    .filter(Boolean);
}

const texte = (v) => String(v ?? '').trim();

const euros = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(Number(n) || 0);

const heures = (h) => {
  const n = Number(h) || 0;
  if (!n) return '';
  return Number.isInteger(n) ? `${n} h` : `${n.toString().replace('.', ',')} h`;
};

const jourFr = (v) => {
  if (!v) return '';
  const d = new Date(String(v).length <= 10 ? `${v}T12:00:00` : v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

/* ── Les mentions attendues ───────────────────────────────────────────── */

/**
 * `ou` liste les champs qui peuvent porter la mention : la première valeur
 * trouvée suffit. `ou_remplir` dit où aller la saisir, pour que le message
 * d'erreur soit une instruction et pas un reproche.
 */
export const MENTIONS = [
  { cle: 'objectifs', libelle: 'Objectifs pédagogiques', ou: ['objectives'], ou_remplir: 'Bibliothèque · le programme · Objectifs' },
  { cle: 'audience', libelle: 'Public visé', ou: ['target_audience'], ou_remplir: 'Bibliothèque · le programme · Public visé' },
  { cle: 'prerequis', libelle: 'Prérequis', ou: ['prerequisites'], ou_remplir: 'Bibliothèque · le programme · Prérequis' },
  { cle: 'duree', libelle: 'Durée', ou: ['duration_hours', 'duration_days'], ou_remplir: 'Bibliothèque · le programme · Durée' },
  { cle: 'modules', libelle: 'Contenu détaillé', ou: ['__modules'], ou_remplir: 'Bibliothèque · le programme · Modules' },
  { cle: 'evaluation', libelle: 'Modalités d’évaluation', ou: ['evaluation_methods'], ou_remplir: 'Bibliothèque · le programme · Évaluation' },
  { cle: 'methodes', libelle: 'Méthodes pédagogiques', ou: ['modalites_pedagogiques'], ou_remplir: 'Bibliothèque · le programme · Modalités pédagogiques' },
  { cle: 'moyens', libelle: 'Moyens techniques', ou: ['moyens_materiels'], ou_remplir: 'Bibliothèque · le programme · Moyens matériels' },
  { cle: 'accessibilite', libelle: 'Accessibilité et handicap', ou: ['accessibility'], ou_remplir: 'Bibliothèque · le programme · Accessibilité' },
  { cle: 'delais', libelle: 'Délais d’accès', ou: ['delais_acces'], ou_remplir: 'Bibliothèque · le programme · Délais d’accès' },
  { cle: 'tarif', libelle: 'Tarif', ou: ['price_ht'], ou_remplir: 'Bibliothèque · le programme · Prix' },
];

/**
 * Une mention est remplie, ou elle ne l'est pas. Cette fonction est le seul
 * juge : la génération d'un PDF et l'indicateur de la bibliothèque doivent
 * répondre la même chose, sinon l'un des deux ment.
 */
export function evaluerMentions(formation, nbModules = 0) {
  const rempli = (champ) => {
    if (champ === '__modules') return nbModules > 0;
    const v = formation[champ];
    if (v === null || v === undefined) return false;
    if (typeof v === 'number') return v > 0;
    return liste(v).length > 0 || texte(v).length > 0;
  };

  const detail = MENTIONS.map((m) => ({
    libelle: m.libelle,
    ou_remplir: m.ou_remplir,
    rempli: m.ou.some(rempli),
  }));

  const remplies = detail.filter((d) => d.rempli).length;
  return {
    detail,
    remplies,
    total: detail.length,
    pourcentage: Math.round((remplies / detail.length) * 100),
    manques: detail.filter((d) => !d.rempli).map(({ libelle, ou_remplir }) => ({ libelle, ou_remplir })),
  };
}

/**
 * La complétude de tous les programmes, en une seule requête.
 *
 * Un pourcentage n'est pas un jugement de qualité : il ne dit pas si le
 * texte est bon, seulement s'il existe. C'est déjà ce qui manquait le plus.
 */
export function completudeFormations(db, { inclureArchives = false } = {}) {
  const formations = db.prepare(`
    SELECT f.*, (SELECT COUNT(*) FROM modules m WHERE m.formation_id = f.id) AS nb_modules
    FROM formations f
    ${inclureArchives ? '' : "WHERE COALESCE(f.status, '') <> 'archived'"}
    ORDER BY f.title COLLATE NOCASE ASC
  `).all();

  return formations.map((f) => {
    const bilan = evaluerMentions(f, f.nb_modules);
    return {
      id: f.id,
      titre: texte(f.title),
      code: texte(f.code),
      pourcentage: bilan.pourcentage,
      remplies: bilan.remplies,
      total: bilan.total,
      manques: bilan.manques,
      publiable: bilan.manques.length === 0,
    };
  });
}

/* ── Construire le programme ──────────────────────────────────────────── */

/**
 * Renvoie `{ valeurs, manques, formation }`.
 *
 * `valeurs` part directement au layout. `manques` liste les mentions vides,
 * avec l'endroit où les saisir. Une mention absente n'est jamais remplacée
 * par un texte générique : un programme qui invente ses modalités
 * d'évaluation ment à l'apprenant et à l'auditeur.
 */
export function construireProgramme(db, formationId) {
  const f = db.prepare('SELECT * FROM formations WHERE id = ?').get(formationId);
  if (!f) throw new Error('Formation introuvable.');

  const modules = db.prepare(
    'SELECT * FROM modules WHERE formation_id = ? ORDER BY sort_order ASC, created_at ASC',
  ).all(formationId);

  const reglages = Object.fromEntries(
    db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]),
  );

  // Les intervenants : indicateur 21 du référentiel. Un programme qui ne dit
  // pas qui anime ne prouve rien sur la compétence de l'animateur.
  const intervenants = db.prepare(`
    SELECT DISTINCT fo.id, fo.first_name, fo.last_name, fo.biographie, fo.qualifications
    FROM formateurs fo
    JOIN sessions s ON s.formateur_id = fo.id
    WHERE s.formation_id = ? AND COALESCE(fo.statut_collab, 'actif') <> 'inactif'
  `).all(formationId);

  // Les appréciations : indicateur 30. On n'affiche un taux que s'il repose
  // sur de vraies réponses ; un « 100 % » calculé sur zéro avis est un
  // mensonge poli.
  let satisfaction = null;
  try {
    const r = db.prepare(`
      SELECT COUNT(*) AS n, AVG(CAST(note AS REAL)) AS moyenne
      FROM evaluations e JOIN sessions s ON s.id = e.session_id
      WHERE s.formation_id = ? AND e.note IS NOT NULL AND e.note <> ''
    `).get(formationId);
    if (r?.n >= 3) satisfaction = { repondants: r.n, moyenne: Math.round(r.moyenne * 10) / 10 };
  } catch { /* le schéma des évaluations varie : on s'en passe */ }

  /* ── Les manques, avant toute mise en forme ─────────────────────────── */

  const bilan = evaluerMentions(f, modules.length);
  const manques = bilan.manques;

  /* ── La mise en forme ───────────────────────────────────────────────── */

  const totalHeures = Number(f.duration_hours) || modules.reduce((t, m) => t + (Number(m.duration_hours) || 0), 0);
  const jours = Number(f.duration_days) || (totalHeures ? Math.round(totalHeures / 7) : 0);
  const dureeLisible = [
    jours ? `${jours} journée${jours > 1 ? 's' : ''}` : '',
    totalHeures ? `${heures(totalHeures)}` : '',
  ].filter(Boolean).join(' · ');

  const MODALITES = { presentiel: 'Présentiel', distanciel: 'À distance', hybride: 'Mixte' };

  const infos = [
    ['Durée', dureeLisible],
    ['Modalité', MODALITES[f.modality] || 'Présentiel'],
    ['Effectif', f.max_participants ? `${f.max_participants} personnes max.` : ''],
    ['Tarif', Number(f.price_ht) > 0 ? `${euros(f.price_ht)} HT` : ''],
    ['Délai d’accès', texte(f.delais_acces)],
    ['Certification', texte(f.certification)],
  ].filter(([, v]) => v).map(([label, value]) => ({ label, value }));

  const societe = [
    ['Raison sociale', texte(reglages.company_name)],
    ['SIRET', texte(reglages.siret)],
    ['N° de déclaration d’activité', texte(reglages.nda)],
    ['Adresse', [texte(reglages.address), [reglages.postal_code, reglages.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')],
    ['Contact', texte(reglages.email)],
    ['Représentant', [reglages.representant_name, reglages.representant_title].filter(Boolean).join(' · ')],
  ].filter(([, v]) => v).map(([label, value]) => ({ label, value }));

  const modulesRendus = modules.map((m, i) => ({
    n: String(i + 1).padStart(2, '0'),
    label: texte(m.title) || `Module ${i + 1}`,
    detail: texte(m.description) || liste(m.objectives).join(' · '),
    heures: heures(m.duration_hours),
  }));

  const intervenantsRendus = intervenants.map((i) => ({
    nom: [i.first_name, i.last_name].filter(Boolean).join(' ').trim() || 'Intervenant',
    bio: texte(i.biographie),
    qualifications: liste(i.qualifications).join(' · '),
  })).filter((i) => i.nom);

  return {
    formation: f,
    manques,
    completude: { pourcentage: bilan.pourcentage, remplies: bilan.remplies, total: bilan.total },
    valeurs: {
      kicker: texte(f.type_formation) || 'Formation',
      category: texte(f.categorie) || texte(f.thematique) || 'Formation',
      title: texte(f.title),
      heroMeta: dureeLisible,
      constat: texte(f.description) || texte(f.probleme_resolu),
      prerequis: liste(f.prerequisites),
      effectif: f.max_participants ? `${f.max_participants} participants maximum.` : '',
      objectifs: liste(f.objectives),
      audience: liste(f.target_audience),
      modules: modulesRendus,
      infos,
      societe,
      maj: new Date().toLocaleDateString('fr-FR'),
      piedDePage: [
        texte(reglages.company_name) || 'LES GRIOTS',
        reglages.siret ? `SIRET ${reglages.siret}` : '',
        reglages.nda ? `Déclaration d'activité n° ${reglages.nda}` : '',
        [texte(reglages.address), [reglages.postal_code, reglages.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
        texte(reglages.email),
      ].filter(Boolean).join(' · '),

      // ── Les six blocs qui manquaient ────────────────────────────────
      methodes: texte(f.modalites_pedagogiques),
      evaluation: texte(f.evaluation_methods),
      moyens: texte(f.moyens_materiels),
      accessibilite: texte(f.accessibility),
      intervenants: intervenantsRendus,
      satisfaction,
      totalHeures: heures(totalHeures),
    },
  };
}

/**
 * Le déroulé jour par jour d'une session : ce que le catalogue de référence
 * met sur une page entière. Il ne se déduit pas du programme, il se lit sur
 * les modules d'une session datée.
 */
export function derouleSession(db, sessionId) {
  if (!sessionId) return [];
  const modules = db.prepare(`
    SELECT title, description, duration_hours, sort_order
    FROM session_modules WHERE session_id = ? ORDER BY sort_order ASC, created_at ASC
  `).all(sessionId);
  if (!modules.length) return [];

  const session = db.prepare('SELECT start_date, end_date FROM sessions WHERE id = ?').get(sessionId);
  return modules.map((m, i) => ({
    jour: `Jour ${i + 1}`,
    date: jourFr(i === 0 ? session?.start_date : ''),
    titre: texte(m.title),
    detail: texte(m.description),
    heures: heures(m.duration_hours),
  }));
}
