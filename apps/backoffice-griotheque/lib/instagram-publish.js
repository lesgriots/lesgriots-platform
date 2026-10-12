// Publication de posts Instagram depuis le BO (photo, carrousel, reel, story),
// tout de suite ou à une heure donnée.
//
// Le déroulé imposé par l'API Instagram :
//   1. créer un « conteneur » par média (Meta va chercher le fichier à son URL
//      publique — d'où l'upload dans apps/lagriotheque/img/instagram/, servi par
//      https://lagriotheque.com/img/instagram/…)
//   2. pour une vidéo, attendre que Meta l'ait traitée (status_code FINISHED)
//   3. publier le conteneur → on reçoit l'id du post
//
// L'API ne sait pas programmer : les posts programmés restent ici, et un timer
// systemd appelle /api/instagram/tick chaque minute pour publier ceux dont
// l'heure est passée.
//
// Une fois publié, le post peut être relié à une automatisation Griot DM :
// une existante (on lui ajoute ce post), ou une nouvelle créée à la volée.

import { loadIg, mutateIg, upsertAutomation } from "./instagram-store.js";
import { currentToken } from "./instagram-api.js";
import { DEFAULTS } from "./griot-dm-defaults.js";

const BASE = () => `https://graph.instagram.com/${process.env.IG_GRAPH_VERSION || "v23.0"}`;
const SITE = "https://lagriotheque.com";
const uid = () => process.env.IG_USER_ID || "me";

export const KINDS = { image: "Photo", carousel: "Carrousel", reel: "Reel", story: "Story" };

