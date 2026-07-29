import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/db.mjs';
import { withGuard, badRequest, trimStrings } from '@/lib/api-guard';

async function _GET(request) {
  const archived = request.nextUrl.searchParams.get('archived') === '1' ? 1 : 0;
  return NextResponse.json(getDb().prepare('SELECT * FROM evaluation_templates WHERE archived = ? ORDER BY created_at ASC').all(archived));
}

async function _POST(request) {
  const body = trimStrings(await request.json());
  if (!body?.title?.trim() || !body?.type?.trim()) return badRequest('Le titre et le type sont requis');
  const id = randomUUID();
  try {
    getDb().prepare('INSERT INTO evaluation_templates (id, type, title, description, automatic) VALUES (?, ?, ?, ?, ?)')
      .run(id, body.type.trim(), body.title.trim(), body.description || '', body.automatic ? 1 : 0);
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return badRequest('Ce type de modèle existe déjà');
    throw error;
  }
  return NextResponse.json(getDb().prepare('SELECT * FROM evaluation_templates WHERE id = ?').get(id), { status: 201 });
}

export const GET = withGuard('formations:read', _GET);
export const POST = withGuard('formations:create', _POST);
