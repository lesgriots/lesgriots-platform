// Stockage JSON pur — zéro dépendance native.
// Tout est dans backoffice-lesgriots/lesgriots.json. Format simple, lisible.
// Bénéfice : marche avec n'importe quelle version de Node, aucune compilation.
//
// Modèle du site ombrelle "LES GRIOTS" (apps/lesgriots) :
//   homeVideo : la vidéo d'accueil (boucle plein écran) + son poster.
//   projects  : les slides de la stage d'accueil (Florale, Indigo, …).
//   about     : texte du panneau About + liens vers les 3 sites de l'écosystème.
//   shop      : les articles de la boutique (shop-panel).
import fs from "fs";
import path from "path";
import DEFAULTS from "./defaults.json";

const STORE_PATH = path.join(process.cwd(), "lesgriots.json");

const EMPTY = {
  mode: "coming-soon",                  // "coming-soon" (page d'attente) | "live" (site complet)
  homeVideo: { src: "", poster: "" },   // vidéo d'accueil (stage-home)
  projects: [],                         // slides stage-img — cf. seed.mjs
  about: { text: "", links: [] },       // texte + liens écosystème
  shop: [],                             // articles boutique
  // Contenus du site complet — seeds extraits de site.html (lib/defaults.json)
  journal: DEFAULTS.journal,            // entrées de l'Index (date, titre, img, intro, note, galerie)
  archive: DEFAULTS.archive,            // tuiles du panneau Archive
  meta: DEFAULTS.meta,                  // <title> + meta description
  texts: DEFAULTS.texts,                // textes épars (sous-titre player, footer)
  social: DEFAULTS.social,              // liens réseaux (instagram)
};

// Lit le store. Le crée vide s'il n'existe pas encore.
function load() {
  if (!fs.existsSync(STORE_PATH)) return structuredCloneSafe(EMPTY);
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const merged = { ...structuredCloneSafe(EMPTY), ...parsed };
    // Migration v2 (site complet) : au premier chargement d'un store d'avant
    // les seeds, on remplit shop/about.text s'ils sont vides.
    if (!("journal" in parsed)) {
      if (!parsed.shop || !parsed.shop.length) merged.shop = structuredCloneSafe(DEFAULTS.shop);
      if (parsed.about && !parsed.about.text) merged.about = { ...parsed.about, text: DEFAULTS.aboutText };
    }
    return merged;
  } catch (e) {
    console.error("lesgriots.json corrompu :", e.message);
    return structuredCloneSafe(EMPTY);
  }
}

// Clone défensif de la structure vide (évite les références partagées).
function structuredCloneSafe(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Écrit le store de façon atomique (tempfile + rename) pour pas le corrompre.
function save(store) {
  const tmp = STORE_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, STORE_PATH);
}

// ---- Mode du site (coming-soon / live) ---------------------------------
export function getMode() {
  const store = load();
  return store.mode === "live" ? "live" : "coming-soon";
}

export function setMode(mode) {
  const store = load();
  store.mode = mode === "live" ? "live" : "coming-soon";
  save(store);
  return store.mode;
}

// ---- Home video --------------------------------------------------------
export function getHomeVideo() {
  const store = load();
  return store.homeVideo || { src: "", poster: "" };
}

export function setHomeVideo(video) {
  const store = load();
  store.homeVideo = {
    src: (video && video.src) || "",
    poster: (video && video.poster) || "",
  };
  save(store);
  return store.homeVideo;
}

// ---- Projects (slides de la stage d'accueil) ---------------------------
export function listProjects({ excludeHidden = false, sort = true } = {}) {
  const store = load();
  let arr = store.projects || [];
  if (excludeHidden) arr = arr.filter((p) => !p.hidden);
  if (sort) {
    arr = [...arr].sort((a, b) => {
      const pa = a.position ?? 0;
      const pb = b.position ?? 0;
      if (pa !== pb) return pa - pb;
      return (a.name || "").localeCompare(b.name || "");
    });
  }
  return arr;
}

export function getProject(id) {
  const store = load();
  return (store.projects || []).find((p) => p.id === id) || null;
}

// Crée ou remplace un projet (matching par id). Renvoie le projet sauvé.
export function upsertProject(p) {
  if (!p || !p.id) throw new Error("upsertProject: id required");
  const store = load();
  const arr = store.projects || [];
  const i = arr.findIndex((x) => x.id === p.id);
  const now = new Date().toISOString();
  const next = {
    id: p.id,
    key: p.key || p.id,
    name: p.name || "",
    media: p.media || "",
    poster: p.poster || "",
    type: p.type === "video" ? "video" : "image",
    position: Number(p.position) || 0,
    hidden: !!p.hidden,
    updated_at: now,
    created_at: (i >= 0 ? arr[i].created_at : null) || now,
  };
  if (i >= 0) arr[i] = next;
  else arr.push(next);
  store.projects = arr;
  save(store);
  return next;
}

export function deleteProject(id) {
  const store = load();
  const before = (store.projects || []).length;
  store.projects = (store.projects || []).filter((p) => p.id !== id);
  save(store);
  return before - store.projects.length;
}

