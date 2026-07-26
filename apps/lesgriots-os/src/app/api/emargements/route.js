import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

async function _GET(req) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const session_id = searchParams.get('session_id');
    if (!session_id) return NextResponse.json({ error: 'session_id requis' }, { status: 400 });

    const rows = db.prepare(`
      SELECT e.*, a.first_name, a.last_name
      FROM emargements e
      JOIN apprenants a ON a.id = e.apprenant_id
      WHERE e.session_id = ?
      ORDER BY e.date ASC, a.last_name ASC
    `).all(session_id);
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _PATCH(req) {
  try {
    const db = getDb();
    const body = await req.json();
    const { id, matin, apres_midi } = body;
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

    const updates = [];
    const vals = [];
    if (matin !== undefined) { updates.push('matin = ?'); vals.push(matin ? 1 : 0); }
    if (apres_midi !== undefined) { updates.push('apres_midi = ?'); vals.push(apres_midi ? 1 : 0); }
    if (updates.length === 0) return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 });

    vals.push(id);
    db.prepare(`UPDATE emargements SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
    return NextResponse.json(db.prepare('SELECT * FROM emargements WHERE id = ?').get(id));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('formations:read', _GET);
export const PATCH = withGuard('formations:update', _PATCH);
