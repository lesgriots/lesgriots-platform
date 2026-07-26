import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

async function _GET() {
  try {
    const db = getDb();
    const categories = db.prepare('SELECT * FROM formation_categories ORDER BY sort_order ASC, label ASC').all();
    return NextResponse.json(categories);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _POST(req) {
  try {
    const db = getDb();
    const { label, color = '#888888' } = await req.json();
    if (!label) return NextResponse.json({ error: 'label requis' }, { status: 400 });

    const id = label.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

    // Check if id already exists
    const existing = db.prepare('SELECT id FROM formation_categories WHERE id = ?').get(id);
    const finalId = existing ? `${id}_${Date.now()}` : id;

    const maxSort = db.prepare('SELECT MAX(sort_order) as m FROM formation_categories').get().m || 0;

    db.prepare('INSERT INTO formation_categories (id, label, color, sort_order) VALUES (?, ?, ?, ?)').run(finalId, label, color, maxSort + 1);
    const cat = db.prepare('SELECT * FROM formation_categories WHERE id = ?').get(finalId);
    return NextResponse.json(cat, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('formations:read', _GET);
export const POST = withGuard('formations:create', _POST);
