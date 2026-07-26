import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

async function _GET() {
  try {
    const db = getDb();
    const lieux = db.prepare(`
      SELECT l.*,
        COUNT(DISTINCT s.id) as sessions_count
      FROM lieux_formation l
      LEFT JOIN sessions s ON s.lieu_formation_id = l.id
      GROUP BY l.id
      ORDER BY l.nom ASC
    `).all();
    return NextResponse.json(lieux);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _POST(req) {
  try {
    const db = getDb();
    const body = await req.json();
    const {
      nom = '', adresse = '', postal_code = '', ville = '', pays = 'France',
      capacite = 0, accessibilite_pmr = 0, equipements = '',
      contact_nom = '', contact_email = '', contact_tel = '', notes = '',
    } = body;
    if (!nom) return NextResponse.json({ error: 'nom requis' }, { status: 400 });

    const id = randomUUID();
    db.prepare(`
      INSERT INTO lieux_formation (id, nom, adresse, postal_code, ville, pays,
        capacite, accessibilite_pmr, equipements, contact_nom, contact_email, contact_tel, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, nom, adresse, postal_code, ville, pays,
      capacite, accessibilite_pmr, equipements, contact_nom, contact_email, contact_tel, notes);

    const lieu = db.prepare('SELECT * FROM lieux_formation WHERE id = ?').get(id);
    return NextResponse.json(lieu, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('formations:read', _GET);
export const POST = withGuard('formations:create', _POST);
