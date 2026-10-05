// PUT    /api/lieux-formation/[id]/contacts/[cid]
// DELETE /api/lieux-formation/[id]/contacts/[cid]
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { mapContactLieu } from '@/lib/lieu-contacts';

async function _PUT(req, { params }) {
  const db = getDb();
  const { id, cid } = await params;
  const b = await req.json();
  db.prepare(`UPDATE lieu_contacts SET first_name=?, last_name=?, organisation=?, role=?, email=?, phone=?, notes=?
              WHERE id=? AND lieu_id=?`)
    .run(b.firstName || '', b.lastName || '', b.organisation || '', b.role || '', b.email || '', b.phone || '', b.notes || '', cid, id);
  const c = db.prepare('SELECT * FROM lieu_contacts WHERE id = ?').get(cid);
  if (!c) return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 });
  return NextResponse.json(mapContactLieu(c));
}

async function _DELETE(req, { params }) {
  const db = getDb();
  const { id, cid } = await params;
  db.prepare('DELETE FROM lieu_contacts WHERE id = ? AND lieu_id = ?').run(cid, id);
  return NextResponse.json({ ok: true });
}

export const PUT = withGuard('formations:update', _PUT);
export const DELETE = withGuard('formations:update', _DELETE);
