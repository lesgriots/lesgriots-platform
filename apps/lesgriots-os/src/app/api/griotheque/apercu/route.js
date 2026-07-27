/**
 * /api/griotheque/apercu — les chiffres de la vue d'ensemble de l'OF.
 *
 * Une seule requête pour toute la page : indicateurs du trimestre, prochaines
 * sessions, conformité Qualiopi, points à traiter, satisfaction par formation
 * et documents à produire.
 *
 * Principe : aucun chiffre inventé. Quand une donnée n'existe pas encore
 * (aucune évaluation saisie, par exemple), on renvoie null et l'interface
 * affiche un tiret plutôt qu'un zéro trompeur.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { construireSerie, PERIODES } from './serie.mjs';

const PIECES_ATTENDUES = ['kbis', 'nda', 'qualiopi', 'assurance_rc', 'urssaf'];

// Le nom administratif exact, pas la clé technique : on lit une liste de
// pièces à fournir, pas un schéma de base de données.
const LIBELLES_PIECES = {
  kbis: 'extrait Kbis',
  nda: 'déclaration d\u2019activité (NDA)',
  qualiopi: 'certificat Qualiopi',
  assurance_rc: 'attestation de responsabilité civile',
  urssaf: 'attestation de vigilance URSSAF',
};
const libellePiece = (t) => LIBELLES_PIECES[t] || t.replace('_', ' ');

async function _GET(request) {
  try {
    const db = getDb();
    const auj = new Date().toISOString().slice(0, 10);

    // La durée choisie pilote les indicateurs ET la courbe.
    const periode = new URL(request.url).searchParams.get('periode') || '12m';
    const dans90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

    // ── Indicateurs ────────────────────────────────────────────────────
    const sessionsAvenir = db.prepare(`
      SELECT COUNT(*) AS n FROM sessions
      WHERE start_date >= ? AND COALESCE(status,'') NOT IN ('annulee','archivee')
    `).get(auj).n;

    const inscrits = db.prepare(`
      SELECT COUNT(DISTINCT apprenant_id) AS n FROM inscriptions
    `).get().n;

    const enAttenteFin = db.prepare(`
      SELECT COUNT(*) AS n FROM inscriptions
      WHERE COALESCE(financement,'') <> '' AND COALESCE(status,'') NOT IN ('termine','completed')
    `).get().n;

    const satis = db.prepare(`
      SELECT ROUND(AVG(score), 1) AS moy, COUNT(*) AS n
      FROM evaluations WHERE type = 'satisfaction' AND score IS NOT NULL
    `).get();

    // Heures dispensées : durée de la formation × sessions terminées.
    const heures = db.prepare(`
      SELECT COALESCE(SUM(f.duration_hours), 0) AS h
      FROM sessions s JOIN formations f ON f.id = s.formation_id
      WHERE s.end_date <> '' AND s.end_date < ?
    `).get(auj).h;

    // ── Courbe de chiffre d'affaires ───────────────────────────────────
    const toutesSessions = db.prepare(`
      SELECT start_date, end_date, tarif, status FROM sessions
    `).all();
    const serie = construireSerie(toutesSessions, periode, auj);

    // ── Prochaines sessions ────────────────────────────────────────────
    const prochaines = db.prepare(`
      SELECT s.id, s.session_name, s.start_date, s.status, s.location,
             s.max_participants, f.title AS formation_titre,
             (SELECT COUNT(*) FROM inscriptions i WHERE i.session_id = s.id) AS inscrits
      FROM sessions s LEFT JOIN formations f ON f.id = s.formation_id
      WHERE s.start_date >= ? AND s.start_date <= ?
      ORDER BY s.start_date ASC LIMIT 6
    `).all(auj, dans90);

    // ── Conformité : mêmes contrôles que le dossier d'audit ────────────
    const pieces = db.prepare(`SELECT type, expire_le FROM organisme_documents WHERE archived = 0`).all();
    const piecesOk = PIECES_ATTENDUES.filter((t) => {
      const p = pieces.find((x) => x.type === t);
      return p && (!p.expire_le || p.expire_le >= auj);
    }).length;

    const terminees = db.prepare(`
      SELECT s.id, s.session_name, s.start_date, f.title AS formation_titre,
             (SELECT COUNT(*) FROM emargements e WHERE e.session_id = s.id) AS nb_emarg,
             (SELECT COUNT(*) FROM evaluations v WHERE v.session_id = s.id AND v.type='satisfaction') AS nb_satis
      FROM sessions s LEFT JOIN formations f ON f.id = s.formation_id
      WHERE s.end_date <> '' AND s.end_date < ?
      ORDER BY s.start_date DESC
    `).all(auj);

    const sessionsIncompletes = terminees.filter((s) => !s.nb_emarg || !s.nb_satis);
    const controles = PIECES_ATTENDUES.length + Math.max(terminees.length, 1);
    const reussis = piecesOk + Math.max(terminees.length - sessionsIncompletes.length, 0);
    const conformite = Math.round((reussis / controles) * 100);

    // ── À traiter — trié par urgence réelle ────────────────────────────
    const aTraiter = [];
    for (const t of PIECES_ATTENDUES) {
      const p = pieces.find((x) => x.type === t);
      if (!p) aTraiter.push({ texte: `Pièce manquante : ${libellePiece(t)}`, meta: 'Dossier organisme', ton: 'danger' });
      else if (p.expire_le && p.expire_le < auj) aTraiter.push({ texte: `Pièce expirée : ${libellePiece(t)}`, meta: `Depuis le ${p.expire_le}`, ton: 'danger' });
    }
    for (const s of sessionsIncompletes.slice(0, 4)) {
      const quoi = [!s.nb_emarg && 'émargement', !s.nb_satis && 'enquête à chaud'].filter(Boolean).join(' et ');
      aTraiter.push({
        texte: `${quoi.charAt(0).toUpperCase() + quoi.slice(1)} à récupérer · ${s.formation_titre || s.session_name || 'session'}`,
        meta: `Session du ${s.start_date}`, ton: 'gold',
      });
    }
    const reclamOuvertes = db.prepare(`
      SELECT COUNT(*) AS n FROM reclamations WHERE statut IN ('ouverte','en_cours')
    `).get().n;
    if (reclamOuvertes) {
      aTraiter.push({ texte: `${reclamOuvertes} réclamation(s) en cours`, meta: 'Indicateur 31 du RNQ', ton: 'gold' });
    }

    // ── Satisfaction par formation ─────────────────────────────────────
    const satisParFormation = db.prepare(`
      SELECT f.title, ROUND(AVG(v.score), 1) AS moy, COUNT(*) AS n
      FROM evaluations v
      JOIN sessions s ON s.id = v.session_id
      JOIN formations f ON f.id = s.formation_id
      WHERE v.type = 'satisfaction' AND v.score IS NOT NULL
      GROUP BY f.id ORDER BY moy DESC LIMIT 5
    `).all();

    return NextResponse.json({
      periode,
      periodes: Object.entries(PERIODES).map(([cle, p]) => ({ cle, label: p.label })),
      serie,
      indicateurs: {
        sessions_planifiees: sessionsAvenir,
        apprenants_inscrits: inscrits,
        apprenants_en_attente_financement: enAttenteFin,
        satisfaction: satis.n ? satis.moy : null,
        satisfaction_nb: satis.n,
        heures_dispensees: heures,
        ca_realise: serie.total_realise,
        ca_previsionnel: serie.total_previsionnel,
      },
      prochaines,
      conformite: {
        pourcentage: conformite,
        pieces_ok: piecesOk,
        pieces_attendues: PIECES_ATTENDUES.length,
        sessions_terminees: terminees.length,
        sessions_incompletes: sessionsIncompletes.length,
      },
      a_traiter: aTraiter,
      satisfaction_par_formation: satisParFormation,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('formations:read', _GET);
