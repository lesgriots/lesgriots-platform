// GRIOT DM — le moteur d'automatisation Instagram de La Griothèque.
// (Notre ManyChat maison : mot-clé en commentaire → réponse publique → DM →
// email capté → lien livré. Tout reste chez nous, branché sur les leads du BO
// et sur Systeme.io.)
//
// Parcours type « commentaire » :
//   1. quelqu'un commente « RECIT » sous un post
//   2. on lui répond publiquement (« Regarde tes DM 👀 », variantes tirées au sort)
//   3. on lui envoie UNE réponse privée avec un bouton (règle Meta : une seule
//      réponse privée par commentaire, et rien d'autre tant qu'il n'a pas répondu)
//   4. il touche le bouton → la fenêtre de conversation de 24 h s'ouvre
//   5. (option) on vérifie qu'il suit le compte
//   6. (option) on lui demande son email → lead BO + Systeme.io
//   7. on livre : message + bouton lien (ressource du BO ou URL libre)
//
// Parcours « DM » : même chose à partir de l'étape 5, déclenché par un mot-clé
// envoyé en message direct (ou en réponse à une story).

import { loadIg, saveIg, logIg, bumpStat, getContact, upsertContact } from "./instagram-store.js";
import { getResource, addLead } from "./db.js";
import { syncContactToSystemeIo } from "./systeme.js";

const SITE = "https://lagriotheque.com";
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

import { DEFAULTS } from "./griot-dm-defaults.js";
export { DEFAULTS };

// ---- File d'attente ----------------------------------------------------------
// Les événements sont traités un par un : deux webhooks simultanés ne doivent
// pas lire puis réécrire instagram.json en même temps (mise à jour perdue).
let queue = Promise.resolve();
export function enqueue(task) {
  const run = queue.then(task, task);
  queue = run.catch((e) => console.error("griot-dm:", e));
  return run;
}

// ---- Outils -----------------------------------------------------------------

export function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9@]+/g, " ").trim();
}

export function matches(automation, text) {
  if (automation.match === "any") return true;
  const t = norm(text);
  return automation.keywords.some((k) => {
    const kw = norm(k);
    if (!kw) return false;
    return automation.match === "exact" ? t === kw : (" " + t + " ").includes(" " + kw + " ");
  });
}

function fill(text, ctx) {
  return String(text || "")
    .replace(/\{pseudo\}/g, ctx.username ? "@" + ctx.username : "")
    .replace(/\{prenom\}/g, ctx.username || "")
    .replace(/\{lien\}/g, ctx.url || "")
    .replace(/\s+([!?,.])/g, (m, p) => (p === "," || p === "." ? p : " " + p))
    .replace(/ {2,}/g, " ")
    .trim();
}

function pick(list) {
  return list && list.length ? list[Math.floor(Math.random() * list.length)] : "";
}

function deliveryUrl(a) {
  if (a.link_url) return a.link_url;
  if (a.resource_id) {
    const r = getResource(a.resource_id);
    if (r && r.href) return /^https?:/i.test(r.href) ? r.href : `${SITE}/${String(r.href).replace(/^\/+/, "")}`;
    return `${SITE}/#ressources`;
  }
  return "";
}

function quick(text, title, payload) {
  return { text, quick_replies: [{ content_type: "text", title: title.slice(0, 20), payload }] };
}

// Envoie avec repli : si Meta refuse les boutons (quick replies / modèle), on
// renvoie en texte simple plutôt que de perdre le message.
async function sendSafe(fn, message, fallbackText, logs) {
  try { return await fn(message); }
  catch (e) {
    logs.push({ type: "repli", error: e.message });
    return fn({ text: fallbackText });
  }
}

// ---- Étapes -----------------------------------------------------------------

