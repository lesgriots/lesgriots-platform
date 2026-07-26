import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

/**
 * DELETE /api/qualite/evidence/:id — supprime une preuve manuelle.
 */
async function _DELETE(request, { params }) {
  const { id } = await params;
  const db = getDb();

  const row = db.prepare('SELECT id FROM qualiopi_evidence WHERE id = ?').get(id);
  if (!row) {
    return NextResponse.json({ error: 'Preuve non trouvée' }, { status: 404 });
  }

  db.prepare('DELETE FROM qualiopi_evidence WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
// 'formations:update' = admin + manager
export const DELETE = withGuard('formations:update', _DELETE);
