import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

/**
 * PATCH /api/sessions/:id/checklist/:stepId — toggle done_at.
 * Body optionnel : { done: true|false } pour forcer l'état, sinon bascule.
 */
async function _PATCH(request, { params }) {
  const { id, stepId } = await params;
  const db = getDb();

  const step = db.prepare(
    'SELECT * FROM session_checklist WHERE id = ? AND session_id = ?'
  ).get(stepId, id);
  if (!step) {
    return NextResponse.json({ error: 'Étape non trouvée' }, { status: 404 });
  }

  let body = {};
  try { body = await request.json(); } catch { body = {}; }

  let done;
  if (typeof body?.done === 'boolean') {
    done = body.done;
  } else {
    done = !step.done_at; // toggle
  }

  if (done) {
    db.prepare("UPDATE session_checklist SET done_at = datetime('now') WHERE id = ?").run(stepId);
  } else {
    db.prepare('UPDATE session_checklist SET done_at = NULL WHERE id = ?').run(stepId);
  }

  const updated = db.prepare('SELECT * FROM session_checklist WHERE id = ?').get(stepId);
  return NextResponse.json(updated);
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const PATCH = withGuard('sessions:update', _PATCH);
