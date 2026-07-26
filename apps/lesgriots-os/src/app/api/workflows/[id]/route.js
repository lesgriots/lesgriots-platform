// /api/workflows/[id]
//   GET    — détail d'un workflow avec ses tâches
//   PATCH  — modifie metadata (name, description, pillar, icon)
//   DELETE — supprime workflow + tâches associées (cascade DB)
//   POST   — ajoute une nouvelle tâche au workflow (body = task fields)
import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

async function _GET(_req, { params }) {
  const { id } = await params;
  const db = getDb();
  const tpl = db.prepare('SELECT * FROM workflow_templates WHERE id = ?').get(id);
  if (!tpl) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  const tasks = db.prepare(`
    SELECT * FROM workflow_template_tasks WHERE template_id = ?
    ORDER BY sort_order ASC, created_at ASC
  `).all(id);

  return NextResponse.json({
    id: tpl.id, name: tpl.name, description: tpl.description,
    pillar: tpl.pillar, icon: tpl.icon, createdAt: tpl.created_at,
    tasks: tasks.map(t => ({
      id: t.id, title: t.title, phaseGroup: t.phase_group,
      complexity: t.complexity, estimatedHours: t.estimated_hours,
      sortOrder: t.sort_order,
      dependsOn: (() => { try { return JSON.parse(t.depends_on || '[]'); } catch { return []; } })(),
    })),
  });
}

async function _PATCH(req, { params }) {
  const { id } = await params;
  const db = getDb();
  const exists = db.prepare('SELECT id FROM workflow_templates WHERE id = ?').get(id);
  if (!exists) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  const body = await req.json();
  const map = { name: 'name', description: 'description', pillar: 'pillar', icon: 'icon' };
  const sets = []; const vals = [];
  for (const [k, v] of Object.entries(body)) {
    if (map[k]) { sets.push(`${map[k]} = ?`); vals.push(v); }
  }
  if (sets.length === 0) return NextResponse.json({ error: 'NO_FIELDS' }, { status: 400 });
  vals.push(id);
  db.prepare(`UPDATE workflow_templates SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return NextResponse.json({ ok: true });
}

async function _DELETE(_req, { params }) {
  const { id } = await params;
  const db = getDb();
  const exists = db.prepare('SELECT id FROM workflow_templates WHERE id = ?').get(id);
  if (!exists) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  db.prepare('DELETE FROM workflow_templates WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}

async function _POST(req, { params }) {
  const { id: templateId } = await params;
  const db = getDb();
  const exists = db.prepare('SELECT id FROM workflow_templates WHERE id = ?').get(templateId);
  if (!exists) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  const body = await req.json();
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM workflow_template_tasks WHERE template_id = ?').get(templateId).m;
  const id = 'wft_' + randomUUID().slice(0, 8);
  db.prepare(`
    INSERT INTO workflow_template_tasks (id, template_id, title, phase_group, complexity, estimated_hours, sort_order, depends_on)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, templateId,
    body.title || 'Nouvelle tâche',
    body.phaseGroup || '',
    body.complexity || 'simple',
    body.estimatedHours ?? null,
    body.sortOrder ?? (maxOrder + 1),
    JSON.stringify(Array.isArray(body.dependsOn) ? body.dependsOn : []),
  );
  return NextResponse.json({ ok: true, id });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('projects:read', _GET);
export const PATCH = withGuard('projects:update', _PATCH);
export const DELETE = withGuard('projects:delete', _DELETE);
export const POST = withGuard('projects:create', _POST);
