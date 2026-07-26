import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

// Helper: recalcule la durée totale de la formation à partir des modules
function recalcFormationDuration(db, formationId) {
  const result = db.prepare(
    'SELECT COALESCE(SUM(duration_hours), 0) as total FROM modules WHERE formation_id = ?'
  ).get(formationId);
  db.prepare('UPDATE formations SET duration_hours = ? WHERE id = ?').run(result.total, formationId);
  return result.total;
}

// GET /api/modules/:id
async function _GET(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const module = db.prepare('SELECT * FROM modules WHERE id = ?').get(id);
    if (!module) return NextResponse.json({ error: 'Module non trouvé', code: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json(module);
  } catch (e) {
    return NextResponse.json({ error: e.message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}

// PATCH /api/modules/:id
async function _PATCH(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const exists = db.prepare('SELECT * FROM modules WHERE id = ?').get(id);
    if (!exists) return NextResponse.json({ error: 'Module non trouvé', code: 'NOT_FOUND' }, { status: 404 });

    const body = await req.json();
    const allowed = ['title', 'description', 'objectives', 'duration_hours', 'sort_order'];
    const updates = [];
    const values = [];

    for (const key of allowed) {
      if (key in body) {
        updates.push(`${key} = ?`);
        const val = body[key];
        values.push(typeof val === 'object' ? JSON.stringify(val) : val);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Rien à mettre à jour', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    values.push(id);
    db.prepare(`UPDATE modules SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // Recalculer la durée si duration_hours a changé
    if ('duration_hours' in body) {
      recalcFormationDuration(db, exists.formation_id);
    }

    const module = db.prepare('SELECT * FROM modules WHERE id = ?').get(id);
    return NextResponse.json(module);
  } catch (e) {
    return NextResponse.json({ error: e.message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}

// DELETE /api/modules/:id
async function _DELETE(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const exists = db.prepare('SELECT * FROM modules WHERE id = ?').get(id);
    if (!exists) return NextResponse.json({ error: 'Module non trouvé', code: 'NOT_FOUND' }, { status: 404 });

    db.prepare('DELETE FROM modules WHERE id = ?').run(id);

    // Recalculer la durée de la formation
    const newTotal = recalcFormationDuration(db, exists.formation_id);

    return NextResponse.json({ success: true, formation_duration_hours: newTotal });
  } catch (e) {
    return NextResponse.json({ error: e.message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('formations:read', _GET);
export const PATCH = withGuard('formations:update', _PATCH);
export const DELETE = withGuard('formations:delete', _DELETE);
