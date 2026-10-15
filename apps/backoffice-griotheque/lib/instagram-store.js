// Stockage du module Instagram (« Griot DM », notre ManyChat maison).
//
// Fichier SÉPARÉ de griotheque.json, volontairement :
//   - le webhook écrit à chaque commentaire / message reçu. Dans
//     griotheque.json, chaque écriture déclenche un backup rotatif (30 max) :
//     une soirée de commentaires aurait chassé tous les vrais backups.
//   - il contient des données personnelles (pseudos, emails, identifiants
//     Instagram) : il est gitignoré, il ne part jamais dans le repo.
//
// Contenu :
//   automations[] : les règles (mot-clé → réponse publique → DM → email → lien)
//   contacts[]    : une fiche par personne qui a interagi (IGSID, pseudo, email, état)
//   log[]         : journal des 400 derniers événements (lisible dans le BO)
//   processed[]   : ids de commentaires / messages déjà traités (anti-doublon,
//                   Meta renvoie parfois le même webhook plusieurs fois)
//   token         : jeton d'accès rafraîchi (le .env ne porte que le premier)

import fs from "fs";
import path from "path";

const STORE_PATH = process.env.IG_STORE_PATH || path.join(process.cwd(), "instagram.json");
const MAX_LOG = 400;
const MAX_PROCESSED = 3000;

const EMPTY = () => ({ automations: [], contacts: [], log: [], processed: [], token: null, stats: {} });

export function loadIg() {
  if (!fs.existsSync(STORE_PATH)) return EMPTY();
  const raw = fs.readFileSync(STORE_PATH, "utf8");
  try {
    return { ...EMPTY(), ...JSON.parse(raw) };
  } catch (e) {
    const q = `${STORE_PATH}.corrupted-${Date.now()}`;
    try { fs.copyFileSync(STORE_PATH, q); } catch { /* best effort */ }
    throw new Error("instagram.json corrompu (copie : " + q + ")");
  }
}

export function saveIg(store) {
  store.log = (store.log || []).slice(-MAX_LOG);
  store.processed = (store.processed || []).slice(-MAX_PROCESSED);
  const tmp = STORE_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, STORE_PATH);
}

