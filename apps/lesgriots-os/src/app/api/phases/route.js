import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

function _GET(req) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  const db = getDb();
  const rows = projectId
    ? db.prepare('SELECT * FROM production_phases WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC').all(projectId)
    : db.prepare('SELECT * FROM production_phases ORDER BY sort_order ASC').all();
  return NextResponse.json(rows.map(r => ({
    id: r.id, projectId: r.project_id, name: r.name, color: r.color,
    startDate: r.start_date, endDate: r.end_date,
    locked: !!r.locked, sortOrder: r.sort_order, createdAt: r.created_at,
  })));
}

async function _POST(req) {
  const body = await req.json();
  const { projectId, name, color, startDate, endDate, sortOrder } = body;
  if (!projectId || !name) return NextResponse.json({ error: 'projectId and name required' }, { status: 400 });
  const db = getDb();
  const id = randomUUID();
  db.prepare('INSERT INTO production_phases (id, project_id, name, color, start_date, end_date, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, projectId, name, color || '#D4A843', startDate || '', endDate || '', sortOrder ?? 0);
  return NextResponse.json({ id, projectId, name, color: color || '#D4A843', startDate: startDate || '', endDate: endDate || '', locked: false, sortOrder: sortOrder ?? 0 });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('phases:read', _GET);
export const POST = withGuard('phases:create', _POST);
