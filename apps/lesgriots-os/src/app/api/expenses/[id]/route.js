import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

// PUT /api/expenses/:id — Update expense
async function _PUT(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const exists = db.prepare('SELECT id FROM expenses WHERE id = ?').get(id);
    if (!exists) return NextResponse.json({ error: 'Dépense non trouvée', code: 'NOT_FOUND' }, { status: 404 });

    const body = await req.json();
    const fields = [];
    const values = [];

    const mapping = {
      label: 'label', amountHT: 'amount_ht', tvaRate: 'tva_rate',
      tvaAmount: 'tva_amount', amount: 'amount_ttc', category: 'category',
      provider: 'provider', providerId: 'provider_id', status: 'status',
      date: 'date', notes: 'notes',
    };

    for (const [jsKey, dbCol] of Object.entries(mapping)) {
      if (body[jsKey] !== undefined) {
        fields.push(`${dbCol} = ?`);
        values.push(body[jsKey]);
      }
    }

    if (fields.length === 0) return NextResponse.json({ error: 'Aucun champ à mettre à jour', code: 'VALIDATION_ERROR' }, { status: 400 });

    values.push(id);
    db.prepare(`UPDATE expenses SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}

// DELETE /api/expenses/:id
async function _DELETE(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const exists = db.prepare('SELECT id FROM expenses WHERE id = ?').get(id);
    if (!exists) return NextResponse.json({ error: 'Dépense non trouvée', code: 'NOT_FOUND' }, { status: 404 });
    db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const PUT = withGuard('expenses:update', _PUT);
export const DELETE = withGuard('expenses:delete', _DELETE);
