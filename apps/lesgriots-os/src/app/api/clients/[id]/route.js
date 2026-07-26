// GET /api/clients/[id]
// PUT /api/clients/[id]
// DELETE /api/clients/[id]
import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

function mapClient(c) {
  return {
    id: c.id,
    firstName: c.first_name || '',
    lastName: c.last_name || '',
    company: c.company || '',
    email: c.email || '',
    phone: c.phone || '',
    address: c.address || '',
    postalCode: c.postal_code || '',
    city: c.city || '',
    country: c.country || 'France',
    siret: c.siret || '',
    tvaNumber: c.tva_number || '',
    notes: c.notes || '',
    pillar: c.pillar || 'AGENCE',
    tvaApplicable: c.tva_applicable === 1 || c.tva_applicable === undefined,
    tvaRate: c.tva_rate !== undefined ? c.tva_rate : 20.0,
    typeClient: c.type_client || 'entreprise',
    createdAt: c.created_at,
  };
}

function _GET(req, { params }) {
  const db = getDb();
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(params.id);
  if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(mapClient(client));
}

async function _PUT(req, { params }) {
  const db = getDb();
  const body = await req.json();
  const mapping = {
    firstName: 'first_name', lastName: 'last_name', company: 'company',
    email: 'email', phone: 'phone', address: 'address',
    postalCode: 'postal_code', city: 'city', country: 'country',
    siret: 'siret', tvaNumber: 'tva_number', notes: 'notes',
    pillar: 'pillar', tvaApplicable: 'tva_applicable', tvaRate: 'tva_rate', typeClient: 'type_client',
  };
  const fields = [];
  const values = [];
  for (const [key, col] of Object.entries(mapping)) {
    if (body[key] !== undefined) {
      fields.push(`${col} = ?`);
      values.push(body[key]);
    }
  }
  if (fields.length === 0) return NextResponse.json({ error: 'No fields' }, { status: 400 });
  values.push(params.id);
  db.prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(params.id);
  return NextResponse.json(mapClient(client));
}

function _DELETE(req, { params }) {
  const db = getDb();
  // Unlink projects referencing this client
  db.prepare("UPDATE projects SET client_id = NULL WHERE client_id = ?").run(params.id);
  db.prepare('DELETE FROM clients WHERE id = ?').run(params.id);
  return NextResponse.json({ ok: true });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('clients:read', _GET);
export const PUT = withGuard('clients:update', _PUT);
export const DELETE = withGuard('clients:delete', _DELETE);
