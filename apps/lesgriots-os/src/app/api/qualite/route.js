import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { computeQualiopiStatus } from '@/lib/qualiopi';

/**
 * GET /api/qualite — Cockpit Qualiopi : statut de chaque indicateur RNQ
 * (auto quand calculable) + preuves manuelles rattachées.
 */
async function _GET() {
  const db = getDb();
  const indicators = computeQualiopiStatus(db);
  const evidence = db.prepare(`
    SELECT e.*, f.title as formation_title, fo.title as session_formation_title, s.code_interne
    FROM qualiopi_evidence e
    LEFT JOIN formations f ON f.id = e.formation_id
    LEFT JOIN sessions s ON s.id = e.session_id
    LEFT JOIN formations fo ON fo.id = s.formation_id
    ORDER BY e.indicator ASC, e.created_at DESC
  `).all();

  return NextResponse.json({ indicators, evidence });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('formations:read', _GET);
