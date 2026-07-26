import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard, badRequest, trimStrings, toNum } from '@/lib/api-guard';

// POST /api/projects — Create a new project
function _POST(req) {
  return req.json().then(body => {
    if (!body || typeof body !== 'object') return badRequest('Corps JSON requis');
    trimStrings(body);
    const db = getDb();
    const {
      id, code, name, pillar, template, client, clientContact, clientEmail,
      clientPhone, clientAddress, stage, revenue, budget, notes, bdcCount,
      startDate, endDate, hoursSpent, tvaRate,
    } = body;

    if (!id || typeof id !== 'string') return badRequest('Champ "id" requis');
    if (!name || typeof name !== 'string') return badRequest('Champ "name" requis');

    db.prepare(`
      INSERT INTO projects (id, code, name, pillar, template, client, client_contact, client_email,
        client_phone, client_address, stage, revenue, budget, notes, bdc_count, start_date, end_date, hours_spent, tva_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, code, name, pillar, template || null, client || '', clientContact || '',
      clientEmail || '', clientPhone || '', clientAddress || '', stage || 'lead',
      toNum(revenue), toNum(budget), notes || '', toNum(bdcCount), startDate || '', endDate || '', toNum(hoursSpent), tvaRate || '20');

    // Update next_indices
    if (pillar) {
      db.prepare('UPDATE next_indices SET next_index = next_index + 1 WHERE pillar = ?').run(pillar);
    }

    // Insert default expense lines if provided
    if (body.expenses && body.expenses.length > 0) {
      const insert = db.prepare(`
        INSERT INTO expenses (id, project_id, label, amount_ht, tva_rate, tva_amount, amount_ttc, category, status, date)
        VALUES (?, ?, ?, 0, '20', 0, 0, ?, 'pending', ?)
      `);
      for (const e of body.expenses) {
        insert.run(e.id, id, e.label, e.category || '', e.date || new Date().toISOString().split('T')[0]);
      }
    }

    return NextResponse.json({ ok: true, id });
  });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const POST = withGuard('projects:create', _POST);
