// Client Graph API Instagram (« API Instagram avec connexion Instagram »).
//
// Variables (dans /etc/lagriotheque-backoffice.env) :
//   IG_ACCESS_TOKEN   jeton longue durée (60 j) du compte Instagram pro de La Griothèque
//   IG_APP_SECRET     clé secrète de l'app Meta (signature des webhooks)
//   IG_VERIFY_TOKEN   chaîne libre, recopiée dans la config webhook de Meta
//   IG_USER_ID        id Instagram du compte (pour ignorer nos propres commentaires)
//   IG_GRAPH_VERSION  optionnel (défaut v23.0)
//   IG_DRY_RUN=1      optionnel : n'envoie rien, journalise seulement
//
// Le jeton est rafraîchi automatiquement (tous les ~30 jours) et la version
// rafraîchie est gardée dans instagram.json : le .env ne sert qu'au démarrage.

import crypto from "crypto";
import { loadIg, mutateIg } from "./instagram-store.js";

const BASE = () => `https://graph.instagram.com/${process.env.IG_GRAPH_VERSION || "v23.0"}`;

export function igConfig() {
  return {
    hasToken: !!currentToken(),
    hasSecret: !!process.env.IG_APP_SECRET,
    hasVerify: !!process.env.IG_VERIFY_TOKEN,
    userId: process.env.IG_USER_ID || "",
    dryRun: process.env.IG_DRY_RUN === "1",
  };
}

export function currentToken() {
  try {
    const t = loadIg().token;
    if (t && t.access_token) return t.access_token;
  } catch { /* store illisible → on retombe sur l'env */ }
  return process.env.IG_ACCESS_TOKEN || "";
}

export function tokenInfo() {
  try {
    const t = loadIg().token;
    if (t && t.access_token) return { source: "rafraîchi", refreshed_at: t.refreshed_at, expires_at: t.expires_at };
  } catch { /* ignore */ }
  return { source: process.env.IG_ACCESS_TOKEN ? "env" : "absent" };
}

async function call(path, { method = "GET", body, query } = {}) {
  const token = currentToken();
  if (!token) throw new Error("IG_ACCESS_TOKEN manquant");
  const url = new URL(BASE() + path);
  for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const e = new Error(`instagram ${path} → ${res.status} ${data.error ? data.error.message : ""}`.trim());
    e.meta = data.error || null;
    throw e;
  }
  return data;
}

// ---- Expéditeur ------------------------------------------------------------
// Le moteur ne parle qu'à cet objet. En réel il appelle Meta ; en simulation
// (BO « Simulateur » ou IG_DRY_RUN=1) il note ce qui SERAIT envoyé.

export function realSender() {
  const myId = () => process.env.IG_USER_ID || "me";
  return {
    dry: false,
    async replyToComment(commentId, text) {
      return call(`/${commentId}/replies`, { method: "POST", query: { message: text } });
    },
    // Réponse privée à un commentaire : UNE seule par commentaire, dans les 7 jours.
    async privateReply(commentId, message) {
      return call(`/${myId()}/messages`, { method: "POST", body: { recipient: { comment_id: commentId }, message } });
    },
    async sendMessage(igsid, message) {
      return call(`/${myId()}/messages`, { method: "POST", body: { recipient: { id: igsid }, message } });
    },
    async profile(igsid) {
      return call(`/${igsid}`, { query: { fields: "username,name,is_user_follow_business" } });
    },
  };
}

export function dryRunSender({ follows = true, username = "" } = {}) {
  const out = [];
  return {
    dry: true,
    out,
    async replyToComment(commentId, text) { out.push({ kind: "réponse publique", text }); return { id: "dry" }; },
    async privateReply(commentId, message) { out.push({ kind: "DM (réponse privée)", message }); return { message_id: "dry" }; },
    async sendMessage(igsid, message) { out.push({ kind: "DM", message }); return { message_id: "dry" }; },
    async profile() { return { username, is_user_follow_business: follows }; },
  };
}

export function getSender() {
  return process.env.IG_DRY_RUN === "1" ? dryRunSender() : realSender();
}

// ---- Compte, posts, jeton ---------------------------------------------------

export async function getAccount() {
  return call(`/me`, { query: { fields: "user_id,username,name,profile_picture_url,followers_count,media_count" } });
}

export async function listMedia(limit = 24) {
  const d = await call(`/me/media`, {
    query: { fields: "id,caption,media_type,media_product_type,thumbnail_url,media_url,permalink,timestamp", limit: String(limit) },
  });
  return d.data || [];
}

// Un jeton longue durée se rafraîchit s'il a plus de 24 h ; il repart pour 60 j.
export async function refreshToken() {
  const token = currentToken();
  if (!token) throw new Error("Aucun jeton à rafraîchir");
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", token);
  const res = await fetch(url);
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.access_token) throw new Error("Rafraîchissement refusé : " + (d.error ? d.error.message : res.status));
  const now = Date.now();
  mutateIg((s) => {
    s.token = {
      access_token: d.access_token,
      refreshed_at: new Date(now).toISOString(),
      expires_at: new Date(now + (Number(d.expires_in) || 5184000) * 1000).toISOString(),
    };
  });
  return tokenInfo();
}

// Appelé par le webhook (sans bloquer) : rafraîchit si le dernier
// rafraîchissement date de plus de 30 jours, ou n'a jamais eu lieu.
let lastAttempt = 0;
export function maybeRefreshToken() {
  if (Date.now() - lastAttempt < 6 * 3600 * 1000) return;
  lastAttempt = Date.now();
  let t = null;
  try { t = loadIg().token; } catch { return; }
  const age = t && t.refreshed_at ? Date.now() - Date.parse(t.refreshed_at) : Infinity;
  if (age > 30 * 86400 * 1000) refreshToken().catch((e) => console.warn("ig token refresh:", e.message));
}

// ---- Webhook ----------------------------------------------------------------

export function verifySignature(rawBody, header) {
  const secret = process.env.IG_APP_SECRET;
  if (!secret) return false;
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const got = header.slice(7);
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got, "hex"), Buffer.from(expected, "hex"));
}

// Abonne le compte aux webhooks de l'app (à faire une fois, après connexion).
// Sans cet appel, Meta ne pousse rien même si l'URL est configurée.
export async function subscribeWebhooks() {
  return call(`/me/subscribed_apps`, { method: "POST", query: { subscribed_fields: "comments,messages,messaging_postbacks" } });
}
export async function getSubscriptions() {
  return call(`/me/subscribed_apps`);
}
