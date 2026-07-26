import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

function _DELETE(req, { params }) {
  const db = getDb();
  db.prepare('DELETE FROM ip_revenues WHERE id = ?').run(params.id);
  return NextResponse.json({ ok: true });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const DELETE = withGuard('expenses:delete', _DELETE);
