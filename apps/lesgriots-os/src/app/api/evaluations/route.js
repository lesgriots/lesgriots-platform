import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

async function _GET(req) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const session_id = searchParams.get('session_id');
    const type = searchParams.get('type'); // positionnement | acquis | satisfaction

    let query = `
      SELECT e.*, a.first_name, a.last_name, a.email
      FROM evaluations e
      JOIN apprenants a ON a.id = e.apprenant_id
      WHERE 1=1
    `;
    const params = [];

    if (session_id) { query += ' AND e.session_id = ?'; params.push(session_id); }
    if (type) { query += ' AND e.type = ?'; params.push(type); }

    query += ' ORDER BY e.created_at DESC';

    const rows = db.prepare(query).all(...params);
    const mapped = rows.map(r => ({
      ...r,
      responses: (() => { try { return JSON.parse(r.responses || '{}'); } catch { return {}; } })(),
    }));
    return NextResponse.json(mapped);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _POST(req) {
  try {
    const db = getDb();
    const body = await req.json();
    const { session_id, apprenant_id, type, score, responses, comments } = body;

    if (!session_id || !apprenant_id || !type) {
      return NextResponse.json({ error: 'session_id, apprenant_id et type requis' }, { status: 400 });
    }
    if (!['positionnement', 'acquis', 'satisfaction', 'froid'].includes(type)) {
      return NextResponse.json({ error: 'type invalide' }, { status: 400 });
    }

    // Check if evaluation already exists for this combo
    const existing = db.prepare(
      'SELECT id FROM evaluations WHERE session_id = ? AND apprenant_id = ? AND type = ?'
    ).get(session_id, apprenant_id, type);

    if (existing) {
      // Update existing
      const sets = [];
      const vals = [];
      if (score !== undefined) { sets.push('score = ?'); vals.push(score); }
      if (responses !== undefined) { sets.push('responses = ?'); vals.push(JSON.stringify(responses)); }
      if (comments !== undefined) { sets.push('comments = ?'); vals.push(comments); }
      if (sets.length > 0) {
        vals.push(existing.id);
        db.prepare(`UPDATE evaluations SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      }
      const updated = db.prepare('SELECT * FROM evaluations WHERE id = ?').get(existing.id);
      return NextResponse.json({ ...updated, responses: JSON.parse(updated.responses || '{}') });
    }

    const id = randomUUID();
    db.prepare(`
      INSERT INTO evaluations (id, session_id, apprenant_id, type, score, responses, comments)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, session_id, apprenant_id, type, score ?? null, JSON.stringify(responses || {}), comments || '');

    const created = db.prepare('SELECT * FROM evaluations WHERE id = ?').get(id);
    return NextResponse.json({ ...created, responses: JSON.parse(created.responses || '{}') }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('formations:read', _GET);
export const POST = withGuard('formations:create', _POST);
