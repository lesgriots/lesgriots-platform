import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

async function _GET(req) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const session_id = searchParams.get('session_id');
    const apprenant_id = searchParams.get('apprenant_id');

    let query = `
      SELECT i.*, a.first_name, a.last_name, a.email, a.phone, a.company,
        s.start_date, s.end_date, f.title as formation_title, f.code as formation_code
      FROM inscriptions i
      JOIN apprenants a ON a.id = i.apprenant_id
      JOIN sessions s ON s.id = i.session_id
      JOIN formations f ON f.id = s.formation_id
      WHERE 1=1
    `;
    const args = [];
    if (session_id) { query += ' AND i.session_id = ?'; args.push(session_id); }
    if (apprenant_id) { query += ' AND i.apprenant_id = ?'; args.push(apprenant_id); }
    query += ' ORDER BY i.created_at DESC';

    return NextResponse.json(db.prepare(query).all(...args));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _POST(req) {
  try {
    const db = getDb();
    const body = await req.json();
    const {
      session_id, apprenant_id, status = 'inscrit',
      financement = '', price_ht = 0
    } = body;

    if (!session_id || !apprenant_id) {
      return NextResponse.json({ error: 'session_id et apprenant_id requis' }, { status: 400 });
    }

    // Vérifier doublon
    const existing = db.prepare(
      'SELECT id FROM inscriptions WHERE session_id = ? AND apprenant_id = ?'
    ).get(session_id, apprenant_id);
    if (existing) return NextResponse.json({ error: 'Déjà inscrit à cette session' }, { status: 409 });

    const id = randomUUID();
    db.prepare(`
      INSERT INTO inscriptions (id, session_id, apprenant_id, status, financement, price_ht)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, session_id, apprenant_id, status, financement, price_ht);

    // Créer automatiquement les émargements pour chaque jour de la session
    const session = db.prepare('SELECT start_date, end_date FROM sessions WHERE id = ?').get(session_id);
    if (session) {
      const start = new Date(session.start_date);
      const end = new Date(session.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const emId = randomUUID();
        db.prepare(`
          INSERT OR IGNORE INTO emargements (id, session_id, apprenant_id, date, matin, apres_midi)
          VALUES (?, ?, ?, ?, 0, 0)
        `).run(emId, session_id, apprenant_id, dateStr);
      }
    }

    const inscription = db.prepare('SELECT * FROM inscriptions WHERE id = ?').get(id);
    return NextResponse.json(inscription, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _PATCH(req) {
  try {
    const db = getDb();
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

    const allowed = ['status','financement','price_ht','convention_signed','convocation_sent','attestation_sent',
      'positionnement_decision','positionnement_amenagement','positionnement_notes'];
    const sets = [];
    const vals = [];
    for (const key of allowed) {
      if (key in updates) { sets.push(`${key} = ?`); vals.push(updates[key]); }
    }
    if (sets.length === 0) return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 });

    vals.push(id);
    db.prepare(`UPDATE inscriptions SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
    return NextResponse.json(db.prepare('SELECT * FROM inscriptions WHERE id = ?').get(id));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('apprenants:read', _GET);
export const POST = withGuard('apprenants:create', _POST);
export const PATCH = withGuard('apprenants:update', _PATCH);
