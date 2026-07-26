import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

// Alias PATCH = PUT pour compat avec inline editing
async function _PATCH(req, ctx) { return _PUT(req, ctx); }

async function _PUT(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const exists = db.prepare('SELECT id FROM providers WHERE id = ?').get(id);
    if (!exists) return NextResponse.json({ error: 'Prestataire non trouvé', code: 'NOT_FOUND' }, { status: 404 });

    const body = await req.json();
    const fields = [];
    const values = [];
    const mapping = {
      name: 'name', firstName: 'first_name', lastName: 'last_name',
      category: 'category', tarifJour: 'tarif_jour',
      tarifMin: 'tarif_min', tarifMax: 'tarif_max',
      tvaRate: 'tva_rate', siret: 'siret', email: 'email', rating: 'rating',
      phone: 'phone', company: 'company',
    };
    for (const [jsKey, dbCol] of Object.entries(mapping)) {
      if (body[jsKey] !== undefined) {
        fields.push(`${dbCol} = ?`);
        values.push(body[jsKey]);
      }
    }
    if (body.categories !== undefined) {
      fields.push('categories = ?');
      values.push(JSON.stringify(body.categories));
    }
    if (fields.length === 0) return NextResponse.json({ error: 'Aucun champ à mettre à jour', code: 'VALIDATION_ERROR' }, { status: 400 });

    values.push(id);
    db.prepare(`UPDATE providers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}

async function _DELETE(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const exists = db.prepare('SELECT id FROM providers WHERE id = ?').get(id);
    if (!exists) return NextResponse.json({ error: 'Prestataire non trouvé', code: 'NOT_FOUND' }, { status: 404 });
    db.prepare('DELETE FROM providers WHERE id = ?').run(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const PATCH = withGuard('providers:update', _PATCH);
export const PUT = withGuard('providers:update', _PUT);
export const DELETE = withGuard('providers:delete', _DELETE);
