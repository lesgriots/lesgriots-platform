import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { generateChecklist } from '@/lib/session-lifecycle';

/**
 * GET /api/sessions/:id/checklist — liste les étapes du cycle de vie.
 * POST /api/sessions/:id/checklist — génère/complète les étapes manquantes
 *   (idempotent : les étapes existantes et leur done_at sont préservées).
 */

async function _GET(request, { params }) {
  const { id } = await params;
  const db = getDb();

  const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(id);
  if (!session) {
    return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
  }

  const steps = db.prepare(`
    SELECT * FROM session_checklist WHERE session_id = ?
    ORDER BY due_at ASC, step_key ASC
  `).all(id);

  return NextResponse.json(steps);
}

async function _POST(request, { params }) {
  const { id } = await params;
  const db = getDb();

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!session) {
    return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
  }

  const steps = generateChecklist(session);
  const insert = db.prepare(`
    INSERT OR IGNORE INTO session_checklist (id, session_id, step_key, label, due_at, meta)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const updateDue = db.prepare(`
    UPDATE session_checklist SET due_at = ?, label = ?, meta = ?
    WHERE session_id = ? AND step_key = ? AND done_at IS NULL
  `);

  const tx = db.transaction(() => {
    for (const step of steps) {
      insert.run(randomUUID(), id, step.step_key, step.label, step.due_at, step.meta);
      // Recale les échéances des étapes non faites si les dates de session ont bougé
      updateDue.run(step.due_at, step.label, step.meta, id, step.step_key);
    }
  });
  tx();

  const rows = db.prepare(`
    SELECT * FROM session_checklist WHERE session_id = ?
    ORDER BY due_at ASC, step_key ASC
  `).all(id);

  return NextResponse.json(rows, { status: 201 });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('sessions:read', _GET);
export const POST = withGuard('sessions:update', _POST);