// ---- About (texte + liens écosystème) ----------------------------------
export function getAbout() {
  const store = load();
  const a = store.about || {};
  return { text: a.text || "", text_en: a.text_en || "", links: Array.isArray(a.links) ? a.links : [] };
}

export function setAbout(about) {
  const store = load();
  const links = Array.isArray(about && about.links) ? about.links : [];
  store.about = {
    text: (about && about.text) || "",
    text_en: (about && about.text_en) || "",
    links: links.map((l) => ({
      label: (l && l.label) || "",
      url: (l && l.url) || "",
      img: (l && l.img) || "",
      title: (l && l.title) || "",
      desc: (l && l.desc) || "",
    })),
  };
  save(store);
  return store.about;
}

// ---- Shop (articles boutique) ------------------------------------------
export function listShop({ excludeHidden = false, sort = true } = {}) {
  const store = load();
  let arr = store.shop || [];
  if (excludeHidden) arr = arr.filter((s) => !s.hidden);
  if (sort) {
    arr = [...arr].sort((a, b) => {
      const pa = a.position ?? 0;
      const pb = b.position ?? 0;
      if (pa !== pb) return pa - pb;
      return (a.name || "").localeCompare(b.name || "");
    });
  }
  return arr;
}

export function getShopItem(id) {
  const store = load();
  return (store.shop || []).find((s) => s.id === id) || null;
}

// Crée ou remplace un article (matching par id). Renvoie l'article sauvé.
export function upsertShopItem(item) {
  if (!item || !item.id) throw new Error("upsertShopItem: id required");
  const store = load();
  const arr = store.shop || [];
  const i = arr.findIndex((x) => x.id === item.id);
  const next = {
    id: item.id,
    name: item.name || "",
    price: item.price || "",
    img: item.img || "",
    gallery: Array.isArray(item.gallery) ? item.gallery.filter(Boolean) : [],
    url: item.url || "",
    desc: item.desc || "",
    position: Number(item.position) || 0,
    hidden: !!item.hidden,
  };
  if (i >= 0) arr[i] = next;
  else arr.push(next);
  store.shop = arr;
  save(store);
  return next;
}

export function deleteShopItem(id) {
  const store = load();
  const before = (store.shop || []).length;
  store.shop = (store.shop || []).filter((s) => s.id !== id);
  save(store);
  return before - store.shop.length;
}


// ---- Générique : collections triées (journal, archive) -----------------
function listCollection(key, { excludeHidden = false } = {}) {
  const store = load();
  let arr = store[key] || [];
  if (excludeHidden) arr = arr.filter((x) => !x.hidden);
  return [...arr].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

function upsertIn(key, shape, item) {
  if (!item || !item.id) throw new Error(`upsert ${key}: id required`);
  const store = load();
  const arr = store[key] || [];
  const i = arr.findIndex((x) => x.id === item.id);
  const next = shape(item, i >= 0 ? arr[i] : null);
  if (i >= 0) arr[i] = next;
  else arr.push(next);
  store[key] = arr;
  save(store);
  return next;
}

function deleteIn(key, id) {
  const store = load();
  const before = (store[key] || []).length;
  store[key] = (store[key] || []).filter((x) => x.id !== id);
  save(store);
  return before - store[key].length;
}

// ---- Journal (entrées de l'Index) ---------------------------------------
export function listJournal(opts) { return listCollection("journal", opts); }
export function getJournalItem(id) { return (load().journal || []).find((x) => x.id === id) || null; }
export function upsertJournalItem(item) {
  return upsertIn("journal", (p) => ({
    id: p.id,
    date: p.date || "x",
    title: p.title || "",
    img: p.img || "",
    hero: p.hero || "",
    intro: p.intro || "",
    note: p.note || "",
    gallery: Array.isArray(p.gallery) ? p.gallery.filter(Boolean) : [],
    position: Number(p.position) || 0,
    hidden: !!p.hidden,
  }), item);
}
export function deleteJournalItem(id) { return deleteIn("journal", id); }

// ---- Archive (tuiles) ----------------------------------------------------
export function listArchive(opts) { return listCollection("archive", opts); }
export function getArchiveItem(id) { return (load().archive || []).find((x) => x.id === id) || null; }
export function upsertArchiveItem(item) {
  return upsertIn("archive", (p) => ({
    id: p.id,
    title: p.title || "",
    img: p.img || "",
    url: p.url || "",
    position: Number(p.position) || 0,
    hidden: !!p.hidden,
  }), item);
}
export function deleteArchiveItem(id) { return deleteIn("archive", id); }

// ---- Méta + textes + réseaux --------------------------------------------
export function getSiteTexts() {
  const store = load();
  return {
    meta: { ...EMPTY.meta, ...(store.meta || {}) },
    texts: { ...EMPTY.texts, ...(store.texts || {}) },
    social: { ...EMPTY.social, ...(store.social || {}) },
  };
}

export function setSiteTexts({ meta, texts, social }) {
  const store = load();
  if (meta) store.meta = { title: meta.title || "", description: meta.description || "" };
  if (texts) store.texts = { playerSub: texts.playerSub || "", footer: texts.footer || "" };
  if (social) store.social = { instagram: social.instagram || "" };
  save(store);
  return getSiteTexts();
}
