/** /api/qualite/axes — les grandes lignes d'amélioration suivies sur l'année. */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

const CHAMPS = ['nom', 'description', 'statut', 'date_echeance'];

async function _GET() {
  try {
    const db = getDb();
    const items = db.prepare(`
      SELECT a.*,
             (SELECT COUNT(*) FROM reclamations r WHERE r.axe_id = a.id) AS incidents,
             (SELECT COUNT(*) FROM actions_correctives c WHERE c.axe_id = a.id) AS actions
      FROM axes_amelioration a ORDER BY a.created_at DESC
    `).all();
    return NextResponse.json(items);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

async function _POST(request) {
  try {
    const db = getDb();
    const corps = await request.json();
    if (!String(corps.nom || '').trim()) return NextResponse.json({ error: 'Un axe a besoin d’un nom.' }, { status: 400 });
    const id = `axe_${Date.now()}`;
    const presents = CHAMPS.filter((c) => c in corps);
    db.prepare(`INSERT INTO axes_amelioration (id, ${presents.join(', ')}) VALUES (?, ${presents.map(() => '?').join(', ')})`)
      .run(id, ...presents.map((c) => corps[c]));
    return NextResponse.json(db.prepare('SELECT * FROM axes_amelioration WHERE id = ?').get(id), { status: 201 });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

async function _PATCH(request) {
  try {
    const db = getDb();
    const { id, ...corps } = await request.json();
    const sets = [], valeurs = [];
    for (const c of CHAMPS) if (c in corps) { sets.push(`${c} = ?`); valeurs.push(corps[c]); }
    if (!sets.length) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 });
    valeurs.push(id);
    db.prepare(`UPDATE axes_amelioration SET ${sets.join(', ')} WHERE id = ?`).run(...valeurs);
    return NextResponse.json(db.prepare('SELECT * FROM axes_amelioration WHERE id = ?').get(id));
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

/**
 * Un axe se supprime, mais rien ne disparaît avec lui : incidents et actions
 * gardent leur trace, ils perdent seulement le rattachement.
 */
async function _DELETE(request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    db.prepare("UPDATE reclamations SET axe_id = '' WHERE axe_id = ?").run(id);
    const res = db.prepare('DELETE FROM axes_amelioration WHERE id = ?').run(id);
    if (!res.changes) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export const GET = withGuard('qualite:read', _GET);
export const POST = withGuard('qualite:create', _POST);
export const PATCH = withGuard('qualite:create', _PATCH);
export const DELETE = withGuard('qualite:delete', _DELETE);
