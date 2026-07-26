// API /api/recurring-costs — CRUD coûts indirects récurrents
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

async function _GET() {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM recurring_costs ORDER BY active DESC, amount_ttc DESC
    `).all();
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _POST(request) {
  try {
    const body = await request.json();
    const db = getDb();
    const id = body.id || `rc_${randomUUID().slice(0, 8)}`;
    const amount_ht = Number(body.amount_ht) || 0;
    const tva_rate = Number(body.tva_rate) || 20;
    const amount_ttc = body.amount_ttc !== undefined
      ? Number(body.amount_ttc)
      : Math.round(amount_ht * (1 + tva_rate / 100) * 100) / 100;
    db.prepare(`
      INSERT INTO recurring_costs (id, label, amount_ht, tva_rate, amount_ttc, category, frequency, day_of_month, start_date, end_date, provider, notes, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.label || 'Sans titre',
      amount_ht,
      tva_rate,
      amount_ttc,
      body.category || '',
      body.frequency || 'monthly',
      Number(body.day_of_month) || 1,
      body.start_date || null,
      body.end_date || null,
      body.provider || '',
      body.notes || '',
      body.active === false ? 0 : 1,
    );
    const row = db.prepare('SELECT * FROM recurring_costs WHERE id = ?').get(id);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('expenses:read', _GET);
export const POST = withGuard('expenses:create', _POST);
