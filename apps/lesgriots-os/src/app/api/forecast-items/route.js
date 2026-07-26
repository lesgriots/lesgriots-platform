// GET/POST /api/forecast-items — Mouvements ponctuels (entrées/sorties one-shot)
//
// Cas d'usage typiques :
//   - Achat matériel ponctuel (caméra, ordi, soft annuel)
//   - Acompte IS / TVA / URSSAF
//   - Versement de salaire ponctuel (président SASU sans salaire régulier)
//   - Distribution de dividendes
//   - Apport personnel sur compte pro
//   - Subvention ou aide à recevoir
//   - Crédit / leasing
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

async function _GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const onlyManual = searchParams.get('manual') === '1';
    const db = getDb();
    let rows;
    if (onlyManual) {
      rows = db.prepare(`
        SELECT * FROM forecast_items
        WHERE source_type = 'manual'
        ORDER BY expected_date ASC
      `).all();
    } else {
      rows = db.prepare(`
        SELECT * FROM forecast_items
        ORDER BY expected_date ASC
      `).all();
    }
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _POST(request) {
  try {
    const body = await request.json();
    const db = getDb();
    const id = `fc_${randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO forecast_items
        (id, label, direction, amount, expected_date, category, status, source_type, source_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', NULL, ?)
    `).run(
      id,
      body.label || 'Sans titre',
      body.direction === 'in' ? 'in' : 'out',
      Math.abs(Number(body.amount) || 0),
      body.expected_date || new Date().toISOString().slice(0, 10),
      body.category || '',
      body.status || 'expected',
      body.notes || '',
    );
    const row = db.prepare('SELECT * FROM forecast_items WHERE id = ?').get(id);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('expenses:read', _GET);
export const POST = withGuard('expenses:create', _POST);
