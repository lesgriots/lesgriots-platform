import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard, badRequest, toNum } from '@/lib/api-guard';

/**
 * GET /api/qualite/bpf?year=YYYY — Agrégats Bilan Pédagogique et Financier (Cerfa 10443).
 *
 * Retourne pour l'année (sessions dont start_date est dans l'année) :
 *  - nb sessions, nb stagiaires (inscrits distincts), heures-stagiaires
 *  - produits par origine de financement (cadres BPF : cpf, opco, entreprise, stagiaire, autre)
 *  - répartition par formation
 *
 * Heures-stagiaires : formation.duration_hours si renseigné, sinon
 * jours ouvrés de la session × 7h — multiplié par le nb d'inscrits.
 */

function weekdaysCount(startStr, endStr) {
  const start = new Date(`${String(startStr).slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${String(endStr || startStr).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  let count = 0;
  const cur = new Date(start);
  let guard = 0;
  while (cur <= end && guard < 1000) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6) count += 1;
    cur.setUTCDate(cur.getUTCDate() + 1);
    guard += 1;
  }
  return count;
}

/** Mappe une valeur libre de financement vers les cadres BPF. */
function bpfBucket(financement) {
  const f = String(financement || '').toLowerCase();
  if (f.includes('cpf')) return 'cpf';
  if (f.includes('opco') || f.includes('faf') || f.includes('agefice') || f.includes('fifpl')) return 'opco';
  if (f.includes('entreprise') || f.includes('employeur') || f.includes('plan de développement')) return 'entreprise';
  if (f.includes('perso') || f.includes('stagiaire') || f.includes('fonds propres') || f.includes('particulier') || f.includes('autofinanc')) return 'stagiaire';
  if (f.includes('pole emploi') || f.includes('pôle emploi') || f.includes('france travail')) return 'autre_public';
  return 'autre';
}

const BUCKET_LABELS = {
  cpf: 'CPF (Caisse des dépôts)',
  opco: 'OPCO et fonds d\'assurance formation',
  entreprise: 'Entreprises (plan de développement)',
  stagiaire: 'Contrats conclus avec des personnes (fonds propres)',
  autre_public: 'Autres financements publics (France Travail…)',
  autre: 'Autres produits',
};

async function _GET(request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const year = toNum(searchParams.get('year'), new Date().getFullYear());
  if (year < 2000 || year > 2100) return badRequest('year invalide');

  const sessions = db.prepare(`
    SELECT s.*, f.title as formation_title, f.code as formation_code,
      COALESCE(f.duration_hours, 0) as formation_duration_hours
    FROM sessions s
    LEFT JOIN formations f ON f.id = s.formation_id
    WHERE strftime('%Y', s.start_date) = ? AND s.status != 'cancelled'
    ORDER BY s.start_date ASC
  `).all(String(year));

  const sessionIds = sessions.map(s => s.id);

  let inscriptions = [];
  if (sessionIds.length) {
    const placeholders = sessionIds.map(() => '?').join(',');
    inscriptions = db.prepare(`
      SELECT i.session_id, i.apprenant_id, i.financement, COALESCE(i.price_ht, 0) as price_ht
      FROM inscriptions i
      WHERE i.session_id IN (${placeholders}) AND i.status != 'annule'
    `).all(...sessionIds);
  }

  // ── Agrégats globaux ──
  const stagiairesDistincts = new Set(inscriptions.map(i => i.apprenant_id)).size;

  const inscriptionsBySession = {};
  for (const i of inscriptions) {
    inscriptionsBySession[i.session_id] = (inscriptionsBySession[i.session_id] || 0) + 1;
  }

  let heuresStagiaires = 0;
  const parFormation = {};
  for (const s of sessions) {
    const nbInscrits = inscriptionsBySession[s.id] || 0;
    const heuresSession = s.formation_duration_hours > 0
      ? s.formation_duration_hours
      : weekdaysCount(s.start_date, s.end_date) * 7;
    heuresStagiaires += heuresSession * nbInscrits;

    const key = s.formation_id || 'sans_formation';
    if (!parFormation[key]) {
      parFormation[key] = {
        formation_id: s.formation_id,
        code: s.formation_code || '',
        title: s.formation_title || 'Formation inconnue',
        sessions: 0,
        stagiaires: 0,
        heures_stagiaires: 0,
        produits_ht: 0,
      };
    }
    parFormation[key].sessions += 1;
    parFormation[key].stagiaires += nbInscrits;
    parFormation[key].heures_stagiaires += heuresSession * nbInscrits;
  }

  // ── Produits par origine de financement ──
  const sessionById = {};
  for (const s of sessions) sessionById[s.id] = s;

  const produits = {};
  for (const bucket of Object.keys(BUCKET_LABELS)) {
    produits[bucket] = { label: BUCKET_LABELS[bucket], total_ht: 0, inscriptions: 0 };
  }
  let produitsTotal = 0;
  for (const i of inscriptions) {
    const bucket = bpfBucket(i.financement);
    produits[bucket].total_ht += i.price_ht;
    produits[bucket].inscriptions += 1;
    produitsTotal += i.price_ht;

    const s = sessionById[i.session_id];
    const key = s?.formation_id || 'sans_formation';
    if (parFormation[key]) parFormation[key].produits_ht += i.price_ht;
  }
  for (const bucket of Object.keys(produits)) {
    produits[bucket].total_ht = Math.round(produits[bucket].total_ht * 100) / 100;
  }

  return NextResponse.json({
    year,
    nb_sessions: sessions.length,
    nb_stagiaires: stagiairesDistincts,
    nb_inscriptions: inscriptions.length,
    heures_stagiaires: Math.round(heuresStagiaires * 100) / 100,
    produits_total_ht: Math.round(produitsTotal * 100) / 100,
    produits_par_financement: produits,
    par_formation: Object.values(parFormation),
  });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('formations:read', _GET);
