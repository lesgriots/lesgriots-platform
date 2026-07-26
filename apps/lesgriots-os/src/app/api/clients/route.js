// GET /api/clients — list all clients (filtrable par ?pillar=AGENCE|GRIOTHEQUE|BOTH)
// POST /api/clients — create a client
import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard, badRequest, trimStrings, toNum } from '@/lib/api-guard';

function _GET(req) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const pillar = searchParams.get('pillar'); // AGENCE, GRIOTHEQUE, or null (all)

  let query = 'SELECT * FROM clients';
  const params = [];
  if (pillar) {
    query += ' WHERE pillar = ? OR pillar = ?';
    params.push(pillar, 'BOTH');
  }
  query += ' ORDER BY company ASC, last_name ASC, first_name ASC';

  const clients = db.prepare(query).all(...params);
  return NextResponse.json(clients.map(mapClient));
}

async function _POST(req) {
  const db = getDb();
  const body = await req.json();
  if (!body || typeof body !== 'object') return badRequest('Corps JSON requis');
  trimStrings(body);
  if (!body.company && !body.lastName && !body.firstName) {
    return badRequest('Champ "company" ou "firstName"/"lastName" requis');
  }
  const id = `cli_${Date.now()}`;
  db.prepare(`
    INSERT INTO clients (id, first_name, last_name, company, email, phone, address, postal_code, city, country, siret, tva_number, notes, pillar, tva_applicable, tva_rate, type_client)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.firstName || '',
    body.lastName || '',
    body.company || '',
    body.email || '',
    body.phone || '',
    body.address || '',
    body.postalCode || '',
    body.city || '',
    body.country || 'France',
    body.siret || '',
    body.tvaNumber || '',
    body.notes || '',
    body.pillar || 'AGENCE',
    body.tvaApplicable !== undefined ? (body.tvaApplicable ? 1 : 0) : 1,
    body.tvaRate !== undefined ? toNum(body.tvaRate, 20.0) : 20.0,
    body.typeClient || 'entreprise',
  );
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  return NextResponse.json(mapClient(client), { status: 201 });
}

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

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('clients:read', _GET);
export const POST = withGuard('clients:create', _POST);
