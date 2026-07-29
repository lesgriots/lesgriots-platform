import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard, badRequest, trimStrings } from '@/lib/api-guard';

async function _GET(_request, { params }) {
  const { id } = await params;
  const db = getDb();
  const block = db.prepare('SELECT * FROM pedagogical_blocks WHERE id = ?').get(id);
  if (!block) return NextResponse.json({ error: 'Bloc introuvable' }, { status: 404 });
  return NextResponse.json(block);
}

async function _PATCH(request, { params }) {
  const { id } = await params;
  const body = trimStrings(await request.json());
  const db = getDb();
  const current = db.prepare('SELECT id FROM pedagogical_blocks WHERE id = ?').get(id);
  if (!current) return NextResponse.json({ error: 'Bloc introuvable' }, { status: 404 });
  const allowed = ['title', 'objectives', 'content', 'category', 'archived'];
  const updates = [], values = [];
  for (const key of allowed) {
    if (key in body) {
      if (key === 'title' && !String(body[key]).trim()) return badRequest('Le titre du bloc est requis');
      updates.push(`${key} = ?`);
      values.push(['objectives', 'content'].includes(key) ? JSON.stringify(body[key] || []) : body[key]);
    }
  }
  if (!updates.length) return badRequest('Aucune modification à enregistrer');
  values.push(id);
  db.prepare(`UPDATE pedagogical_blocks SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
  return NextResponse.json(db.prepare('SELECT * FROM pedagogical_blocks WHERE id = ?').get(id));
}

export const GET = withGuard('formations:read', _GET);
export const PATCH = withGuard('formations:update', _PATCH);
