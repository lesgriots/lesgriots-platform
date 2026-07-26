// PATCH / DELETE une tâche dans un workflow template.
import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

async function _PATCH(req, { params }) {
  const { id: templateId, taskId } = await params;
  const db = getDb();
  const exists = db.prepare('SELECT id FROM workflow_template_tasks WHERE id = ? AND template_id = ?').get(taskId, templateId);
  if (!exists) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  const body = await req.json();
  const map = {
    title: 'title', phaseGroup: 'phase_group',
    complexity: 'complexity', sortOrder: 'sort_order',
  };
  const sets = []; const vals = [];
  for (const [k, v] of Object.entries(body)) {
    if (map[k]) { sets.push(`${map[k]} = ?`); vals.push(v); }
  }
  if (body.estimatedHours !== undefined) {
    sets.push('estimated_hours = ?');
    vals.push(body.estimatedHours === '' || body.estimatedHours === null ? null : Number(body.estimatedHours));
  }
  if (body.dependsOn !== undefined) {
    sets.push('depends_on = ?');
    vals.push(JSON.stringify(Array.isArray(body.dependsOn) ? body.dependsOn : []));
  }
  if (sets.length === 0) return NextResponse.json({ error: 'NO_FIELDS' }, { status: 400 });
  vals.push(taskId);
  db.prepare(`UPDATE workflow_template_tasks SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return NextResponse.json({ ok: true });
}

async function _DELETE(_req, { params }) {
  const { id: templateId, taskId } = await params;
  const db = getDb();
  db.prepare('DELETE FROM workflow_template_tasks WHERE id = ? AND template_id = ?').run(taskId, templateId);
  return NextResponse.json({ ok: true });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const PATCH = withGuard('projects:update', _PATCH);
export const DELETE = withGuard('projects:delete', _DELETE);
