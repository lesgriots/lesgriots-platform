import { NextResponse } from 'next/server';
import crypto, { randomUUID } from 'crypto';
import { getDb } from '@/lib/db.mjs';
import { withGuard, badRequest } from '@/lib/api-guard';

function withUrl(link) {
  return link ? { ...link, url: `/inscription/${link.token}` } : null;
}

function activeLink(db, sessionId) {
  return db.prepare(`
    SELECT * FROM session_registration_links
    WHERE session_id = ? AND is_active = 1
    ORDER BY created_at DESC
    LIMIT 1
  `).get(sessionId);
}

async function _GET(request, { params }) {
  const { id } = await params;
  const db = getDb();
  const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(id);
  if (!session) return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
  return NextResponse.json(withUrl(activeLink(db, id)));
}

async function _POST(request, { params }) {
  const { id } = await params;
  const db = getDb();
  const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(id);
  if (!session) return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });

  let body = {};
  try { body = await request.json(); } catch { /* Le renouvellement sans corps reste valide. */ }
  if (body && typeof body !== 'object') return badRequest('Corps JSON invalide');

  const renew = Boolean(body?.renew);
  const existing = activeLink(db, id);
  if (existing && !renew) return NextResponse.json(withUrl(existing));

  if (renew && existing) {
    db.prepare('UPDATE session_registration_links SET is_active = 0 WHERE session_id = ? AND is_active = 1').run(id);
  }

  const linkId = randomUUID();
  db.prepare(`
    INSERT INTO session_registration_links (id, token, session_id)
    VALUES (?, ?, ?)
  `).run(linkId, crypto.randomBytes(24).toString('hex'), id);

  const link = db.prepare('SELECT * FROM session_registration_links WHERE id = ?').get(linkId);
  return NextResponse.json(withUrl(link), { status: 201 });
}

export const GET = withGuard('sessions:update', _GET);
export const POST = withGuard('sessions:update', _POST);
