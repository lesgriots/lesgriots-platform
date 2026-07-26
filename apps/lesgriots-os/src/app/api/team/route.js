import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

async function _GET() {
  const db = getDb();
  const members = db.prepare('SELECT * FROM team_members ORDER BY name ASC').all();
  return NextResponse.json(members.map(m => ({
    id: m.id, name: m.name, role: m.role, type: m.type,
    email: m.email, phone: m.phone, providerId: m.provider_id, createdAt: m.created_at,
  })));
}

async function _POST(req) {
  const db = getDb();
  const body = await req.json();
  const id = 'tm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  db.prepare(`INSERT INTO team_members (id, name, role, type, email, phone, provider_id) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    id, body.name || '', body.role || '', body.type || 'freelance', body.email || '', body.phone || '', body.providerId || null
  );
  return NextResponse.json({ id });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('team:read', _GET);
export const POST = withGuard('team:create', _POST);
