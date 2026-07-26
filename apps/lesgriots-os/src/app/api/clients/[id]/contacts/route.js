// GET /api/clients/[id]/contacts
// POST /api/clients/[id]/contacts
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

function _GET(req, { params }) {
  const db = getDb();
  const contacts = db.prepare('SELECT * FROM client_contacts WHERE client_id = ? ORDER BY created_at ASC').all(params.id);
  return NextResponse.json(contacts.map(mapContact));
}

async function _POST(req, { params }) {
  const db = getDb();
  const body = await req.json();
  const id = `cc_${Date.now()}`;
  db.prepare(`INSERT INTO client_contacts (id, client_id, first_name, last_name, role, email, phone, notes) VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, params.id, body.firstName||'', body.lastName||'', body.role||'', body.email||'', body.phone||'', body.notes||'');
  const c = db.prepare('SELECT * FROM client_contacts WHERE id = ?').get(id);
  return NextResponse.json(mapContact(c), { status: 201 });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('clients:read', _GET);
export const POST = withGuard('clients:create', _POST);
