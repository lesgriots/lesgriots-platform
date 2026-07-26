import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard, badRequest, trimStrings, toNum } from '@/lib/api-guard';

async function _GET(req) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  let tasks;
  if (projectId) {
    tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC').all(projectId);
  } else {
    tasks = db.prepare('SELECT * FROM tasks ORDER BY sort_order ASC, created_at ASC').all();
  }
  return NextResponse.json(tasks.map(t => ({
    id: t.id, projectId: t.project_id, title: t.title, description: t.description,
    status: t.status, phase: t.phase, phaseGroup: t.phase_group || '',
    assigneeId: t.assignee_id, assigneeName: t.assignee_name,
    dueDate: t.due_date, sortOrder: t.sort_order, createdAt: t.created_at,
    complexity: t.complexity || 'simple',
    estimatedHours: t.estimated_hours,
    dependsOn: (() => { try { return JSON.parse(t.depends_on || '[]'); } catch { return []; } })(),
  })));
}

async function _POST(req) {
  const db = getDb();
  const body = await req.json();
  if (!body || typeof body !== 'object') return badRequest('Corps JSON requis');
  trimStrings(body);
  if (!body.projectId) return badRequest('Champ "projectId" requis');
  if (!body.title) return badRequest('Champ "title" requis');
  const id = 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  db.prepare(`INSERT INTO tasks (id, project_id, title, description, status, phase, phase_group, assignee_id, assignee_name, due_date, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, body.projectId, body.title || '', body.description || '', body.status || 'todo',
    body.phase || '', body.phaseGroup || '', body.assigneeId || null, body.assigneeName || '', body.dueDate || '', toNum(body.sortOrder)
  );
  return NextResponse.json({ id });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('tasks:read', _GET);
export const POST = withGuard('tasks:create', _POST);
