import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

// POST /api/expenses — Create expense
async function _POST(req) {
  try {
    const db = getDb();
    const body = await req.json();
    const {
      id, projectId, label, amountHT, tvaRate, tvaAmount, amount,
      category, provider, providerId, status, date, notes, bdcNumber,
    } = body;

    if (!id || !projectId || !label) {
      return NextResponse.json(
        { error: 'id, projectId et label sont requis', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const insertExpense = db.prepare(`
      INSERT INTO expenses (id, project_id, label, amount_ht, tva_rate, tva_amount, amount_ttc,
        category, provider, provider_id, status, date, notes, bdc_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const incrementBdc = db.prepare(
      'UPDATE projects SET bdc_count = bdc_count + 1 WHERE id = ?'
    );

    // Transaction : les deux écritures réussissent ou aucune
    db.transaction(() => {
      insertExpense.run(
        id, projectId, label, amountHT || 0, tvaRate || '20', tvaAmount || 0, amount || 0,
        category || '', provider || '', providerId || null, status || 'pending',
        date || new Date().toISOString().split('T')[0], notes || '', bdcNumber || null
      );
      if (bdcNumber) incrementBdc.run(projectId);
    })();

    return NextResponse.json({ ok: true, id });
  } catch (e) {
    const code = e.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' ? 'FK_VIOLATION'
               : e.code === 'SQLITE_CONSTRAINT_NOTNULL'    ? 'VALIDATION_ERROR'
               : e.code === 'SQLITE_CONSTRAINT_CHECK'      ? 'VALIDATION_ERROR'
               : e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ? 'DUPLICATE_ID'
               : 'SERVER_ERROR';
    const status = code === 'SERVER_ERROR' ? 500 : 400;
    return NextResponse.json({ error: e.message, code }, { status });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const POST = withGuard('expenses:create', _POST);
