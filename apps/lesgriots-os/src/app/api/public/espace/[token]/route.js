/**
 * API PUBLIQUE — l'espace apprenant, par jeton personnel.
 *
 * SANS withGuard : c'est l'apprenant qui vient, il n'a pas de compte. Le jeton
 * vaut l'identité, donc deux règles absolues.
 *
 *   1. Rien de sensible ne sort. Pas d'email, pas de téléphone, pas de tarif,
 *      pas la liste des autres inscrits. L'apprenant voit sa formation et lui.
 *   2. Rien ne s'écrit deux fois. Une évaluation déjà remise ne se réécrit pas,
 *      une demi-journée déjà signée non plus.
 *
 * Le moteur des questionnaires existait déjà (lib/questionnaires.js) et n'avait
 * jamais servi, faute de page pour l'afficher.
 */
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/db.mjs';
import { QUESTIONNAIRES, QUESTIONNAIRE_TYPE_TO_EVALUATION } from '@/lib/questionnaires';
import { definitionEffective, calculerScore } from '@/lib/questionnaires-formation.mjs';

const MAX_PNG = 200 * 1024;

/**
 * Deux sortes de jetons ouvrent le même espace.
 *
 * Le lien personnel, permanent, qui part dans les convocations. Et le lien
 * temporaire, que l'apprenant se fait envoyer sur son adresse et qui meurt
 * après deux heures. Le second est le plus sûr : transféré, il ne vaudra
 * bientôt plus rien.
 */
function resoudre(db, token) {
  if (!token || typeof token !== 'string' || token.length > 128) return null;

  const temporaire = db.prepare('SELECT * FROM espace_acces WHERE token = ?').get(token);
  if (temporaire) {
    if (temporaire.expires_at && temporaire.expires_at < new Date().toISOString()) return null;
    return { ...temporaire, temporaire: true };
  }

  const l = db.prepare('SELECT * FROM espace_liens WHERE token = ?').get(token);
  if (!l) return null;
  if (l.expires_at && l.expires_at < new Date().toISOString().slice(0, 10)) return null;
  return l;
}

const reglage = (db, cle, defaut = '') => {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(cle);
  return r && r.value ? r.value : defaut;
};

/** Les jours de formation : le planning s'il existe, sinon les jours ouvrés. */
function joursDeSession(s) {
  try {
    const p = JSON.parse(s.planning || 'null');
    if (Array.isArray(p) && p.length) return p.map((j) => (typeof j === 'string' ? j : j.date)).filter(Boolean);
  } catch { /* planning libre ou absent : on retombe sur le calcul */ }
  if (!s.start_date) return [];
  const jours = [];
  const fin = s.end_date || s.start_date;
  for (let d = new Date(s.start_date); d <= new Date(fin); d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) jours.push(d.toISOString().slice(0, 10));
  }
  return jours.slice(0, 30);
}

/** Plusieurs champs sont stockés en JSON : on les rend lisibles ou on les tait. */
function enListe(v) {
  if (!v) return [];
  try {
    const j = JSON.parse(v);
    if (Array.isArray(j)) return j.filter(Boolean).map(String);
    if (typeof j === 'string') return j ? [j] : [];
  } catch { /* texte libre */ }
  // Tes fiches utilisent souvent la puce « • » comme séparateur au fil du
  // texte : on la traite comme un retour à la ligne, sinon l'apprenant lit un
  // paragraphe illisible là où il y avait une liste.
  return String(v).split(/\r?\n|\s*•\s*|\s*·\s+-\s*/)
    .map((x) => x.replace(/^[-–]\s*/, '').trim())
    .filter((x) => x.length > 1);
}

/**
 * Ce que l'espace montre. Chaque option a une raison d'être réglable :
 * un intra n'expose pas la liste des participants, les boutons d'émargement
 * n'ont de sens que si la présence se signe en ligne, et le programme n'est
 * pas toujours prêt à être publié.
 */
export const OPTIONS_ESPACE = {
  lieu: true,
  formateur: true,
  programme: true,
  documents: true,
  emargement: true,
  questionnaires: true,
};

/** Réglages de la session, sinon ceux de l'organisme, sinon la valeur d'usine. */
function optionsEspace(db, session) {
  let defauts = {};
  try { defauts = JSON.parse(reglage(db, 'espace_options_defaut', '{}')) || {}; } catch { defauts = {}; }
  let propres = {};
  try { propres = JSON.parse(session.espace_options || '{}') || {}; } catch { propres = {}; }
  return { ...OPTIONS_ESPACE, ...defauts, ...propres };
}

