import { NextResponse } from 'next/server';
import crypto, { randomUUID } from 'crypto';
import { getDb } from '@/lib/db.mjs';
import { withGuard, badRequest, trimStrings } from '@/lib/api-guard';
import { addDays } from '@/lib/session-lifecycle';
import { QUESTIONNAIRE_TYPES } from '@/lib/questionnaires';

/**
 * Liens publics d'une session (émargement en ligne / questionnaires).
 *
 * POST /api/sessions/:id/links
 *   body : { kind: 'emargement'|'questionnaire', questionnaireType?, slotDate?, apprenantId? }
 *   - émargement : lien GLOBAL à la session (la page publique liste les inscrits
 *     du jour et chacun signe). Expire à end_date + 7 jours.
 *   - questionnaire : global (chaque répondant choisit son nom) ou nominatif
 *     si apprenantId fourni. Expire à end_date + 120 jours.
 *
 * GET /api/sessions/:id/links — liste les liens de la session.
 */

/*
 * Une seule page publique, /p/<jeton>, et elle sert les deux usages : elle
 * lit le jeton, découvre ce qu'il ouvre, et affiche l'émargement ou le
 * questionnaire.
 *
 * Cette table promettait /p/emargement/<jeton> et /p/questionnaire/<jeton>.
 * Ces routes n'ont jamais existé : les deux rendaient un 404. Le bouton
 * disait « lien créé et copié », l'apprenant tombait sur une page d'erreur,
 * et rien nulle part ne le signalait. Quatre liens de questionnaire avaient
 * déjà été émis dans le vide.
 */
const PUBLIC_PATH = {
  emargement: (token) => `/p/${token}`,
  questionnaire: (token) => `/p/${token}`,
};

function withUrl(link) {
  return { ...link, url: PUBLIC_PATH[link.kind] ? PUBLIC_PATH[link.kind](link.token) : '' };
}

async function _GET(request, { params }) {
  const { id } = await params;
  const db = getDb();

  const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(id);
  if (!session) {
    return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
  }

  const links = db.prepare(`
    SELECT * FROM public_links WHERE session_id = ? ORDER BY created_at DESC
  `).all(id);

  return NextResponse.json(links.map(withUrl));
}

async function _POST(request, { params }) {
  const { id } = await params;
  const db = getDb();

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!session) {
    return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
  }

  let body;
  try { body = await request.json(); } catch { return badRequest('Corps JSON requis'); }
  if (!body || typeof body !== 'object') return badRequest('Corps JSON requis');
  trimStrings(body);

  const { kind, questionnaireType = null, slotDate = null, apprenantId = null } = body;

  if (!['emargement', 'questionnaire'].includes(kind)) {
    return badRequest("kind doit être 'emargement' ou 'questionnaire'");
  }

  let qType = null;
  if (kind === 'questionnaire') {
    qType = questionnaireType;
    if (!QUESTIONNAIRE_TYPES.includes(qType)) {
      return badRequest(`questionnaireType doit être : ${QUESTIONNAIRE_TYPES.join(', ')}`);
    }
  }

  if (apprenantId) {
    const insc = db.prepare(
      'SELECT id FROM inscriptions WHERE session_id = ? AND apprenant_id = ?'
    ).get(id, apprenantId);
    if (!insc) return badRequest('Apprenant non inscrit à cette session');
  }

  const endDate = String(session.end_date || session.start_date || '').slice(0, 10);
  const expiresAt = kind === 'emargement' ? addDays(endDate, 7) : addDays(endDate, 120);

  const token = crypto.randomBytes(24).toString('hex');
  const linkId = randomUUID();

  db.prepare(`
    INSERT INTO public_links (id, kind, token, session_id, apprenant_id, questionnaire_type, slot_date, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(linkId, kind, token, id, apprenantId || null, qType, slotDate || null, expiresAt || null);

  const link = db.prepare('SELECT * FROM public_links WHERE id = ?').get(linkId);
  return NextResponse.json(withUrl(link), { status: 201 });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('sessions:update', _GET);
export const POST = withGuard('sessions:update', _POST);
