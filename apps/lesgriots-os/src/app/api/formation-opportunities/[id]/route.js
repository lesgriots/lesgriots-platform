import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

async function _GET(req, { params }) {
  const db = getDb();
  const { id } = await params;
  const row = db.prepare('SELECT fo.*, f.title as formation_title, f.code as formation_code FROM formation_opportunities fo LEFT JOIN formations f ON fo.formation_id = f.id WHERE fo.id = ?').get(id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

async function _PATCH(req, { params }) {
  const db = getDb();
  const { id } = await params;
  const exists = db.prepare('SELECT id FROM formation_opportunities WHERE id = ?').get(id);
  if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const map = {
    formation_id: 'formation_id', session_id: 'session_id', client_name: 'client_name', client_email: 'client_email',
    client_phone: 'client_phone', contact_name: 'contact_name', company: 'company',
    stage: 'stage', revenue: 'revenue', financement: 'financement',
    notes: 'notes', source: 'source', archived: 'archived',
  };

  const sets = ['updated_at = ?'];
  const vals = [new Date().toISOString()];
  for (const [k, col] of Object.entries(map)) {
    if (body[k] !== undefined) { sets.push(`${col} = ?`); vals.push(body[k]); }
  }

  vals.push(id);
  db.prepare(`UPDATE formation_opportunities SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

  const updated = db.prepare('SELECT fo.*, f.title as formation_title, f.code as formation_code FROM formation_opportunities fo LEFT JOIN formations f ON fo.formation_id = f.id WHERE fo.id = ?').get(id);
  return NextResponse.json(updated);
}

async function _DELETE(req, { params }) {
  const db = getDb();
  const { id } = await params;
  const exists = db.prepare('SELECT id FROM formation_opportunities WHERE id = ?').get(id);
  if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  db.prepare('DELETE FROM formation_opportunities WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('formations:read', _GET);
export const PATCH = withGuard('formations:update', _PATCH);
export const DELETE = withGuard('formations:delete', _DELETE);
