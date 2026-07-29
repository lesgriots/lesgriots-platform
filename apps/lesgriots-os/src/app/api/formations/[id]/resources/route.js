import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/db.mjs';
import { withGuard, badRequest, trimStrings } from '@/lib/api-guard';

async function _GET(_request, { params }) {
  const { id } = await params;
  return NextResponse.json(getDb().prepare('SELECT * FROM formation_resources WHERE formation_id = ? ORDER BY created_at DESC').all(id));
}

async function _POST(request, { params }) {
  const { id } = await params;
  const body = trimStrings(await request.json());
  if (!body?.title?.trim()) return badRequest('Le nom du document est requis');
  const db = getDb();
  if (!db.prepare('SELECT id FROM formations WHERE id = ?').get(id)) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 });
  const resourceId = randomUUID();
  db.prepare('INSERT INTO formation_resources (id, formation_id, title, scope, resource_type, url) VALUES (?, ?, ?, ?, ?, ?)')
    .run(resourceId, id, body.title.trim(), body.scope === 'learner' ? 'learner' : 'internal', body.resource_type || 'document', body.url || '');
  return NextResponse.json(db.prepare('SELECT * FROM formation_resources WHERE id = ?').get(resourceId), { status: 201 });
}

async function _DELETE(request, { params }) {
  const { id } = await params;
  const resourceId = request.nextUrl.searchParams.get('resource_id');
  if (!resourceId) return badRequest('resource_id requis');
  getDb().prepare('DELETE FROM formation_resources WHERE id = ? AND formation_id = ?').run(resourceId, id);
  return NextResponse.json({ success: true });
}

export const GET = withGuard('formations:read', _GET);
export const POST = withGuard('formations:update', _POST);
export const DELETE = withGuard('formations:update', _DELETE);
