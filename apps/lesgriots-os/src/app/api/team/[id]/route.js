import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

async function _PUT(req, { params }) {
  const db = getDb();
  const { id } = await params;
  const body = await req.json();
  const map = { name: 'name', role: 'role', type: 'type', email: 'email', phone: 'phone', providerId: 'provider_id' };
  const sets = []; const vals = [];
  for (const [k, v] of Object.entries(body)) {
    if (map[k]) { sets.push(`${map[k]} = ?`); vals.push(v); }
  }
  if (sets.length) {
    vals.push(id);
    db.prepare(`UPDATE team_members SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }
  return NextResponse.json({ ok: true });
}

async function _DELETE(req, { params }) {
  const db = getDb();
  const { id } = await params;
  db.prepare('DELETE FROM team_members WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const PUT = withGuard('team:update', _PUT);
export const DELETE = withGuard('team:delete', _DELETE);
