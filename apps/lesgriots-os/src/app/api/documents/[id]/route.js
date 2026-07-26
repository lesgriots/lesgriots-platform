/**
 * /api/documents/[id] — mise à jour, archivage, suppression.
 * L'archivage est préféré à la suppression : une version antérieure reste
 * la preuve de ce qui a été signé à l'époque.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

const CHAMPS = ['categorie', 'libelle', 'fichier', 'contexte_type', 'contexte_id',
  'version', 'expire_le', 'signe', 'notes', 'archived'];

async function _PATCH(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const b = await req.json();
    const avant = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    if (!avant) return NextResponse.json({ error: 'introuvable' }, { status: 404 });

    const sets = [], args = [];
    for (const c of CHAMPS) {
      if (b[c] === undefined) continue;
      sets.push(`${c} = ?`); args.push(b[c] === null ? null : b[c]);
    }
    if (!sets.length) return NextResponse.json(avant);
    sets.push("updated_at = datetime('now')");
    args.push(id);
    db.prepare(`UPDATE documents SET ${sets.join(', ')} WHERE id = ?`).run(...args);
    return NextResponse.json(db.prepare('SELECT * FROM documents WHERE id = ?').get(id));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _DELETE(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const r = db.prepare('DELETE FROM documents WHERE id = ?').run(id);
    if (!r.changes) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const PATCH = withGuard('documents:write', _PATCH);
export const DELETE = withGuard('documents:write', _DELETE);