async function proceed(ctx) {
  const { store, contact, a, sender, logs } = ctx;
  const vars = { username: contact.username };

  if (a.follow_gate && !contact.follow_ok) {
    let follows = false;
    try { const p = await sender.profile(contact.igsid); follows = !!p.is_user_follow_business; if (p.username) contact.username = p.username; }
    catch (e) { logs.push({ type: "erreur", error: "profil : " + e.message }); follows = true; /* on ne bloque pas sur une panne */ }
    if (!follows) {
      contact.pending = { automation: a.id, step: "follow", at: new Date().toISOString(), tries: ((contact.pending && contact.pending.tries) || 0) + 1 };
      const txt = fill(a.follow_text || DEFAULTS.follow_text, vars);
      await sendSafe((m) => sender.sendMessage(contact.igsid, m), quick(txt, "C'est fait ✅", `GDM:${a.id}:followed`), txt + "\n\nRéponds « ok » une fois abonné·e.", logs);
      logs.push({ type: "abonnement demandé", automation: a.id });
      return;
    }
    contact.follow_ok = true;
  }

  if (a.ask_email && !contact.email) {
    contact.state = "awaiting_email";
    contact.pending = { automation: a.id, step: "email", at: new Date().toISOString(), tries: 0 };
    await sender.sendMessage(contact.igsid, { text: fill(a.email_text || DEFAULTS.email_text, vars) });
    logs.push({ type: "email demandé", automation: a.id });
    return;
  }

  await deliver(ctx);
}

async function deliver(ctx) {
  const { store, contact, a, sender, logs } = ctx;
  const url = deliveryUrl(a);
  const vars = { username: contact.username, url };
  const text = fill(a.delivery_text || DEFAULTS.delivery_text, vars).slice(0, 640);

  // Média d'abord (ex. la vidéo d'invitation), puis le texte et son bouton.
  if (a.video_url) {
    const type = /\.(jpe?g|png|gif|webp)(\?|$)/i.test(a.video_url) ? "image" : "video";
    try {
      await sender.sendMessage(contact.igsid, { attachment: { type, payload: { url: a.video_url } } });
      logs.push({ type: "média envoyé", automation: a.id, url: a.video_url });
    } catch (e) {
      logs.push({ type: "erreur", error: "média : " + e.message });
    }
  }
  if (url) {
    const tpl = {
      attachment: {
        type: "template",
        payload: { template_type: "button", text, buttons: [{ type: "web_url", url, title: (a.link_label || DEFAULTS.link_label).slice(0, 20) }] },
      },
    };
    await sendSafe((m) => sender.sendMessage(contact.igsid, m), tpl, `${text}\n\n👉 ${url}`, logs);
  } else {
    await sender.sendMessage(contact.igsid, { text });
  }
  if (a.followup_text) {
    await sender.sendMessage(contact.igsid, { text: fill(a.followup_text, vars) });
  }

  contact.state = null;
  contact.pending = null;
  contact.history = [...(contact.history || []), { automation: a.id, delivered_at: new Date().toISOString() }].slice(-30);
  bumpStat(store, a.id, "delivered");
  logs.push({ type: "livré", automation: a.id, url });
}

async function captureEmail(ctx, text) {
  const { store, contact, a, sender, logs, dry } = ctx;
  const m = String(text || "").match(EMAIL_RE);
  if (!m) {
    contact.pending.tries = (contact.pending.tries || 0) + 1;
    if (contact.pending.tries >= 3) {
      contact.state = null; contact.pending = null;
      logs.push({ type: "abandon (email)", automation: a.id });
      return;
    }
    await sender.sendMessage(contact.igsid, { text: fill(a.email_invalid_text || DEFAULTS.email_invalid_text, { username: contact.username }) });
    logs.push({ type: "email invalide", automation: a.id, text: String(text).slice(0, 80) });
    return;
  }
  const email = m[0].toLowerCase();
  contact.email = email;
  contact.state = null;
  bumpStat(store, a.id, "emails");
  logs.push({ type: "email capté", automation: a.id, email });

  if (!dry) {
    try {
      addLead({
        email, name: contact.username ? "@" + contact.username : "", link: contact.username ? "@" + contact.username : "",
        resource_id: a.resource_id || "", consent: !!a.newsletter, source: "instagram", subject: a.title,
      });
    } catch (e) { logs.push({ type: "erreur", error: "lead : " + e.message }); }
    const tags = ["site-lagriotheque", "src-instagram"];
    if (a.newsletter) tags.unshift("Newsletter");
    syncContactToSystemeIo({ email, source: `instagram:${a.id}`, tags })
      .catch((e) => console.warn("systeme.io sync (instagram):", e.message));
  }
  await proceed(ctx);
}

