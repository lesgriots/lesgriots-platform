/**
 * /api/reclamations/[id] — mise à jour et suppression d'une entrée du registre.
 *
 * Passer le statut à « resolue » ou « classee » horodate automatiquement la
 * clôture (resolue_le) : c'est cette date que l'auditeur regarde pour vérifier
 * le délai de traitement.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

const CHAMPS = [
  'nature', 'origine', 'canal', 'auteur_nom', 'auteur_email', 'objet',
  'description', 'gravite', 'statut', 'analyse', 'action_corrective',
  'responsable', 'session_id', 'apprenant_id', 'recue_le', 'resolue_le',
];

async function _PATCH(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await req.json();

    const existant = db.prepare('SELECT * FROM reclamations WHERE id = ?').get(id);
    if (!existant) return NextResponse.json({ error: 'introuvable' }, { status: 404 });

    const sets = [];
    const args = [];
    for (const champ of CHAMPS) {
      if (body[champ] === undefined) continue;
      sets.push(`${champ} = ?`);
      args.push(body[champ] === null ? null : body[champ]);
    }

    // Clôture : on horodate si le statut devient final et que rien n'est saisi.
    const clot = ['resolue', 'classee'].includes(body.statut);
    if (clot && !body.resolue_le && !existant.resolue_le) {
      sets.push('resolue_le = ?');
      args.push(new Date().toISOString().slice(0, 10));
    }
    // Réouverture : on efface la date de clôture devenue fausse.
    if (body.statut && !clot && existant.resolue_le) {
      sets.push("resolue_le = ''");
    }

    if (!sets.length) return NextResponse.json(existant);

    sets.push("updated_at = datetime('now')");
    args.push(id);
    db.prepare(`UPDATE reclamations SET ${sets.join(', ')} WHERE id = ?`).run(...args);

    return NextResponse.json(db.prepare('SELECT * FROM reclamations WHERE id = ?').get(id));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _DELETE(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const res = db.prepare('DELETE FROM reclamations WHERE id = ?').run(id);
    if (!res.changes) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const PATCH = withGuard('qualite:update', _PATCH);
export const DELETE = withGuard('qualite:delete', _DELETE);
