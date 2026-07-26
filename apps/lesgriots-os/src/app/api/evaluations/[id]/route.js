import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

async function _GET(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const row = db.prepare(`
      SELECT e.*, a.first_name, a.last_name, a.email
      FROM evaluations e
      JOIN apprenants a ON a.id = e.apprenant_id
      WHERE e.id = ?
    `).get(id);
    if (!row) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });
    return NextResponse.json({ ...row, responses: JSON.parse(row.responses || '{}') });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _PATCH(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await req.json();

    const exists = db.prepare('SELECT id FROM evaluations WHERE id = ?').get(id);
    if (!exists) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });

    const allowed = ['score', 'responses', 'comments'];
    const sets = [];
    const vals = [];
    for (const key of allowed) {
      if (key in body) {
        sets.push(`${key} = ?`);
        vals.push(key === 'responses' ? JSON.stringify(body[key]) : body[key]);
      }
    }
    if (sets.length === 0) return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 });

    vals.push(id);
    db.prepare(`UPDATE evaluations SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    const updated = db.prepare('SELECT * FROM evaluations WHERE id = ?').get(id);
    return NextResponse.json({ ...updated, responses: JSON.parse(updated.responses || '{}') });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _DELETE(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const exists = db.prepare('SELECT id FROM evaluations WHERE id = ?').get(id);
    if (!exists) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });
    db.prepare('DELETE FROM evaluations WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('formations:read', _GET);
export const PATCH = withGuard('formations:update', _PATCH);
export const DELETE = withGuard('formations:delete', _DELETE);