function findAutomation(store, { kind, text, mediaId }) {
  return store.automations
    .filter((a) => a.active && (a.trigger === "both" || a.trigger === kind))
    .filter((a) => kind !== "comment" || !a.media_ids.length || a.media_ids.includes(String(mediaId)))
    .sort((x, y) => x.position - y.position)
    .find((a) => matches(a, text)) || null;
}

// ---- Points d'entrée -----------------------------------------------------------

/**
 * Commentaire reçu.
 * @param {object} ev { commentId, text, fromId, username, mediaId }
 * @param {object} opts { sender, store?, dry? }  store fourni = simulation (non sauvé)
 */
export async function handleComment(ev, { sender, store: given, dry = false } = {}) {
  const store = given || loadIg();
  const logs = [];
  const myId = process.env.IG_USER_ID;
  try {
    if (myId && String(ev.fromId) === String(myId)) return { skipped: "nous-même" };
    const key = "c:" + ev.commentId;
    if (store.processed.includes(key)) return { skipped: "déjà traité" };
    store.processed.push(key);

    const a = findAutomation(store, { kind: "comment", text: ev.text, mediaId: ev.mediaId });
    if (!a) { logs.push({ type: "commentaire ignoré", text: String(ev.text).slice(0, 80) }); return { matched: null }; }

    const contact = upsertContact(store, String(ev.fromId), ev.username ? { username: ev.username } : {});
    if (contact.paused) { logs.push({ type: "contact en pause", automation: a.id }); return { matched: a.id, paused: true }; }
    bumpStat(store, a.id, "triggered");
    logs.push({ type: "déclenché (commentaire)", automation: a.id, text: String(ev.text).slice(0, 80) });

    if (a.public_replies.length) {
      try { await sender.replyToComment(ev.commentId, fill(pick(a.public_replies), { username: contact.username })); }
      catch (e) { logs.push({ type: "erreur", error: "réponse publique : " + e.message }); }
    }

    const txt = fill(a.opening_text || DEFAULTS.opening_text, { username: contact.username });
    contact.pending = { automation: a.id, step: "opened", at: new Date().toISOString(), tries: 0 };
    await sendSafe(
      (m) => sender.privateReply(ev.commentId, m),
      quick(txt, a.opening_button || DEFAULTS.opening_button, `GDM:${a.id}:open`),
      txt + "\n\nRéponds « oui » ici 👇",
      logs
    );
    return { matched: a.id };
  } catch (e) {
    logs.push({ type: "erreur", error: e.message });
    return { error: e.message };
  } finally {
    for (const l of logs) logIg(store, { ...l, igsid: ev.fromId, username: ev.username || "" });
    if (!given) saveIg(store);
  }
}

/**
 * Message direct reçu (texte, bouton rapide, ou réponse à une story).
 * @param {object} ev { igsid, text, payload, mid }
 */
