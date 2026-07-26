import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

async function _PATCH(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await req.json();

    const allowed = ['label', 'color', 'sort_order', 'active'];
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (key in body) { updates.push(`${key} = ?`); values.push(body[key]); }
    }
    if (updates.length === 0) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 });

    values.push(id);
    db.prepare(`UPDATE formation_categories SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    const cat = db.prepare('SELECT * FROM formation_categories WHERE id = ?').get(id);
    return NextResponse.json(cat);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _DELETE(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    // Remove category reference from formations using it
    db.prepare("UPDATE formations SET categorie = '' WHERE categorie = ?").run(id);
    db.prepare('DELETE FROM formation_categories WHERE id = ?').run(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const PATCH = withGuard('formations:update', _PATCH);
export const DELETE = withGuard('formations:delete', _DELETE);
