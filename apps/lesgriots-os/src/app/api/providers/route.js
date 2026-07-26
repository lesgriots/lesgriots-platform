import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard, badRequest, trimStrings, toNum } from '@/lib/api-guard';

function _POST(req) {
  return req.json().then(body => {
    if (!body || typeof body !== 'object') return badRequest('Corps JSON requis');
    trimStrings(body);
    const db = getDb();
    const { id, name, firstName, lastName, category, categories, rating, tarifJour, tarifMin, tarifMax, tvaRate, siret, email, phone, company } = body;
    if (!id || typeof id !== 'string') return badRequest('Champ "id" requis');
    if (!name && !firstName && !lastName) return badRequest('Champ "name" ou "firstName"/"lastName" requis');
    const cats = categories ? JSON.stringify(categories) : (category ? JSON.stringify([category]) : '[]');
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || name || '';
    db.prepare(`
      INSERT INTO providers (id, name, first_name, last_name, category, categories, rating, tarif_jour, tarif_min, tarif_max, tva_rate, siret, email, phone, company)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, displayName, firstName || name || '', lastName || '', category || '', cats, toNum(rating), toNum(tarifJour), toNum(tarifMin), toNum(tarifMax), tvaRate || '20', siret || '', email || '', phone || '', company || '');
    return NextResponse.json({ ok: true, id });
  });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const POST = withGuard('providers:create', _POST);
