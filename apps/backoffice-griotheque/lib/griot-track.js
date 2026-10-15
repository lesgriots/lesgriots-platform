// Suivi des liens Griot DM : chaque lien envoyé en DM passe par une adresse
// courte (https://admin.lagriotheque.com/api/instagram/go/<jeton>) qui compte
// le clic puis redirige. Vers lagriotheque.com, le jeton suit dans l'URL
// (?ig=<jeton>) ; le site le garde le temps de la visite et le joint à toute
// inscription envoyée à /api/leads. Le BO sait alors QUI s'est inscrit après
// QUEL DM — plus de déduction à l'heure près.
//
// Toutes les fonctions qui prennent `store` modifient l'objet fourni (celui que
// le moteur sauvera) ; celles qui n'en prennent pas font leur propre écriture.

import crypto from "crypto";
import { loadIg, mutateIg, bumpStat, logIg } from "./instagram-store.js";

export const GO_BASE = () => process.env.IG_GO_BASE || "https://admin.lagriotheque.com/api/instagram/go";
const MAX_LINKS = 5000;

export function createLink(store, { igsid, username, automation, url }) {
  store.links = store.links || {};
  const token = crypto.randomBytes(5).toString("hex");
  store.links[token] = { igsid, username: username || "", automation, url, at: new Date().toISOString(), clicks: 0, converted: null };
  const keys = Object.keys(store.links);
  if (keys.length > MAX_LINKS) {
    keys.sort((a, b) => String(store.links[a].at).localeCompare(String(store.links[b].at)));
    for (const k of keys.slice(0, keys.length - MAX_LINKS)) delete store.links[k];
  }
  return token;
}

export const trackedUrl = (token) => `${GO_BASE()}/${token}`;

// Redirection : ajoute ?ig=<jeton> seulement vers nos propres sites.
export function destination(link, token) {
  try {
    const u = new URL(link.url);
    if (/(^|\.)lagriotheque\.com$/i.test(u.hostname) || /(^|\.)lesgriots(xstudio)?\.com$/i.test(u.hostname)) {
      u.searchParams.set("ig", token);
    }
    return u.toString();
  } catch { return link.url; }
}

export function recordClick(token) {
  return mutateIg((s) => {
    const l = s.links && s.links[token];
    if (!l) return null;
    l.clicks = (l.clicks || 0) + 1;
    if (l.clicks === 1) {
      l.first_click_at = new Date().toISOString();
      bumpStat(s, l.automation, "clicks");
      logIg(s, { type: "lien ouvert", automation: l.automation, igsid: l.igsid, username: l.username });
    }
    return l;
  });
}

// Appelé par /api/leads quand une inscription arrive avec ?ig=<jeton>.
export function markConversion(token, lead) {
  if (!token || !/^[a-f0-9]{10}$/.test(String(token))) return null;
  return mutateIg((s) => {
    const l = s.links && s.links[token];
    if (!l || l.converted) return l || null;
    l.converted = { at: new Date().toISOString(), source: lead.source || "", email: lead.email || "" };
    bumpStat(s, l.automation, "converted");
    const c = (s.contacts || []).find((x) => x.igsid === l.igsid);
    if (c) {
      if (!c.email && lead.email) c.email = String(lead.email).toLowerCase();
      c.conversions = [...(c.conversions || []), { automation: l.automation, source: lead.source || "", at: l.converted.at }].slice(-20);
    }
    // Relances en attente pour ce lien : inutiles désormais.
    for (const f of s.followups || []) if (f.token === token && !f.done) { f.done = true; f.result = "inscrit"; }
    logIg(s, { type: "inscrit", automation: l.automation, igsid: l.igsid, username: l.username, text: lead.source || "" });
    return l;
  });
}

export function linkStats() {
  const s = loadIg();
  return s.links || {};
}