export async function handleMessage(ev, { sender, store: given, dry = false } = {}) {
  const store = given || loadIg();
  const logs = [];
  let contact = null;
  try {
    const myId = process.env.IG_USER_ID;
    if (myId && String(ev.igsid) === String(myId)) return { skipped: "nous-même" };
    if (ev.mid) {
      const key = "m:" + ev.mid;
      if (store.processed.includes(key)) return { skipped: "déjà traité" };
      store.processed.push(key);
    }
    contact = getContact(store, String(ev.igsid)) || upsertContact(store, String(ev.igsid));
    contact.updated_at = new Date().toISOString();
    if (contact.paused) return { paused: true };

    // Pseudo inconnu (contact venu par DM) : on le demande une fois à Meta.
    if (!contact.username && !sender.dry) {
      try { const p = await sender.profile(contact.igsid); if (p.username) contact.username = p.username; } catch { /* sans importance */ }
    }

    const byId = (id) => store.automations.find((x) => x.id === id && x.active);
    const payload = String(ev.payload || "");
    const fromButton = payload.startsWith("GDM:") ? byId(payload.split(":")[1]) : null;
    const ctx = (a) => ({ store, contact, a, sender, logs, dry });

    // 1. Bouton d'une de nos automatisations
    if (fromButton) {
      logs.push({ type: "bouton", automation: fromButton.id, payload });
      if (contact.state === "awaiting_email" && contact.pending && contact.pending.automation === fromButton.id) {
        await sender.sendMessage(contact.igsid, { text: fill(fromButton.email_text || DEFAULTS.email_text, { username: contact.username }) });
        return { automation: fromButton.id };
      }
      await proceed(ctx(fromButton));
      return { automation: fromButton.id };
    }

    // 2. Une conversation en cours (on attend un email, un abonnement, ou un « oui »)
    const pend = contact.pending && byId(contact.pending.automation);
    if (pend) {
      if (contact.pending.step === "email") { await captureEmail(ctx(pend), ev.text); return { automation: pend.id }; }
      // Mot-clé d'une AUTRE automatisation pendant l'attente → on bascule dessus.
      const other = findAutomation(store, { kind: "dm", text: ev.text });
      if (other && other.id !== pend.id) {
        contact.pending = null; contact.state = null;
        bumpStat(store, other.id, "triggered");
        logs.push({ type: "déclenché (DM)", automation: other.id, text: String(ev.text || "").slice(0, 80) });
        await proceed(ctx(other));
        return { automation: other.id };
      }
      logs.push({ type: "suite", automation: pend.id, text: String(ev.text || "").slice(0, 80) });
      await proceed(ctx(pend));
      return { automation: pend.id };
    }

    // 3. Mot-clé en DM
    const a = findAutomation(store, { kind: "dm", text: ev.text });
    if (a) {
      bumpStat(store, a.id, "triggered");
      logs.push({ type: "déclenché (DM)", automation: a.id, text: String(ev.text || "").slice(0, 80) });
      await proceed(ctx(a));
      return { automation: a.id };
    }

    // 4. Rien : c'est une vraie conversation, Moos répond à la main.
    logs.push({ type: "message libre", text: String(ev.text || "").slice(0, 120) });
    return { matched: null };
  } catch (e) {
    logs.push({ type: "erreur", error: e.message });
    return { error: e.message };
  } finally {
    for (const l of logs) logIg(store, { ...l, igsid: ev.igsid, username: (contact && contact.username) || "" });
    if (!given) saveIg(store);
  }
}

// ---- Lecture du webhook Meta -----------------------------------------------------
// Transforme le corps reçu en liste d'événements { kind, ... }.
export function parseWebhook(body) {
  const events = [];
  if (!body || body.object !== "instagram") return events;
  for (const entry of body.entry || []) {
    for (const ch of entry.changes || []) {
      if (ch.field !== "comments" || !ch.value) continue;
      const v = ch.value;
      events.push({
        kind: "comment",
        commentId: v.id, text: v.text || "",
        fromId: v.from && v.from.id, username: v.from && v.from.username,
        mediaId: v.media && v.media.id,
      });
    }
    for (const m of entry.messaging || []) {
      if (m.message) {
        if (m.message.is_echo || m.message.is_deleted || m.message.is_unsupported) continue;
        events.push({
          kind: "message", igsid: m.sender && m.sender.id, mid: m.message.mid,
          text: m.message.text || "", payload: m.message.quick_reply ? m.message.quick_reply.payload : "",
        });
      } else if (m.postback) {
        events.push({ kind: "message", igsid: m.sender && m.sender.id, mid: m.postback.mid, text: m.postback.title || "", payload: m.postback.payload || "" });
      }
    }
  }
  return events;
}