async function api(path, { method = "GET", params = {} } = {}) {
  const url = new URL(BASE() + path);
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) (method === "GET" ? url.searchParams : body).set(k, String(v));
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${currentToken()}` },
    body: method === "GET" ? undefined : body,
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.error) throw new Error((d.error && (d.error.error_user_msg || d.error.message)) || `HTTP ${res.status}`);
  return d;
}

const publicUrl = (p) => (/^https?:/i.test(p) ? p : `${SITE}/${String(p).replace(/^\/+/, "")}`);
const isVideo = (m) => m.type === "video" || /\.(mp4|mov|m4v)$/i.test(m.path || "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitReady(containerId) {
  // Une vidéo peut prendre plusieurs minutes chez Meta. On attend jusqu'à 10 min.
  for (let i = 0; i < 120; i++) {
    const d = await api(`/${containerId}`, { params: { fields: "status_code,status" } });
    if (d.status_code === "FINISHED") return;
    if (d.status_code === "ERROR" || d.status_code === "EXPIRED") throw new Error("Meta a refusé le média : " + (d.status || d.status_code));
    await sleep(5000);
  }
  throw new Error("Traitement du média trop long chez Meta (10 min)");
}

async function container(m, extra = {}) {
  const params = { ...extra };
  if (isVideo(m)) {
    params.video_url = publicUrl(m.path);
    if (!params.media_type) params.media_type = "VIDEO";
  } else {
    params.image_url = publicUrl(m.path);
  }
  const d = await api(`/${uid()}/media`, { method: "POST", params });
  if (isVideo(m) || params.media_type === "REELS" || params.media_type === "STORIES") await waitReady(d.id);
  return d.id;
}

export function validatePost(p) {
  const media = p.media || [];
  if (!KINDS[p.kind]) return "Type de publication inconnu.";
  if (!media.length) return "Ajoute au moins un média.";
  if (p.kind === "carousel" && (media.length < 2 || media.length > 10)) return "Un carrousel prend de 2 à 10 médias.";
  if (p.kind !== "carousel" && media.length > 1) return "Un seul média pour ce type (sinon choisis Carrousel).";
  if (p.kind === "reel" && !isVideo(media[0])) return "Un reel est une vidéo.";
  for (const m of media) {
    if (!isVideo(m) && !/\.jpe?g$/i.test(m.path || "")) return "Instagram n'accepte que le JPEG pour les photos (pas de PNG ni WebP).";
  }
  if ((p.caption || "").length > 2200) return "Légende trop longue (2 200 caractères max).";
  if ((p.caption || "").split("#").length - 1 > 30) return "30 hashtags maximum.";
  return null;
}

export async function publishNow(p) {
  const caption = p.kind === "story" ? undefined : p.caption || "";
  let creation;
  if (p.kind === "carousel") {
    const children = [];
    for (const m of p.media) children.push(await container(m, { is_carousel_item: "true" }));
    const d = await api(`/${uid()}/media`, { method: "POST", params: { media_type: "CAROUSEL", children: children.join(","), caption } });
    creation = d.id;
    await waitReady(creation).catch(() => {}); // le carrousel lui-même est vite prêt
  } else if (p.kind === "reel") {
    creation = await container(p.media[0], { media_type: "REELS", caption, share_to_feed: "true" });
  } else if (p.kind === "story") {
    creation = await container(p.media[0], { media_type: "STORIES" });
  } else {
    creation = await container(p.media[0], { caption });
  }
  const pub = await api(`/${uid()}/media_publish`, { method: "POST", params: { creation_id: creation } });
  let permalink = "";
  try { permalink = (await api(`/${pub.id}`, { params: { fields: "permalink" } })).permalink || ""; } catch { /* facultatif */ }
  return { ig_media_id: pub.id, permalink };
}

export async function publishingLimit() {
  const d = await api(`/${uid()}/content_publishing_limit`, { params: { fields: "config,quota_usage" } });
  const row = (d.data || [])[0] || {};
  return { used: row.quota_usage ?? null, total: row.config ? row.config.quota_total : null };
}

// ---- Stockage --------------------------------------------------------------

export function listPosts() {
  return [...(loadIg().posts || [])].sort((a, b) =>
    String(b.scheduled_at || b.created_at).localeCompare(String(a.scheduled_at || a.created_at)));
}

export function savePost(input) {
  const err = validatePost(input);
  if (err) throw new Error(err);
  const now = new Date().toISOString();
  const id = input.id || `post-${Date.now().toString(36)}`;
  const when = input.scheduled_at ? new Date(input.scheduled_at) : null;
  if (when && isNaN(when)) throw new Error("Date de programmation invalide.");
  const post = {
    id,
    kind: input.kind,
    media: input.media.map((m) => ({ path: String(m.path), type: isVideo(m) ? "video" : "image" })),
    caption: String(input.caption || ""),
    scheduled_at: when ? when.toISOString() : null,
    status: when && when > new Date() ? "programme" : "a_publier",
    automation: input.automation && input.automation.mode !== "none" ? {
      mode: input.automation.mode,
      id: String(input.automation.id || ""),
      keywords: (Array.isArray(input.automation.keywords) ? input.automation.keywords : String(input.automation.keywords || "").split(","))
        .map((s) => s.trim()).filter(Boolean),
      resource_id: String(input.automation.resource_id || ""),
      link_url: String(input.automation.link_url || ""),
    } : null,
    error: "",
    created_at: now,
    updated_at: now,
  };
  mutateIg((s) => {
    s.posts = (s.posts || []).filter((x) => x.id !== id);
    s.posts.push(post);
  });
  return post;
}

export function deletePost(id) {
  return mutateIg((s) => {
    const p = (s.posts || []).find((x) => x.id === id);
    if (p && p.status === "publication") throw new Error("Publication en cours, impossible de supprimer.");
    s.posts = (s.posts || []).filter((x) => x.id !== id);
    return p ? 1 : 0;
  });
}

function patch(id, fields) {
  mutateIg((s) => {
    const p = (s.posts || []).find((x) => x.id === id);
    if (p) Object.assign(p, fields, { updated_at: new Date().toISOString() });
  });
}

function linkAutomation(post, mediaId) {
  const a = post.automation;
  if (!a) return "";
  if (a.mode === "existing" && a.id) {
    const s = loadIg();
    const cur = s.automations.find((x) => x.id === a.id);
    if (!cur) return "";
    // Une automatisation sur « tous les posts » couvre déjà celui-ci.
    if (cur.media_ids && cur.media_ids.length) upsertAutomation({ ...cur, media_ids: [...cur.media_ids, mediaId] });
    return cur.id;
  }
  if (a.mode === "new" && a.keywords.length) {
    const day = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    const created = upsertAutomation({
      id: `post-${mediaId}`.slice(0, 80),
      title: `${a.keywords[0]} — post du ${day}`,
      active: true,
      trigger: "comment",
      match: "contains",
      keywords: a.keywords,
      media_ids: [mediaId],
      public_replies: ["Je t'envoie ça en DM 📩", "Regarde tes messages 👀", "C'est parti, check tes DM ✨"],
      ask_email: true,
      newsletter: true,
      resource_id: a.resource_id,
      link_url: a.link_url,
      delivery_text: DEFAULTS.delivery_text,
    });
    return created.id;
  }
  return "";
}

// Publie un post enregistré. Ne jette jamais : l'erreur est rangée sur le post.
export async function runPost(id) {
  const p = (loadIg().posts || []).find((x) => x.id === id);
  if (!p || p.status === "publication" || p.status === "publie") return p;
  patch(id, { status: "publication", error: "" });
  try {
    const r = await publishNow(p);
    let automation_id = "";
    try { automation_id = linkAutomation(p, r.ig_media_id); } catch (e) { console.warn("lien automatisation:", e.message); }
    patch(id, { status: "publie", published_at: new Date().toISOString(), ...r, automation_id });
  } catch (e) {
    patch(id, { status: "erreur", error: e.message });
  }
  return (loadIg().posts || []).find((x) => x.id === id);
}

// Appelé chaque minute par le timer : publie ce qui est dû.
export async function tick() {
  const now = Date.now();
  const due = (loadIg().posts || []).filter((p) =>
    (p.status === "programme" && p.scheduled_at && Date.parse(p.scheduled_at) <= now) || p.status === "a_publier");
  for (const p of due) await runPost(p.id);
  return due.map((p) => p.id);
}
