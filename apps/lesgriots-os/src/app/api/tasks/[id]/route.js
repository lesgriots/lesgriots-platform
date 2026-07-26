import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

// Alias PATCH = PUT pour compat avec le code frontend
async function _PATCH(req, ctx) { return _PUT(req, ctx); }

async function _PUT(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const exists = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!exists) return NextResponse.json({ error: 'Tâche non trouvée', code: 'NOT_FOUND' }, { status: 404 });

    const body = await req.json();
    const map = { title: 'title', description: 'description', status: 'status', phase: 'phase', phaseGroup: 'phase_group',
      assigneeId: 'assignee_id', assigneeName: 'assignee_name', dueDate: 'due_date', sortOrder: 'sort_order',
      complexity: 'complexity', estimatedHours: 'estimated_hours', dependsOn: 'depends_on' };
    const sets = []; const vals = [];
    for (const [k, v] of Object.entries(body)) {
      if (map[k]) {
        sets.push(`${map[k]} = ?`);
        // depends_on : JSON array
        if (k === 'dependsOn') {
          vals.push(JSON.stringify(Array.isArray(v) ? v : []));
        } else if (k === 'estimatedHours') {
          vals.push(v === '' || v === null || v === undefined ? null : Number(v));
        } else {
          vals.push(v);
        }
      }
    }
    if (sets.length === 0) return NextResponse.json({ error: 'Aucun champ à mettre à jour', code: 'VALIDATION_ERROR' }, { status: 400 });

    vals.push(id);
    db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}

async function _DELETE(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const exists = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!exists) return NextResponse.json({ error: 'Tâche non trouvée', code: 'NOT_FOUND' }, { status: 404 });
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const PATCH = withGuard('tasks:update', _PATCH);
export const PUT = withGuard('tasks:update', _PUT);
export const DELETE = withGuard('tasks:delete', _DELETE);
