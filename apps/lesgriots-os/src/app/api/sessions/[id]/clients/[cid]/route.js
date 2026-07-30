/** Mise à jour et retrait d'un client de session. */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { CHAMPS } from '../route';

async function _PATCH(request, { params }) {
  try {
    const db = getDb();
    const { id, cid } = await params;
    const corps = await request.json();
    const sets = [], valeurs = [];
    for (const c of CHAMPS) if (c in corps) { sets.push(`${c} = ?`); valeurs.push(corps[c]); }
    if (!sets.length) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 });
    valeurs.push(cid, id);
    db.prepare(`UPDATE session_clients SET ${sets.join(', ')} WHERE id = ? AND session_id = ?`).run(...valeurs);
    return NextResponse.json(db.prepare('SELECT * FROM session_clients WHERE id = ?').get(cid));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _DELETE(request, { params }) {
  try {
    const db = getDb();
    const { id, cid } = await params;
    db.prepare('DELETE FROM session_clients WHERE id = ? AND session_id = ?').run(cid, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const PATCH = withGuard('sessions:update', _PATCH);
export const DELETE = withGuard('sessions:update', _DELETE);
