/**
 * /api/organisme-documents/[id] — mise à jour et suppression d'une pièce.
 *
 * L'archivage (archived = 1) est préféré à la suppression : une pièce périmée
 * reste une preuve de la période qu'elle couvrait, et l'auditeur peut demander
 * l'historique (ex. certificat Qualiopi du cycle précédent).
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

const CHAMPS = [
  'type', 'libelle', 'reference', 'emis_le', 'expire_le',
  'emetteur', 'fichier', 'notes', 'indicator', 'archived',
];

async function _PATCH(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await req.json();

    const existant = db.prepare('SELECT * FROM organisme_documents WHERE id = ?').get(id);
    if (!existant) return NextResponse.json({ error: 'introuvable' }, { status: 404 });

    const sets = [];
    const args = [];
    for (const champ of CHAMPS) {
      if (body[champ] === undefined) continue;
      sets.push(`${champ} = ?`);
      args.push(body[champ] === null ? null : body[champ]);
    }
    if (!sets.length) return NextResponse.json(existant);

    sets.push("updated_at = datetime('now')");
    args.push(id);
    db.prepare(`UPDATE organisme_documents SET ${sets.join(', ')} WHERE id = ?`).run(...args);

    return NextResponse.json(db.prepare('SELECT * FROM organisme_documents WHERE id = ?').get(id));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _DELETE(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const res = db.prepare('DELETE FROM organisme_documents WHERE id = ?').run(id);
    if (!res.changes) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const PATCH = withGuard('organisme:update', _PATCH);
export const DELETE = withGuard('organisme:delete', _DELETE);
