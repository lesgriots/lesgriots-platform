/**
 * /api/griotheque/evaluations — l'état de la collecte, session par session.
 *
 * Trois moments d'évaluation comptent pour le RNQ : le positionnement avant
 * l'entrée, l'enquête à chaud en fin de session, l'évaluation à froid quelques
 * mois plus tard. Cette route ne calcule rien d'autre que ce qui existe et ce
 * qui manque, apprenant par apprenant.
 *
 * C'est la source du 0 % de satisfaction : la table est vide, pas mauvaise.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

const TYPES = ['positionnement', 'satisfaction', 'froid'];

async function _GET() {
  try {
    const db = getDb();
    const auj = new Date().toISOString().slice(0, 10);

    const sessions = db.prepare(`
      SELECT s.id, s.session_name, s.start_date, s.end_date, s.status,
             f.title AS formation_titre
      FROM sessions s LEFT JOIN formations f ON f.id = s.formation_id
      WHERE COALESCE(s.status,'') <> 'cancelled'
      ORDER BY s.start_date DESC
    `).all();

    const inscrits = db.prepare(`
      SELECT i.session_id, i.apprenant_id,
             a.first_name, a.last_name, a.email
      FROM inscriptions i LEFT JOIN apprenants a ON a.id = i.apprenant_id
    `).all();

    const faites = db.prepare(`
      SELECT session_id, apprenant_id, type, score, comments FROM evaluations
    `).all();

    const parSession = sessions.map((s) => {
      const gens = inscrits.filter((i) => i.session_id === s.id);
      const mesEval = faites.filter((e) => e.session_id === s.id);
      const terminee = s.end_date && s.end_date < auj;

      const scores = mesEval.filter((e) => e.type === 'satisfaction' && e.score != null).map((e) => e.score);
      return {
        ...s,
        terminee,
        inscrits: gens.map((g) => ({
          id: g.apprenant_id,
          nom: [g.first_name, g.last_name].filter(Boolean).join(' ') || 'Sans nom',
          email: g.email || '',
          evaluations: Object.fromEntries(TYPES.map((t) => {
            const e = mesEval.find((x) => x.apprenant_id === g.apprenant_id && x.type === t);
            return [t, e ? { score: e.score, comments: e.comments } : null];
          })),
        })),
        moyenne: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
        reponses: scores.length,
        // Une session terminée sans enquête à chaud est un manque d'audit.
        manque: terminee && scores.length === 0,
      };
    });

    const toutesReponses = faites.filter((e) => e.type === 'satisfaction' && e.score != null);
    return NextResponse.json({
      sessions: parSession,
      total_reponses: faites.length,
      moyenne_globale: toutesReponses.length
        ? Math.round((toutesReponses.reduce((t, e) => t + e.score, 0) / toutesReponses.length) * 10) / 10
        : null,
      sessions_sans_enquete: parSession.filter((s) => s.manque).length,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _POST(request) {
  try {
    const db = getDb();
    const c = await request.json();
    if (!c.session_id || !c.apprenant_id || !TYPES.includes(c.type)) {
      return NextResponse.json({ error: 'Session, apprenant et type sont requis' }, { status: 400 });
    }

    // Une évaluation par apprenant, par session et par type : on remplace.
    db.prepare(`DELETE FROM evaluations WHERE session_id = ? AND apprenant_id = ? AND type = ?`)
      .run(c.session_id, c.apprenant_id, c.type);

    db.prepare(`
      INSERT INTO evaluations (id, session_id, apprenant_id, type, score, responses, comments)
      VALUES (?, ?, ?, ?, ?, '{}', ?)
    `).run('ev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
           c.session_id, c.apprenant_id, c.type,
           c.score === '' || c.score == null ? null : Number(c.score),
           c.comments || '');

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** Une note saisie par erreur doit pouvoir être retirée : sans ça, la
 *  première faute de frappe reste dans le dossier d'audit pour toujours. */
async function _DELETE(request) {
  try {
    const db = getDb();
    const p = new URL(request.url).searchParams;
    const [session, apprenant, type] = [p.get('session_id'), p.get('apprenant_id'), p.get('type')];
    if (!session || !apprenant || !type) {
      return NextResponse.json({ error: 'Session, apprenant et type sont requis' }, { status: 400 });
    }
    const r = db.prepare('DELETE FROM evaluations WHERE session_id = ? AND apprenant_id = ? AND type = ?')
      .run(session, apprenant, type);
    return NextResponse.json({ supprimees: r.changes });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('formations:read', _GET);
export const POST = withGuard('formations:update', _POST);
export const DELETE = withGuard('formations:update', _DELETE);
