import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

// PATCH /api/session-modules/[id] — Modifier durée, titre, etc.
async function _PATCH(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await req.json();

    const existing = db.prepare('SELECT * FROM session_modules WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Module session non trouvé' }, { status: 404 });
    }

    const fields = [];
    const values = [];

    if ('title' in body) { fields.push('title = ?'); values.push(body.title); }
    if ('description' in body) { fields.push('description = ?'); values.push(body.description); }
    if ('duration_hours' in body) { fields.push('duration_hours = ?'); values.push(parseFloat(body.duration_hours) || 0); }
    if ('sort_order' in body) { fields.push('sort_order = ?'); values.push(body.sort_order); }
    if ('prix_ht' in body) { fields.push('prix_ht = ?'); values.push(parseFloat(body.prix_ht) || 0); }
    if ('nature' in body) { fields.push('nature = ?'); values.push(body.nature); }
    if ('objectives' in body) {
      const obj = typeof body.objectives === 'object' ? JSON.stringify(body.objectives) : body.objectives;
      fields.push('objectives = ?'); values.push(obj);
    }

    if (fields.length === 0) {
      return NextResponse.json(existing);
    }

    values.push(id);
    db.prepare(`UPDATE session_modules SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM session_modules WHERE id = ?').get(id);
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/session-modules/[id]
async function _DELETE(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    db.prepare('DELETE FROM session_modules WHERE id = ?').run(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const PATCH = withGuard('sessions:update', _PATCH);
export const DELETE = withGuard('sessions:delete', _DELETE);