// Petite sauvegarde quotidienne (une par jour, 14 gardées) : les automatisations
// sont de la config qu'on ne veut pas perdre sur une fausse manip.
export function dailyBackup() {
  if (!fs.existsSync(STORE_PATH)) return;
  try {
    const dir = path.join(path.dirname(STORE_PATH), "backups");
    fs.mkdirSync(dir, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    const target = path.join(dir, `instagram-${day}.json`);
    if (!fs.existsSync(target)) fs.copyFileSync(STORE_PATH, target);
    const all = fs.readdirSync(dir).filter((f) => /^instagram-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    for (const f of all.slice(0, Math.max(0, all.length - 14))) fs.unlinkSync(path.join(dir, f));
  } catch (e) { console.warn("backup instagram.json :", e.message); }
}

// Mutation atomique : charge, applique fn(store), sauve. Node est mono-thread
// et tout est synchrone ici, donc pas de course entre deux webhooks.
export function mutateIg(fn) {
  const store = loadIg();
  const out = fn(store);
  saveIg(store);
  return out;
}

export function logIg(store, entry) {
  store.log = store.log || [];
  store.log.push({ at: new Date().toISOString(), ...entry });
}

// ---- Automatisations ------------------------------------------------------

const SLUG_RE = /^[a-z0-9_-]{1,80}$/;

export function normalizeAutomation(a) {
  const list = (v) => (Array.isArray(v) ? v : String(v || "").split(/[,\n]/))
    .map((s) => String(s).trim()).filter(Boolean);
  return {
    id: String(a.id || "").trim().toLowerCase(),
    title: String(a.title || "").trim().slice(0, 120),
    active: !!a.active,
    // comment = sous un post / reel ; dm = message direct (ou réponse à une story) ; both
    trigger: ["comment", "dm", "both"].includes(a.trigger) ? a.trigger : "comment",
    keywords: list(a.keywords).slice(0, 20),
    match: ["contains", "exact", "any"].includes(a.match) ? a.match : "contains",
    media_ids: list(a.media_ids).slice(0, 50), // vide = tous les posts
    public_replies: list(a.public_replies).slice(0, 10),
    opening_text: String(a.opening_text || "").slice(0, 900),
    opening_button: String(a.opening_button || "").slice(0, 20),
    follow_gate: !!a.follow_gate,
    follow_text: String(a.follow_text || "").slice(0, 900),
    ask_email: !!a.ask_email,
    email_text: String(a.email_text || "").slice(0, 900),
    email_invalid_text: String(a.email_invalid_text || "").slice(0, 400),
    newsletter: !!a.newsletter,
    resource_id: String(a.resource_id || "").slice(0, 100),
    link_url: String(a.link_url || "").slice(0, 500),
    link_label: String(a.link_label || "").slice(0, 20),
    // Vidéo (ou image) envoyée avant le message de livraison : URL publique
    // https, mp4 de moins de 25 Mo (règle Meta). Vide = pas de média.
    video_url: String(a.video_url || "").slice(0, 500),
    delivery_text: String(a.delivery_text || "").slice(0, 900),
    followup_text: String(a.followup_text || "").slice(0, 900),
    relance_enabled: !!a.relance_enabled,
    relance_delay_h: Math.max(1, Math.min(20, Number(a.relance_delay_h) || 3)),
    relance_text: String(a.relance_text || "").slice(0, 640),
    position: Number(a.position) || 0,
  };
}

export function validateAutomation(a) {
  if (!SLUG_RE.test(a.id)) return "id invalide (minuscules, chiffres, tirets).";
  if (!a.title) return "Titre requis.";
  if (a.match !== "any" && !a.keywords.length) return "Au moins un mot-clé (ou « tous les commentaires »).";
  if (!a.delivery_text && !a.link_url && !a.resource_id) return "Il faut un message de livraison ou un lien.";
  return null;
}

export function listAutomations() {
  const s = loadIg();
  return [...s.automations].sort((a, b) => (a.position - b.position) || a.title.localeCompare(b.title))
    .map((a) => ({ ...a, stats: (s.stats || {})[a.id] || {} }));
}

export function getAutomation(id) {
  return loadIg().automations.find((a) => a.id === id) || null;
}

export function upsertAutomation(input) {
  const a = normalizeAutomation(input);
  const err = validateAutomation(a);
  if (err) throw new Error(err);
  dailyBackup();
  return mutateIg((s) => {
    const now = new Date().toISOString();
    const i = s.automations.findIndex((x) => x.id === a.id);
    const next = { ...a, updated_at: now, created_at: (i >= 0 && s.automations[i].created_at) || now };
    if (i >= 0) s.automations[i] = next; else s.automations.push(next);
    return next;
  });
}

export function deleteAutomation(id) {
  dailyBackup();
  return mutateIg((s) => {
    const before = s.automations.length;
    s.automations = s.automations.filter((a) => a.id !== id);
    return before - s.automations.length;
  });
}

export function bumpStat(store, automationId, key) {
  store.stats = store.stats || {};
  const st = (store.stats[automationId] = store.stats[automationId] || {});
  st[key] = (st[key] || 0) + 1;
  st.last_at = new Date().toISOString();
}

// ---- Contacts --------------------------------------------------------------

export function getContact(store, igsid) {
  return (store.contacts || []).find((c) => c.igsid === igsid) || null;
}

export function upsertContact(store, igsid, patch = {}) {
  store.contacts = store.contacts || [];
  let c = getContact(store, igsid);
  const now = new Date().toISOString();
  if (!c) {
    c = { igsid, username: "", email: "", state: null, pending: null, paused: false, history: [], created_at: now };
    store.contacts.push(c);
  }
  Object.assign(c, patch, { updated_at: now });
  return c;
}
