import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard, badRequest, trimStrings } from '@/lib/api-guard';

async function _PATCH(request, { params }) {
  const { id } = await params;
  const body = trimStrings(await request.json());
  const db = getDb();
  if (!db.prepare('SELECT id FROM evaluation_templates WHERE id = ?').get(id)) return NextResponse.json({ error: 'Modèle introuvable' }, { status: 404 });
  const allowed = ['title', 'description', 'automatic', 'archived'];
  const updates = [], values = [];
  for (const key of allowed) if (key in body) { updates.push(`${key} = ?`); values.push(key === 'automatic' || key === 'archived' ? (body[key] ? 1 : 0) : body[key]); }
  if (!updates.length) return badRequest('Aucune modification à enregistrer');
  values.push(id);
  db.prepare(`UPDATE evaluation_templates SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return NextResponse.json(db.prepare('SELECT * FROM evaluation_templates WHERE id = ?').get(id));
}

export const PATCH = withGuard('formations:update', _PATCH);
