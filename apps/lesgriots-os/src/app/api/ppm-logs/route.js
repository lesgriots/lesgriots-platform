// GET /api/ppm-logs?projectId=xxx  — list logs for a project
// POST /api/ppm-logs                — add a log entry
import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

function _GET(req) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  const db = getDb();
  const rows = projectId
    ? db.prepare('SELECT * FROM ppm_logs WHERE project_id = ? ORDER BY logged_at DESC').all(projectId)
    : db.prepare('SELECT * FROM ppm_logs ORDER BY logged_at DESC').all();
  return NextResponse.json(rows.map(r => ({
    id: r.id, projectId: r.project_id, phaseKey: r.phase_key, note: r.note, loggedAt: r.logged_at,
  })));
}

async function _POST(req) {
  const body = await req.json();
  const { projectId, phaseKey, note, loggedAt } = body;
  if (!projectId || !phaseKey) {
    return NextResponse.json({ error: 'projectId and phaseKey required' }, { status: 400 });
  }
  const db = getDb();
  const id = randomUUID();
  const ts = loggedAt || new Date().toISOString().slice(0, 10);
  db.prepare('INSERT INTO ppm_logs (id, project_id, phase_key, note, logged_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, projectId, phaseKey, note || '', ts);
  return NextResponse.json({ id, projectId, phaseKey, note: note || '', loggedAt: ts });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('projects:read', _GET);
export const POST = withGuard('projects:create', _POST);
