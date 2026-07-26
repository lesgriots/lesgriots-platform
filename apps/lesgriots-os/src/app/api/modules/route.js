import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

// GET /api/modules?formation_id=xxx — Liste les modules d'une formation
async function _GET(req) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const formationId = searchParams.get('formation_id');

    if (formationId) {
      const modules = db.prepare(
        'SELECT * FROM modules WHERE formation_id = ? ORDER BY sort_order ASC, created_at ASC'
      ).all(formationId);
      return NextResponse.json(modules);
    }

    // Sans filtre : tous les modules
    const modules = db.prepare('SELECT * FROM modules ORDER BY formation_id, sort_order ASC').all();
    return NextResponse.json(modules);
  } catch (e) {
    return NextResponse.json({ error: e.message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}

// POST /api/modules — Créer un module
async function _POST(req) {
  try {
    const db = getDb();
    const body = await req.json();

    if (!body.formation_id) {
      return NextResponse.json({ error: 'formation_id requis', code: 'VALIDATION_ERROR' }, { status: 400 });
    }
    if (!body.title) {
      return NextResponse.json({ error: 'title requis', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    // Vérifier que la formation existe
    const formation = db.prepare('SELECT id FROM formations WHERE id = ?').get(body.formation_id);
    if (!formation) {
      return NextResponse.json({ error: 'Formation non trouvée', code: 'NOT_FOUND' }, { status: 404 });
    }

    // Auto sort_order si non fourni
    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM modules WHERE formation_id = ?'
    ).get(body.formation_id);
    const sortOrder = body.sort_order ?? (maxOrder.max_order + 1);

    const id = body.id || `mod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const objectives = typeof body.objectives === 'object' ? JSON.stringify(body.objectives) : (body.objectives || '[]');

    db.prepare(`
      INSERT INTO modules (id, formation_id, title, description, objectives, duration_hours, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.formation_id,
      body.title,
      body.description || '',
      objectives,
      body.duration_hours || 0,
      sortOrder,
    );

    // Recalculer la durée totale de la formation
    const totalHours = db.prepare(
      'SELECT COALESCE(SUM(duration_hours), 0) as total FROM modules WHERE formation_id = ?'
    ).get(body.formation_id);
    db.prepare('UPDATE formations SET duration_hours = ? WHERE id = ?').run(totalHours.total, body.formation_id);

    const module = db.prepare('SELECT * FROM modules WHERE id = ?').get(id);
    return NextResponse.json({ ...module, formation_duration_hours: totalHours.total }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('formations:read', _GET);
export const POST = withGuard('formations:create', _POST);
