/**
 * /api/formations/[id]/questionnaires — les questions propres à un programme.
 *
 * GET renvoie, pour chaque moment, le tronc commun et l'écart enregistré,
 * pour que l'éditeur montre les deux sans les confondre.
 * PUT enregistre l'écart, après nettoyage : on ne stocke que du connu.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { QUESTIONNAIRES } from '@/lib/questionnaires';
import { normaliser, TYPES_QUESTION, QUESTION_IMPOSEE } from '@/lib/questionnaires-formation.mjs';

const MOMENTS = ['positionnement', 'chaud', 'froid'];

async function _GET(request, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const lignes = db.prepare('SELECT moment, questions FROM formation_questionnaires WHERE formation_id = ?').all(id);
    const propres = {};
    for (const l of lignes) {
      try { propres[l.moment] = JSON.parse(l.questions || '[]'); } catch { propres[l.moment] = []; }
    }
    return NextResponse.json({
      types: TYPES_QUESTION,
      question_imposee: QUESTION_IMPOSEE,
      moments: MOMENTS.map((m) => ({
        moment: m,
        libelle: QUESTIONNAIRES[m]?.label || m,
        regle: m === 'positionnement' ? 'remplace' : 'ajoute',
        tronc: QUESTIONNAIRES[m]?.questions || [],
        propres: propres[m] || [],
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _PUT(request, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const { moment, questions } = await request.json();
    if (!MOMENTS.includes(moment)) return NextResponse.json({ error: 'Moment inconnu' }, { status: 400 });

    const propres = normaliser(questions);
    if (!propres.length) {
      db.prepare('DELETE FROM formation_questionnaires WHERE formation_id = ? AND moment = ?').run(id, moment);
      return NextResponse.json({ moment, questions: [] });
    }
    db.prepare(`
      INSERT INTO formation_questionnaires (id, formation_id, moment, questions, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(formation_id, moment)
      DO UPDATE SET questions = excluded.questions, updated_at = datetime('now')
    `).run(`fq_${id}_${moment}`, id, moment, JSON.stringify(propres));
    return NextResponse.json({ moment, questions: propres });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('formations:read', _GET);
export const PUT = withGuard('formations:update', _PUT);
