import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/db.mjs';
import { withGuard, badRequest, trimStrings } from '@/lib/api-guard';

async function _GET(request) {
  const db = getDb();
  const archived = request.nextUrl.searchParams.get('archived') === '1' ? 1 : 0;
  const blocks = db.prepare(`
    SELECT b.*, COUNT(fb.formation_id) AS formations_count
    FROM pedagogical_blocks b
    LEFT JOIN formation_blocks fb ON fb.block_id = b.id
    WHERE b.archived = ?
    GROUP BY b.id
    ORDER BY b.updated_at DESC, b.created_at DESC
  `).all(archived);
  return NextResponse.json(blocks);
}

async function _POST(request) {
  const body = trimStrings(await request.json());
  if (!body?.title?.trim()) return badRequest('Le titre du bloc est requis');
  const id = randomUUID();
  const db = getDb();
  db.prepare(`INSERT INTO pedagogical_blocks (id, title, objectives, content, category)
    VALUES (?, ?, ?, ?, ?)`)
    .run(id, body.title.trim(), JSON.stringify(body.objectives || []), JSON.stringify(body.content || []), body.category || '');
  return NextResponse.json(db.prepare('SELECT * FROM pedagogical_blocks WHERE id = ?').get(id), { status: 201 });
}

export const GET = withGuard('formations:read', _GET);
export const POST = withGuard('formations:create', _POST);
