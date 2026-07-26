import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

async function _PUT(req, { params }) {
  const body = await req.json();
  const db = getDb();
  const fields = [];
  const vals = [];
  if (body.name !== undefined)      { fields.push('name = ?');       vals.push(body.name); }
  if (body.color !== undefined)     { fields.push('color = ?');      vals.push(body.color); }
  if (body.startDate !== undefined) { fields.push('start_date = ?'); vals.push(body.startDate); }
  if (body.endDate !== undefined)   { fields.push('end_date = ?');   vals.push(body.endDate); }
  if (body.locked !== undefined)    { fields.push('locked = ?');     vals.push(body.locked ? 1 : 0); }
  if (body.sortOrder !== undefined) { fields.push('sort_order = ?'); vals.push(body.sortOrder); }
  if (!fields.length) return NextResponse.json({ ok: true });
  vals.push(params.id);
  db.prepare(`UPDATE production_phases SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  return NextResponse.json({ ok: true });
}

function _DELETE(req, { params }) {
  const db = getDb();
  db.prepare('DELETE FROM production_phases WHERE id = ?').run(params.id);
  return NextResponse.json({ ok: true });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const PUT = withGuard('phases:update', _PUT);
export const DELETE = withGuard('phases:delete', _DELETE);
