import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

function _POST(req) {
  return req.json().then(body => {
    const db = getDb();
    const { id, projectId, source, label, amount, date, notes } = body;
    db.prepare(`
      INSERT INTO ip_revenues (id, project_id, source, label, amount, date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, projectId, source || '', label, amount || 0, date || '', notes || '');
    return NextResponse.json({ ok: true, id });
  });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const POST = withGuard('expenses:create', _POST);
