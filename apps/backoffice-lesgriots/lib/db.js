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

const STORE_PATH = path.join(process.cwd(), "lesgriots.json");

const EMPTY = {
  mode: "coming-soon",                  // "coming-soon" (page d'attente) | "live" (site complet)
  homeVideo: { src: "", poster: "" },   // vidéo d'accueil (stage-home)
  projects: [],                         // slides stage-img — cf. seed.mjs
  about: { text: "", links: [] },       // texte + liens écosystème
  shop: [],                             // articles boutique
};

// Lit le store. Le crée vide s'il n'existe pas encore.
function load() {
  if (!fs.existsSync(STORE_PATH)) return structuredCloneSafe(EMPTY);
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return { ...structuredCloneSafe(EMPTY), ...parsed };
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
  return { text: a.text || "", links: Array.isArray(a.links) ? a.links : [] };
}

export function setAbout(about) {
  const store = load();
  const links = Array.isArray(about && about.links) ? about.links : [];
  store.about = {
    text: (about && about.text) || "",
    links: links.map((l) => ({
      label: (l && l.label) || "",
      url: (l && l.url) || "",
      img: (l && l.img) || "",
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
    url: item.url || "",
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
