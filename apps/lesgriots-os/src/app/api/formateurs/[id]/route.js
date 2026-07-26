import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

async function _GET(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const formateur = db.prepare('SELECT * FROM formateurs WHERE id = ?').get(id);
    if (!formateur) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Get sessions where this formateur is assigned
    const sessions = db.prepare(`
      SELECT s.*, f.title as formation_title, f.code as formation_code
      FROM sessions s
      LEFT JOIN formations f ON f.id = s.formation_id
      WHERE s.formateur_id = ?
      ORDER BY s.start_date DESC
    `).all(id);

    return NextResponse.json({ ...formateur, sessions });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _PATCH(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await req.json();
    const allowed = [
      'first_name', 'last_name', 'email', 'phone', 'biographie',
      'qualifications', 'domaines', 'specialite', 'statut_juridique',
      'statut_collab', 'evaluation', 'feedback_interne',
      'date_dernier_dev_pro', 'tarif_jour', 'notes',
    ];
    const sets = [];
    const vals = [];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        sets.push(`${key} = ?`);
        vals.push(typeof body[key] === 'object' ? JSON.stringify(body[key]) : body[key]);
      }
    }
    if (sets.length > 0) {
      vals.push(id);
      db.prepare(`UPDATE formateurs SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    }
    const updated = db.prepare('SELECT * FROM formateurs WHERE id = ?').get(id);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _DELETE(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    db.prepare('DELETE FROM formateurs WHERE id = ?').run(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('formations:read', _GET);
export const PATCH = withGuard('formations:update', _PATCH);
export const DELETE = withGuard('formations:delete', _DELETE);
