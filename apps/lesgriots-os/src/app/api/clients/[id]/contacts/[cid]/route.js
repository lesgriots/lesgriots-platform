// PUT /api/clients/[id]/contacts/[cid]
// DELETE /api/clients/[id]/contacts/[cid]
import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

function mapContact(c) {
  return {
    id: c.id, clientId: c.client_id,
    firstName: c.first_name || '', lastName: c.last_name || '',
    role: c.role || '', email: c.email || '', phone: c.phone || '',
    notes: c.notes || '', createdAt: c.created_at,
  };
}

async function _PUT(req, { params }) {
  const db = getDb();
  const body = await req.json();
  db.prepare(`UPDATE client_contacts SET first_name=?, last_name=?, role=?, email=?, phone=?, notes=? WHERE id=? AND client_id=?`)
    .run(body.firstName||'', body.lastName||'', body.role||'', body.email||'', body.phone||'', body.notes||'', params.cid, params.id);
  const c = db.prepare('SELECT * FROM client_contacts WHERE id = ?').get(params.cid);
  return NextResponse.json(mapContact(c));
}

function _DELETE(req, { params }) {
  const db = getDb();
  db.prepare('DELETE FROM client_contacts WHERE id = ? AND client_id = ?').run(params.cid, params.id);
  return NextResponse.json({ ok: true });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const PUT = withGuard('clients:update', _PUT);
export const DELETE = withGuard('clients:delete', _DELETE);
