/** /api/financeurs/[id] — lecture, mise à jour et retrait d'une fiche financeur. */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { CHAMPS } from '../route';

async function _GET(request, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const fiche = db.prepare('SELECT * FROM financeurs WHERE id = ?').get(id);
    if (!fiche) return NextResponse.json({ error: 'Financeur introuvable' }, { status: 404 });
    return NextResponse.json(fiche);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _PATCH(request, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const corps = await request.json();
    const sets = [], valeurs = [];
    for (const c of CHAMPS) if (c in corps) { sets.push(`${c} = ?`); valeurs.push(corps[c]); }
    if (!sets.length) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 });
    valeurs.push(id);
    db.prepare(`UPDATE financeurs SET ${sets.join(', ')} WHERE id = ?`).run(...valeurs);
    return NextResponse.json(db.prepare('SELECT * FROM financeurs WHERE id = ?').get(id));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _DELETE(request, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    // On archive plutôt que de supprimer : les dossiers passés y font référence.
    db.prepare('UPDATE financeurs SET actif = 0 WHERE id = ?').run(id);
    return NextResponse.json({ ok: true, archive: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('formations:read', _GET);
export const PATCH = withGuard('formations:update', _PATCH);
export const DELETE = withGuard('formations:update', _DELETE);
