/**
 * LES GRIOTS OS — Garde API
 *
 * Protection des routes API : authentification (session DB ou clé API MCP),
 * permissions RBAC, et gestion d'erreurs sans fuite d'information.
 *
 * La VRAIE validation se fait ici (le middleware edge ne peut pas lire SQLite,
 * il ne fait qu'un tri rapide en amont).
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSessionFromRequest, hasPermission } from './auth';

// Comparaison timing-safe : buffers de même longueur obligatoires pour timingSafeEqual,
// on compare donc des HMAC des deux valeurs (longueur constante) pour ne rien fuiter.
function timingSafeCompare(a, b) {
  const key = crypto.randomBytes(32);
  const hmacA = crypto.createHmac('sha256', key).update(String(a)).digest();
  const hmacB = crypto.createHmac('sha256', key).update(String(b)).digest();
  return crypto.timingSafeEqual(hmacA, hmacB);
}

/**
 * Vérifie l'authentification (et la permission si fournie).
 * Retourne { ok: true, session } ou { ok: false, status, error }.
 */
export function requireAuth(request, permission) {
  // ── Bypass DEV uniquement : jamais en production ──
  if (process.env.NODE_ENV !== 'production' && process.env.AUTH_ENABLED !== 'true') {
    return { ok: true, session: { userId: 'dev', name: 'Dev', role: 'admin' } };
  }

  // ── Clé API (serveur MCP) via header x-api-key ──
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    const validKey = process.env.OS_API_KEY;
    if (!validKey || !timingSafeCompare(apiKey, validKey)) {
      return { ok: false, status: 401, error: 'Authentification requise' };
    }
    const session = { userId: 'mcp', name: 'MCP', role: 'admin' };
    if (permission && !hasPermission(session.role, permission)) {
      return { ok: false, status: 403, error: 'Accès refusé' };
    }
    return { ok: true, session };
  }

  // ── Session utilisateur (cookie griot_session ou Bearer) — validation en DB ──
  const session = getSessionFromRequest(request);
  if (!session) {
    return { ok: false, status: 401, error: 'Authentification requise' };
  }
  if (permission && !hasPermission(session.role, permission)) {
    return { ok: false, status: 403, error: 'Accès refusé' };
  }
  return { ok: true, session };
}

/**
 * Wrappe un handler de route : auth + permission + try/catch global.
 * Le handler reçoit (request, ctx, session).
 * Usage : export const GET = withGuard('projects:read', async (req, ctx, session) => { ... });
 */
export function withGuard(permission, handler) {
  return async function guarded(request, ctx) {
    const auth = requireAuth(request, permission);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    try {
      return await handler(request, ctx, auth.session);
    } catch (err) {
      // Log serveur complet, mais AUCUN détail (message/stack) renvoyé au client.
      console.error('[api]', request.method, request.nextUrl?.pathname, err);
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
  };
}

/** Réponse 400 standardisée pour la validation d'entrées. */
export function badRequest(msg) {
  return NextResponse.json({ error: msg, code: 'VALIDATION_ERROR' }, { status: 400 });
}

/** Tronque toutes les strings d'un objet à `max` caractères (payloads géants). */
export function trimStrings(obj, max = 10000) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === 'string' && obj[k].length > max) obj[k] = obj[k].slice(0, max);
  }
  return obj;
}

/** Caste en nombre fini, sinon fallback. */
export function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
