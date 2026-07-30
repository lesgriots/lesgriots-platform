import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

async function _GET(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const lieu = db.prepare('SELECT * FROM lieux_formation WHERE id = ?').get(id);
    if (!lieu) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 });

    const sessions = db.prepare(`
      SELECT s.*, f.title as formation_title, f.code as formation_code
      FROM sessions s
      LEFT JOIN formations f ON f.id = s.formation_id
      WHERE s.lieu_formation_id = ?
      ORDER BY s.start_date DESC
    `).all(id);

    return NextResponse.json({ ...lieu, sessions });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _PATCH(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await req.json();
    const allowed = ['nom','adresse','postal_code','ville','pays','capacite',
      'accessibilite_pmr','equipements','contact_nom','contact_email','contact_tel','notes','active',
      'type_lieu','acces_transport','horaires_acces','referent_handicap','consignes_securite','cout_location'];
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (key in body) { updates.push(`${key} = ?`); values.push(body[key]); }
    }
    if (updates.length === 0) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 });
    values.push(id);
    db.prepare(`UPDATE lieux_formation SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    const lieu = db.prepare('SELECT * FROM lieux_formation WHERE id = ?').get(id);
    return NextResponse.json(lieu);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _DELETE(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    // Unlink sessions using this lieu
    db.prepare("UPDATE sessions SET lieu_formation_id = NULL WHERE lieu_formation_id = ?").run(id);
    db.prepare('DELETE FROM lieux_formation WHERE id = ?').run(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('formations:read', _GET);
export const PATCH = withGuard('formations:update', _PATCH);
export const DELETE = withGuard('formations:delete', _DELETE);
