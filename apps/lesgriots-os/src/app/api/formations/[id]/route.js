import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

async function _GET(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const formation = db.prepare('SELECT * FROM formations WHERE id = ?').get(id);
    if (!formation) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });

    const sessions = db.prepare(`
      SELECT s.*, COUNT(i.id) as inscriptions_count
      FROM sessions s
      LEFT JOIN inscriptions i ON i.session_id = s.id
      WHERE s.formation_id = ?
      GROUP BY s.id
      ORDER BY s.start_date ASC
    `).all(id);

    const modules = db.prepare(
      'SELECT * FROM modules WHERE formation_id = ? ORDER BY sort_order ASC, created_at ASC'
    ).all(id);

    return NextResponse.json({ ...formation, sessions, modules });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _PATCH(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await req.json();

    const allowed = ['title','description','objectives','duration_hours','duration_days',
      'modality','level','price_ht','max_participants','prerequisites','program',
      'evaluation_methods','target_audience','accessibility','status','thematique',
      'certification','financement_eligible','probleme_resolu','livrables_cles','format_label',
      'delais_acces','modalites_pedagogiques','moyens_materiels','positionnement_grille','categorie','type_formation'];

    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (key in body) {
        updates.push(`${key} = ?`);
        values.push(typeof body[key] === 'object' ? JSON.stringify(body[key]) : body[key]);
      }
    }
    if (updates.length === 0) return NextResponse.json({ error: 'Rien à mettre à jour', code: 'VALIDATION_ERROR' }, { status: 400 });

    const exists = db.prepare('SELECT id FROM formations WHERE id = ?').get(id);
    if (!exists) return NextResponse.json({ error: 'Formation non trouvée', code: 'NOT_FOUND' }, { status: 404 });

    values.push(id);
    db.prepare(`UPDATE formations SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    const formation = db.prepare('SELECT * FROM formations WHERE id = ?').get(id);
    return NextResponse.json(formation);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _DELETE(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const exists = db.prepare('SELECT id FROM formations WHERE id = ?').get(id);
    if (!exists) return NextResponse.json({ error: 'Formation non trouvée', code: 'NOT_FOUND' }, { status: 404 });
    db.prepare('DELETE FROM formations WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('formations:read', _GET);
export const PATCH = withGuard('formations:update', _PATCH);
export const DELETE = withGuard('formations:delete', _DELETE);
