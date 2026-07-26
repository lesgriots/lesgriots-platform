import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

// GET /api/session-modules?session_id=xxx
async function _GET(req) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id requis' }, { status: 400 });
    }

    const modules = db.prepare(
      'SELECT * FROM session_modules WHERE session_id = ? ORDER BY sort_order ASC, created_at ASC'
    ).all(sessionId);

    return NextResponse.json(modules);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/session-modules — Ajouter un module custom à une session
async function _POST(req) {
  try {
    const db = getDb();
    const body = await req.json();

    if (!body.session_id || !body.title) {
      return NextResponse.json({ error: 'session_id et title requis' }, { status: 400 });
    }

    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM session_modules WHERE session_id = ?'
    ).get(body.session_id);

    const id = `sm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const objectives = typeof body.objectives === 'object' ? JSON.stringify(body.objectives) : (body.objectives || '[]');

    db.prepare(`
      INSERT INTO session_modules (id, session_id, module_id, title, description, objectives, duration_hours, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, body.session_id, body.module_id || null,
      body.title, body.description || '', objectives,
      body.duration_hours || 0, body.sort_order ?? (maxOrder.max_order + 1)
    );

    const mod = db.prepare('SELECT * FROM session_modules WHERE id = ?').get(id);
    return NextResponse.json(mod, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('sessions:read', _GET);
export const POST = withGuard('sessions:create', _POST);
