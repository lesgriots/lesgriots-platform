/** Ajouter une note au journal d'une opportunité. */
import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

async function _POST(request, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const { texte = '', auteur = '' } = await request.json();
    if (!String(texte).trim()) return NextResponse.json({ error: 'Note vide' }, { status: 400 });
    const evId = `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    db.prepare('INSERT INTO opportunite_evenements (id, opportunite_id, type, texte, auteur) VALUES (?, ?, ?, ?, ?)')
      .run(evId, id, 'note', String(texte).trim(), auteur);
    return NextResponse.json(db.prepare('SELECT * FROM opportunite_evenements WHERE id = ?').get(evId), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withGuard('formations:update', _POST);
