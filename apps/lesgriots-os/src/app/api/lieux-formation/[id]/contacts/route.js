// GET  /api/lieux-formation/[id]/contacts
// POST /api/lieux-formation/[id]/contacts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { randomUUID } from 'crypto';
import { mapContactLieu } from '@/lib/lieu-contacts';


async function _GET(req, { params }) {
  const db = getDb();
  const { id } = await params;
  const rows = db.prepare('SELECT * FROM lieu_contacts WHERE lieu_id = ? ORDER BY created_at ASC').all(id);
  return NextResponse.json(rows.map(mapContactLieu));
}

async function _POST(req, { params }) {
  const db = getDb();
  const { id } = await params;
  if (!db.prepare('SELECT id FROM lieux_formation WHERE id = ?').get(id)) {
    return NextResponse.json({ error: 'Lieu introuvable' }, { status: 404 });
  }
  const b = await req.json();
  const cid = `lc_${randomUUID()}`;
  db.prepare(`INSERT INTO lieu_contacts (id, lieu_id, first_name, last_name, organisation, role, email, phone, notes)
              VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(cid, id, b.firstName || '', b.lastName || '', b.organisation || '', b.role || '', b.email || '', b.phone || '', b.notes || '');
  return NextResponse.json(mapContactLieu(db.prepare('SELECT * FROM lieu_contacts WHERE id = ?').get(cid)), { status: 201 });
}

export const GET = withGuard('formations:read', _GET);
export const POST = withGuard('formations:update', _POST);
