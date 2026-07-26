import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

async function _GET(req) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const stage = searchParams.get('stage');
  const formationId = searchParams.get('formation_id');

  let query = 'SELECT fo.*, f.title as formation_title, f.code as formation_code FROM formation_opportunities fo LEFT JOIN formations f ON fo.formation_id = f.id';
  const conditions = [];
  const params = [];

  if (stage) { conditions.push('fo.stage = ?'); params.push(stage); }
  if (formationId) { conditions.push('fo.formation_id = ?'); params.push(formationId); }

  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY fo.created_at DESC';

  const rows = db.prepare(query).all(...params);
  return NextResponse.json(rows);
}

async function _POST(req) {
  const db = getDb();
  const body = await req.json();
  const id = 'fo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const now = new Date().toISOString();

  db.prepare(`INSERT INTO formation_opportunities (id, formation_id, client_name, client_email, client_phone, contact_name, company, stage, revenue, financement, notes, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id,
    body.formation_id || null,
    body.client_name || '',
    body.client_email || '',
    body.client_phone || '',
    body.contact_name || '',
    body.company || '',
    body.stage || 'prospect',
    body.revenue || 0,
    body.financement || '',
    body.notes || '',
    body.source || '',
    now, now,
  );

  const created = db.prepare('SELECT fo.*, f.title as formation_title, f.code as formation_code FROM formation_opportunities fo LEFT JOIN formations f ON fo.formation_id = f.id WHERE fo.id = ?').get(id);
  return NextResponse.json(created, { status: 201 });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('formations:read', _GET);
export const POST = withGuard('formations:create', _POST);
