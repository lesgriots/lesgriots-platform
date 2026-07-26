// PUT/DELETE /api/forecast-items/[id]
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

async function _PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const db = getDb();
    const existing = db.prepare('SELECT * FROM forecast_items WHERE id = ?').get(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    db.prepare(`
      UPDATE forecast_items SET
        label = ?, direction = ?, amount = ?, expected_date = ?,
        category = ?, status = ?, notes = ?
      WHERE id = ?
    `).run(
      body.label ?? existing.label,
      body.direction ?? existing.direction,
      body.amount !== undefined ? Math.abs(Number(body.amount)) : existing.amount,
      body.expected_date ?? existing.expected_date,
      body.category ?? existing.category,
      body.status ?? existing.status,
      body.notes ?? existing.notes,
      id,
    );
    const row = db.prepare('SELECT * FROM forecast_items WHERE id = ?').get(id);
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _DELETE(_request, { params }) {
  try {
    const { id } = await params;
    const db = getDb();
    db.prepare('DELETE FROM forecast_items WHERE id = ?').run(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const PUT = withGuard('expenses:update', _PUT);
export const DELETE = withGuard('expenses:delete', _DELETE);
