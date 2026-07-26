// /api/workflows
//   GET   — liste tous les workflow templates avec leurs tâches embarquées
//   POST  — crée un workflow (avec un tableau initial de tâches optionnel)
import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

function _GET() {
  const db = getDb();
  const templates = db.prepare(`
    SELECT * FROM workflow_templates ORDER BY pillar ASC, name ASC
  `).all();
  const tasksByTpl = {};
  const allTasks = db.prepare(`
    SELECT * FROM workflow_template_tasks ORDER BY template_id, sort_order ASC
  `).all();
  for (const t of allTasks) {
    if (!tasksByTpl[t.template_id]) tasksByTpl[t.template_id] = [];
    tasksByTpl[t.template_id].push({
      id: t.id, title: t.title, phaseGroup: t.phase_group,
      complexity: t.complexity, estimatedHours: t.estimated_hours,
      sortOrder: t.sort_order,
      dependsOn: (() => { try { return JSON.parse(t.depends_on || '[]'); } catch { return []; } })(),
    });
  }
  return NextResponse.json(templates.map(t => ({
    id: t.id, name: t.name, description: t.description,
    pillar: t.pillar, icon: t.icon, createdAt: t.created_at,
    tasks: tasksByTpl[t.id] || [],
    taskCount: (tasksByTpl[t.id] || []).length,
    phaseGroups: [...new Set((tasksByTpl[t.id] || []).map(t => t.phaseGroup).filter(Boolean))],
  })));
}

async function _POST(req) {
  const db = getDb();
  const body = await req.json();
  const id = body.id || 'wf_' + randomUUID().slice(0, 8);
  db.prepare(`
    INSERT INTO workflow_templates (id, name, description, pillar, icon)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, body.name || 'Nouveau workflow', body.description || '', body.pillar || '', body.icon || '');

  if (Array.isArray(body.tasks)) {
    const insert = db.prepare(`
      INSERT INTO workflow_template_tasks (id, template_id, title, phase_group, complexity, estimated_hours, sort_order, depends_on)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    body.tasks.forEach((t, i) => {
      insert.run(
        t.id || 'wft_' + randomUUID().slice(0, 8),
        id, t.title || '',
        t.phaseGroup || '',
        t.complexity || 'simple',
        t.estimatedHours ?? null,
        t.sortOrder ?? i,
        JSON.stringify(Array.isArray(t.dependsOn) ? t.dependsOn : []),
      );
    });
  }

  return NextResponse.json({ ok: true, id });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('projects:read', _GET);
export const POST = withGuard('projects:create', _POST);
