// Boîte de réception Griot DM : relie les conversations Instagram aux contacts
// locaux (email, étiquettes, note, pause, inscriptions).
import { igConfig } from "./instagram-api.js";

const WINDOW = 24 * 3600e3;

export function myIds() {
  const { userId } = igConfig();
  return new Set([String(userId || ""), String(process.env.IG_BUSINESS_ID || "")].filter(Boolean));
}
const ME_NAMES = () => new Set([String(process.env.IG_USERNAME || "lagriotheque").toLowerCase()]);

export function isMe(from) {
  if (!from) return false;
  return myIds().has(String(from.id)) || ME_NAMES().has(String(from.username || "").toLowerCase());
}

export function other(conv) {
  const ps = (conv.participants && conv.participants.data) || [];
  return ps.find((p) => !isMe(p)) || ps[0] || {};
}

export function contactView(c) {
  if (!c) return null;
  return {
    igsid: c.igsid, username: c.username || "", email: c.email || "",
    labels: c.labels || [], note: c.note || "",
    paused: !!c.paused, paused_until: c.paused_until || null,
    last_in_at: c.last_in_at || null, seen_at: c.seen_at || null,
    conversions: c.conversions || [], history: (c.history || []).map((h) => h.automation),
  };
}

// Fenêtre de 24 h : calculée sur le dernier message reçu (fil Instagram ou
// dernier message vu par le webhook, le plus récent des deux).
export function windowInfo(lastInIso) {
  const t = Date.parse(lastInIso || 0);
  if (!t) return { open: false, ends_at: null };
  const end = t + WINDOW;
  return { open: Date.now() < end, ends_at: new Date(end).toISOString() };
}
