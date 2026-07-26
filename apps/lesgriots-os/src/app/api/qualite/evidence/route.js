import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/db.mjs';
import { withGuard, badRequest, trimStrings, toNum } from '@/lib/api-guard';
import { INDICATORS } from '@/lib/qualiopi';

/**
 * POST /api/qualite/evidence — rattache une preuve manuelle à un indicateur Qualiopi.
 * body : { indicator, kind?, ref?, note?, session_id?, formation_id? }
 */
async function _POST(request) {
  const db = getDb();
  let body;
  try { body = await request.json(); } catch { return badRequest('Corps JSON requis'); }
  if (!body || typeof body !== 'object') return badRequest('Corps JSON requis');
  trimStrings(body);

  const indicator = toNum(body.indicator, 0);
  if (!INDICATORS.some(i => i.num === indicator)) {
    return badRequest('indicator invalide (indicateur RNQ non applicable)');
  }

  const kind = body.kind || 'note';
  if (!['document', 'lien', 'note', 'auto'].includes(kind)) {
    return badRequest("kind doit être : document, lien, note ou auto");
  }

  const sessionId = body.session_id || null;
  if (sessionId && !db.prepare('SELECT id FROM sessions WHERE id = ?').get(sessionId)) {
    return badRequest('session_id inconnu');
  }
  const formationId = body.formation_id || null;
  if (formationId && !db.prepare('SELECT id FROM formations WHERE id = ?').get(formationId)) {
    return badRequest('formation_id inconnu');
  }

  const id = randomUUID();
  db.prepare(`
    INSERT INTO qualiopi_evidence (id, indicator, kind, ref, note, session_id, formation_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, indicator, kind, body.ref || '', body.note || '', sessionId, formationId);

  const row = db.prepare('SELECT * FROM qualiopi_evidence WHERE id = ?').get(id);
  return NextResponse.json(row, { status: 201 });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
// 'formations:update' = admin + manager
export const POST = withGuard('formations:update', _POST);
