import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

async function _GET() {
  try {
    const db = getDb();
    const formateurs = db.prepare(`
      SELECT f.*,
        COUNT(DISTINCT s.id) as sessions_count
      FROM formateurs f
      LEFT JOIN sessions s ON s.formateur_id = f.id
      GROUP BY f.id
      ORDER BY f.last_name ASC, f.first_name ASC
    `).all();
    return NextResponse.json(formateurs);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function _POST(req) {
  try {
    const db = getDb();
    const body = await req.json();
    const {
      first_name = '', last_name = '', email = '', phone = '',
      biographie = '', qualifications = '', domaines = '[]', specialite = '[]',
      statut_juridique = '', statut_collab = 'actif', evaluation = '',
      feedback_interne = '', date_dernier_dev_pro = '', tarif_jour = 0, notes = '',
    } = body;

    const id = randomUUID();
    db.prepare(`
      INSERT INTO formateurs (id, first_name, last_name, email, phone, biographie,
        qualifications, domaines, specialite, statut_juridique, statut_collab,
        evaluation, feedback_interne, date_dernier_dev_pro, tarif_jour, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, first_name, last_name, email, phone, biographie,
      qualifications,
      typeof domaines === 'object' ? JSON.stringify(domaines) : domaines,
      typeof specialite === 'object' ? JSON.stringify(specialite) : specialite,
      statut_juridique, statut_collab, evaluation,
      feedback_interne, date_dernier_dev_pro, tarif_jour, notes);

    const created = db.prepare('SELECT * FROM formateurs WHERE id = ?').get(id);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('formations:read', _GET);
export const POST = withGuard('formations:create', _POST);