export async function GET(request, { params }) {
  try {
    const db = getDb();
    const lien = resoudre(db, (await params).token);
    if (!lien) return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 404 });

    const a = db.prepare('SELECT first_name, last_name FROM apprenants WHERE id = ?').get(lien.apprenant_id);
    const s = db.prepare(`
      SELECT s.*, f.title AS formation_titre, f.description AS formation_description,
             f.evaluations_associees AS formation_evaluations,
             f.duration_hours, f.objectives, f.prerequisites, f.target_audience,
             f.evaluation_methods, f.accessibility, f.level
      FROM sessions s LEFT JOIN formations f ON f.id = s.formation_id
      WHERE s.id = ?
    `).get(lien.session_id);
    if (!s) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 });

    const lieu = s.lieu_formation_id
      ? db.prepare('SELECT nom, adresse, postal_code, ville, accessibilite_pmr FROM lieux_formation WHERE id = ?').get(s.lieu_formation_id)
      : null;

    const modules = db.prepare(`
      SELECT title, description, objectives, duration_hours FROM modules
      WHERE formation_id = ? ORDER BY sort_order
    `).all(s.formation_id);

    /*
     * Ce que l'apprenant voit, et ce qu'il ne doit pas voir.
     *
     * Le tri se fait par liste blanche, et c'est délibéré. Une liste
     * d'exclusions échoue en s'ouvrant : toute catégorie nouvelle devient
     * visible par défaut, et c'est exactement ainsi que la feuille
     * d'émargement s'est retrouvée dans cet écran, avec les signatures
     * manuscrites de tous les participants. Une liste blanche échoue en se
     * fermant : au pire un document manque, et cela se voit.
     *
     * Ses pièces nominatives lui appartiennent : convocation, attestation,
     * certificat. Elles sortent sans discussion.
     *
     * Des pièces de session, il ne reste que les ressources pédagogiques :
     * le workbook, les supports. Le reste ne le concerne pas, ou concerne
     * les autres.
     */
    const CATEGORIES_APPRENANT = ['convocation', 'attestation', 'certificat', 'support'];
    const RESSOURCES_SESSION = ['support'];

    /*
     * Le workbook s'ouvre le matin du premier jour, et se referme trente
     * jours après la fin.
     *
     * Pas avant, parce qu'un support distribué trois semaines à l'avance est
     * lu en diagonale, oublié, et qu'il enlève à la séance l'effet de
     * découverte sur lequel repose l'exercice.
     *
     * Pas indéfiniment non plus. Les supports restent la propriété de
     * l'organisme et l'article 9 de la convention l'écrit noir sur blanc :
     * un lien qui reste ouvert des années finit par circuler. Trente jours
     * laissent le temps de reprendre ses notes et de finir ses exercices,
     * ce qui est l'usage légitime.
     */
    const RETRAIT_JOURS = 30;
    const aujourdhui = new Date().toISOString().slice(0, 10);

    const debut = s.start_date ? String(s.start_date).slice(0, 10) : '';
    const finFormation = String(s.end_date || s.start_date || '').slice(0, 10);
    const limite = (() => {
      if (!finFormation) return '';
      const d = new Date(`${finFormation}T12:00:00`);
      if (Number.isNaN(d.getTime())) return '';
      d.setDate(d.getDate() + RETRAIT_JOURS);
      return d.toISOString().slice(0, 10);
    })();

    const commencee = !debut || debut <= aujourdhui;
    const retiree = Boolean(limite) && aujourdhui > limite;
    const formationCommencee = commencee && !retiree;

    const documents = db.prepare(`
      SELECT id, categorie, libelle, created_at FROM documents
      WHERE COALESCE(archived, 0) = 0
        AND (
          (contexte_type = 'apprenant' AND contexte_id = ?
           AND COALESCE(categorie, '') IN (${CATEGORIES_APPRENANT.map(() => '?').join(', ')}))
          OR
          (contexte_type = 'session' AND contexte_id = ?
           AND COALESCE(categorie, '') IN (${RESSOURCES_SESSION.map(() => '?').join(', ')}))
        )
      ORDER BY created_at DESC
    `).all(lien.apprenant_id, ...CATEGORIES_APPRENANT, lien.session_id, ...RESSOURCES_SESSION)
      // Une ressource de session est un support de travail : elle attend le
      // jour J. Les pièces nominatives, elles, ne sont jamais retenues.
      .filter((doc) => formationCommencee || doc.categorie !== 'support');

    /* Les ressources rattachées au programme, choisies pour l'apprenant sur
       sa fiche catalogue. Même règle d'ouverture que le workbook. */
    const ressources = formationCommencee && s.formation_id
      ? db.prepare(`
          SELECT id, title, resource_type, url FROM formation_resources
          WHERE formation_id = ? AND scope = 'learner' ORDER BY created_at ASC
        `).all(s.formation_id)
      : [];

    const jours = joursDeSession(s);
    const signees = db.prepare(`
      SELECT date, period FROM signatures
      WHERE session_id = ? AND apprenant_id = ? AND signer_role = 'apprenant'
    `).all(lien.session_id, lien.apprenant_id).map((x) => x.date + '·' + x.period);

    const rendues = db.prepare(`
      SELECT type FROM evaluations WHERE session_id = ? AND apprenant_id = ?
    `).all(lien.session_id, lien.apprenant_id).map((x) => x.type);

    const auj = new Date().toISOString().slice(0, 10);
    const terminee = s.end_date && s.end_date < auj;

    // Ce qu'on demande à l'apprenant, et seulement au bon moment.
    /**
     * Les questionnaires retenus sur la fiche du programme.
     *
     * Jusqu'ici cette sélection était écrite mais jamais lue : cocher ou
     * décocher ne changeait rien pour l'apprenant. Une liste vide veut dire
     * « rien de choisi », et on sert alors les trois, comme avant.
     */
    let retenus = [];
    try { retenus = JSON.parse(s.formation_evaluations || '[]') || []; } catch { retenus = []; }
    const retenu = (cle) => !retenus.length || retenus.includes(cle);

    const aFaire = [];
    if (!rendues.includes('positionnement')) {
      if (retenu('positionnement')) aFaire.push({ cle: 'positionnement', label: QUESTIONNAIRES.positionnement.label, quand: 'avant la formation' });
    }
    if (terminee && !rendues.includes('satisfaction')) {
      if (retenu('chaud')) aFaire.push({ cle: 'chaud', label: QUESTIONNAIRES.chaud.label, quand: 'à la fin de la formation' });
    }
    if (terminee && rendues.includes('satisfaction') && !rendues.includes('froid')) {
      if (retenu('froid')) aFaire.push({ cle: 'froid', label: QUESTIONNAIRES.froid.label, quand: 'quelques semaines après' });
    }

    const options = optionsEspace(db, s);

    return NextResponse.json({
      options,
      apprenant: { prenom: a?.first_name || '', nom: a?.last_name || '' },
      session: {
        titre: s.espace_nom_public || s.session_name || s.formation_titre || 'Votre formation',
        presentation: s.espace_description || '',
        formation: s.formation_titre || '',
        description: s.formation_description || '',
        debut: s.start_date, fin: s.end_date, horaire: s.horaire || '',
        modalite: s.modality || '', formateur: s.formateur_name || '',
        duree_heures: s.duration_hours || 0,
        niveau: s.level || '',
        objectifs: enListe(s.objectives),
        prerequis: enListe(s.prerequisites),
        public_vise: enListe(s.target_audience),
        evaluation: enListe(s.evaluation_methods),
        accessibilite: s.accessibility || (lieu && lieu.accessibilite_pmr ? 'Locaux accessibles aux personnes à mobilité réduite.' : ''),
        formateur_visible: options.formateur !== false,
        lieu: options.lieu === false ? null : (lieu
          ? { nom: lieu.nom, adresse: [lieu.adresse, lieu.postal_code, lieu.ville].filter(Boolean).join(', ') }
          : (s.adresse || s.location ? { nom: '', adresse: s.adresse || s.location } : null)),
        terminee,
      },
      modules: options.programme === false ? [] : modules.map((m) => ({
        titre: m.title, description: m.description,
        objectifs: enListe(m.objectives), heures: m.duration_hours || 0,
      })),
      documents: options.documents === false ? [] : documents,
      ressources: options.documents === false ? [] : ressources,
      ressources_ouvertes: formationCommencee,
      // Deux fermetures, deux raisons : l'écran ne doit pas dire « pas encore »
      // à quelqu'un dont le délai est passé.
      ressources_etat: formationCommencee ? 'ouvertes' : (retiree ? 'retirees' : 'a_venir'),
      ressources_jusqu_au: limite,
      emargement: options.emargement === false ? { jours: [], signees } : { jours, signees },
      a_faire: options.questionnaires === false ? [] : aFaire,
      rendues,
      organisme: {
        // Deux noms, et ce n'est pas une coquetterie : l'apprenant est reçu
        // par LA GRIOTHÈQUE, la personne morale qui l'engage et déclare son
        // activité est LES GRIOTS. La marque en tête, la raison sociale au
        // pied, comme sur les documents d'accueil.
        marque: reglage(db, 'marque_formation', 'LA GRIOTHÈQUE'),
        nom: reglage(db, 'company_name', 'LA GRIOTHÈQUE'),
        nda: reglage(db, 'nda') || reglage(db, 'numero_declaration'),
        email: reglage(db, 'email', 'formation@lesgriots.com'),
        telephone: reglage(db, 'phone'),
        referent_handicap: reglage(db, 'referent_handicap', reglage(db, 'representant_name')),
      },
    });
  } catch (e) {
    console.error('[public/espace]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const db = getDb();
    const lien = resoudre(db, (await params).token);
    if (!lien) return NextResponse.json({ error: 'Lien invalide ou expiré' }, { status: 404 });

    const corps = await request.json();

    // ── Émargement ──────────────────────────────────────────────────
    if (corps.action === 'emarger') {
      const { date, period, signaturePng, signedName } = corps;
      if (!date || !period) return NextResponse.json({ error: 'Date et demi-journée requises' }, { status: 400 });
      if (signaturePng && signaturePng.length > MAX_PNG * 1.4) {
        return NextResponse.json({ error: 'Signature trop lourde' }, { status: 413 });
      }
      if (!['matin', 'apres_midi'].includes(period)) {
        return NextResponse.json({ error: 'Demi-journée inconnue' }, { status: 400 });
      }
      // On ne signe pas l'avenir. Une présence attestée avant la séance ne
      // prouve rien, et un auditeur écarte la feuille entière pour ça.
      const aujourdhui = new Date().toISOString().slice(0, 10);
      if (String(date) > aujourdhui) {
        return NextResponse.json(
          { error: 'Cette demi-journée n’a pas encore eu lieu : l’émargement s’ouvre le jour même.' },
          { status: 409 },
        );
      }
      const deja = db.prepare(`
        SELECT id FROM signatures WHERE session_id = ? AND apprenant_id = ?
          AND signer_role = 'apprenant' AND date = ? AND period = ?
      `).get(lien.session_id, lien.apprenant_id, date, period);
      if (deja) return NextResponse.json({ error: 'Demi-journée déjà signée' }, { status: 409 });

      if (!signaturePng) return NextResponse.json({ error: 'Signature manquante' }, { status: 400 });
      db.prepare(`
        INSERT INTO signatures (id, session_id, apprenant_id, signer_role, date, period, signature_png, signed_name, ip)
        VALUES (?, ?, ?, 'apprenant', ?, ?, ?, ?, ?)
      `).run(randomUUID(), lien.session_id, lien.apprenant_id, date, period,
             signaturePng, signedName || '',
             request.headers.get('x-forwarded-for') || '');

      // La signature fait foi : la feuille de présence suit, sur la même ligne
      // de jour, en cochant la demi-journée signée.
      const existant = db.prepare('SELECT id FROM emargements WHERE session_id = ? AND apprenant_id = ? AND date = ?')
        .get(lien.session_id, lien.apprenant_id, date);
      const colonne = period === 'matin' ? 'matin' : 'apres_midi';
      if (existant) {
        db.prepare(`UPDATE emargements SET ${colonne} = 1 WHERE id = ?`).run(existant.id);
      } else {
        db.prepare(`INSERT INTO emargements (id, session_id, apprenant_id, date, ${colonne}) VALUES (?, ?, ?, ?, 1)`)
          .run(randomUUID(), lien.session_id, lien.apprenant_id, date);
      }

      return NextResponse.json({ ok: true }, { status: 201 });
    }

    // ── Questionnaire ───────────────────────────────────────────────
    if (corps.action === 'questionnaire') {
      // On valide et on note sur les questions réellement posées, celles du
      // programme : sinon une question sur mesure serait ignorée en silence.
      const laSession = db.prepare('SELECT formation_id FROM sessions WHERE id = ?').get(lien.session_id);
      const q = definitionEffective(db, laSession?.formation_id, corps.type);
      if (!q) return NextResponse.json({ error: 'Questionnaire inconnu' }, { status: 400 });
      const typeEval = QUESTIONNAIRE_TYPE_TO_EVALUATION[corps.type];
      if (!typeEval) return NextResponse.json({ error: 'Questionnaire non recevable ici' }, { status: 400 });

      const deja = db.prepare(`
        SELECT id FROM evaluations WHERE session_id = ? AND apprenant_id = ? AND type = ?
      `).get(lien.session_id, lien.apprenant_id, typeEval);
      if (deja) return NextResponse.json({ error: 'Déjà répondu' }, { status: 409 });

      const reponses = corps.answers || {};
      const vide = (v) => v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
      const manquante = q.questions.find((x) => x.required && x.type !== 'section' && vide(reponses[x.key]));
      if (manquante) return NextResponse.json({ error: `Réponse attendue : ${manquante.label}` }, { status: 400 });

      db.prepare(`
        INSERT INTO evaluations (id, session_id, apprenant_id, type, score, responses, comments)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), lien.session_id, lien.apprenant_id, typeEval,
             calculerScore(q.questions, reponses), JSON.stringify(reponses), corps.comments || '');

      return NextResponse.json({ ok: true }, { status: 201 });
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
  } catch (e) {
    console.error('[public/espace POST]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
