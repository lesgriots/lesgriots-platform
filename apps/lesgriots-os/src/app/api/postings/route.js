import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

function _GET(req) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  const db = getDb();
  const rows = projectId
    ? db.prepare('SELECT * FROM postings WHERE project_id = ? ORDER BY posted_at ASC').all(projectId)
    : db.prepare('SELECT * FROM postings ORDER BY posted_at ASC').all();
  return NextResponse.json(rows.map(r => ({
    id: r.id, projectId: r.project_id, phaseId: r.phase_id,
    note: r.note, postedAt: r.posted_at, createdAt: r.created_at,
  })));
}

async function _POST(req) {
  const body = await req.json();
  const { projectId, phaseId, note, postedAt } = body;
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  const db = getDb();
  const id = randomUUID();
  const ts = postedAt || new Date().toISOString().slice(0, 10);
  db.prepare('INSERT INTO postings (id, project_id, phase_id, note, posted_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, projectId, phaseId || null, note || '', ts);
  return NextResponse.json({ id, projectId, phaseId: phaseId || null, note: note || '', postedAt: ts });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('tasks:read', _GET);
export const POST = withGuard('tasks:create', _POST);
