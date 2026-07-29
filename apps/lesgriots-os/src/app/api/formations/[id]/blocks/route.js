import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard, badRequest } from '@/lib/api-guard';

async function _GET(_request, { params }) {
  const { id } = await params;
  return NextResponse.json(getDb().prepare(`
    SELECT b.*, fb.sort_order FROM formation_blocks fb
    JOIN pedagogical_blocks b ON b.id = fb.block_id
    WHERE fb.formation_id = ? ORDER BY fb.sort_order ASC, b.title ASC
  `).all(id));
}

async function _POST(request, { params }) {
  const { id } = await params;
  const { block_id } = await request.json();
  if (!block_id) return badRequest('block_id requis');
  const db = getDb();
  const current = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM formation_blocks WHERE formation_id = ?').get(id);
  db.prepare('INSERT OR IGNORE INTO formation_blocks (formation_id, block_id, sort_order) VALUES (?, ?, ?)').run(id, block_id, current.max_order + 1);
  return NextResponse.json({ success: true });
}

async function _DELETE(request, { params }) {
  const { id } = await params;
  const blockId = request.nextUrl.searchParams.get('block_id');
  if (!blockId) return badRequest('block_id requis');
  getDb().prepare('DELETE FROM formation_blocks WHERE formation_id = ? AND block_id = ?').run(id, blockId);
  return NextResponse.json({ success: true });
}

export const GET = withGuard('formations:read', _GET);
export const POST = withGuard('formations:update', _POST);
export const DELETE = withGuard('formations:update', _DELETE);
