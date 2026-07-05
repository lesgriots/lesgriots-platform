// Rate limiting en mémoire — protège les routes PUBLIQUES (/api/leads,
// /api/subscribe, /api/stripe/create-payment-intent) contre le spam de bots.
//
// Fenêtre glissante par clé (IP + route). En mémoire : se réinitialise au
// redémarrage du serveur, ce qui est acceptable pour un back office
// mono-instance. Pas de dépendance externe.

const buckets = new Map();
const MAX_KEYS = 10000; // garde-fou mémoire si un botnet varie les IPs

/**
 * @param {string} key — identifiant unique (ex: `${ip}:leads`)
 * @param {{limit?: number, windowMs?: number}} opts
 * @returns {boolean} true si la requête est autorisée
 */
export function rateLimit(key, { limit = 5, windowMs = 60_000 } = {}) {
  const now = Date.now();
  if (buckets.size > MAX_KEYS) buckets.clear();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

/** Extrait l'IP client (derrière nginx : X-Forwarded-For / X-Real-IP). */
export function clientIp(req) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/** Réponse 429 standard, avec les headers CORS de la route appelante. */
export function tooMany(headers = {}) {
  return new Response(
    JSON.stringify({ error: "Trop de requêtes, réessaie dans une minute." }),
    {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "60", ...headers },
    }
  );
}
