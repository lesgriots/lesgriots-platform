// Stockage JSON pur — zéro dépendance native.
// Tout est dans backoffice/studio.json. Format simple, humainement lisible.
// Bénéfice : marche avec n'importe quelle version de Node, aucune compilation.
import fs from "fs";
import path from "path";

const STORE_PATH = path.join(process.cwd(), "studio.json");

const EMPTY = {
  projects: [],          // Array d'objets projet (cf. rowToProject)
  site_content: {},      // Key → JSON
};

// Lit le store. Le crée vide s'il n'existe pas encore.
function load() {
  if (!fs.existsSync(STORE_PATH)) return { ...EMPTY };
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return { ...EMPTY, ...parsed };
  } catch (e) {
    console.error("studio.json corrompu :", e.message);
    return { ...EMPTY };
  }
}

// Écrit le store de façon atomique (tempfile + rename) pour pas le corrompre.
function save(store) {
  const tmp = STORE_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, STORE_PATH);
}

// ---- Helpers de compat (API inchangée pour les callers) ---------------
export function getDb() {
  // Vestige de l'ancienne API SQLite — on garde la signature mais on retourne
  // un objet vide. Les nouveaux callers utilisent listProjects/upsertProject.
  return {};
}
export function rowToProject(p) { return p ? { ...p, hidden: !!p.hidden } : null; }
export function projectToRow(p) { return p; }

// ---- Projects ----------------------------------------------------------
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
    ...p,
    hidden: !!p.hidden,
    position: Number(p.position) || 0,
    strip: p.strip || [],
    resources: p.resources || [],
    credits: p.credits || {},
    tags: p.tags || [],
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

// ---- Site content (intro About, etc.) ---------------------------------
export function getContent(key, fallback = null) {
  const store = load();
  const v = (store.site_content || {})[key];
  return v === undefined ? fallback : v;
}

export function setContent(key, value) {
  const store = load();
  if (!store.site_content) store.site_content = {};
  store.site_content[key] = value;
  save(store);
}

export function listContent() {
  const store = load();
  return Object.entries(store.site_content || {}).map(([key, value]) => ({
    key, value,
  }));
}
