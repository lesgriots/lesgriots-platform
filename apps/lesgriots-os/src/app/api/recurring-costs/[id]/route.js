// PUT/DELETE /api/recurring-costs/[id]
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

async function _PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    const existing = db.prepare('SELECT * FROM recurring_costs WHERE id = ?').get(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Calcul TTC si HT et taux fournis
    const amount_ht = body.amount_ht !== undefined ? Number(body.amount_ht) : existing.amount_ht;
    const tva_rate = body.tva_rate !== undefined ? Number(body.tva_rate) : existing.tva_rate;
    const amount_ttc = body.amount_ttc !== undefined
      ? Number(body.amount_ttc)
      : Math.round(amount_ht * (1 + tva_rate / 100) * 100) / 100;

    db.prepare(`
      UPDATE recurring_costs SET
        label = ?, amount_ht = ?, tva_rate = ?, amount_ttc = ?,
        category = ?, frequency = ?, day_of_month = ?,
        start_date = ?, end_date = ?,
        provider = ?, notes = ?, active = ?
      WHERE id = ?
    `).run(
      body.label ?? existing.label,
      amount_ht,
      tva_rate,
      amount_ttc,
      body.category ?? existing.category,
      body.frequency ?? existing.frequency,
      body.day_of_month !== undefined ? Number(body.day_of_month) : existing.day_of_month,
      body.start_date !== undefined ? (body.start_date || null) : existing.start_date,
      body.end_date !== undefined ? (body.end_date || null) : existing.end_date,
      body.provider ?? existing.provider,
      body.notes ?? existing.notes,
      body.active !== undefined ? (body.active ? 1 : 0) : existing.active,
      id,
    );

    const row = db.prepare('SELECT * FROM recurring_costs WHERE id = ?').get(id);
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _DELETE(_request, { params }) {
  try {
    const { id } = await params;
    const db = getDb();
    db.prepare('DELETE FROM recurring_costs WHERE id = ?').run(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const PUT = withGuard('expenses:update', _PUT);
export const DELETE = withGuard('expenses:delete', _DELETE);
