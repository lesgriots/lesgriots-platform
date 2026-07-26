// GET/POST /api/bank-balances — Snapshots soldes bancaires
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

async function _GET() {
  try {
    const db = getDb();
    // Dernier snapshot par compte
    const rows = db.prepare(`
      SELECT b.* FROM bank_balances b
      INNER JOIN (
        SELECT account_name, MAX(snapshot_date) AS max_date
        FROM bank_balances GROUP BY account_name
      ) latest ON b.account_name = latest.account_name AND b.snapshot_date = latest.max_date
      ORDER BY b.balance DESC
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
    const id = `bal_${randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO bank_balances (id, account_name, balance, currency, snapshot_date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.account_name || 'Compte principal',
      Number(body.balance) || 0,
      body.currency || 'EUR',
      body.snapshot_date || new Date().toISOString().slice(0, 10),
      body.notes || '',
    );
    const row = db.prepare('SELECT * FROM bank_balances WHERE id = ?').get(id);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('expenses:read', _GET);
export const POST = withGuard('expenses:create', _POST);
