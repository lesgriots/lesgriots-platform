// Stockage JSON pur — zéro dépendance native.
// Tout est dans backoffice-griotheque/griotheque.json. Format simple, humainement lisible.
// Bénéfice : marche avec n'importe quelle version de Node, aucune compilation.
//
// Modèle de données :
//   - formations[]   : formations longues (3+ jours)
//   - workshops[]    : formats courts
//   - trainers[]     : intervenants (référencés par formations.trainer_id)
//   - sessions[]     : dates concrètes liées à une formation ou un workshop
//   - resources[]    : ressources téléchargeables (PDF, articles, outils)
//   - defaults       : textes mutualisés (méthodes, éval, accessibilité, lieu)

import fs from "fs";
import path from "path";

const STORE_PATH = path.join(process.cwd(), "griotheque.json");

// Pages du site lagriotheque qu'on peut activer/désactiver depuis le backoffice.
// true = visible dans le menu et accessible ; false = masquée du menu (URL bloquée).
const DEFAULT_ACTIVE_PAGES = {
  home: true,
  approche: true,
  formations: true,
  workshops: true,
  agenda: true,
  financement: true,
  ressources: true,
  cgv: true,
  contact: true,
};

const EMPTY = {
  formations: [],
  workshops: [],
  trainers: [],
  sessions: [],
  resources: [],
  leads: [],          // emails capturés via le lead-gate des ressources
  active_pages: { ...DEFAULT_ACTIVE_PAGES },
  defaults: {
    methods: "",
    evaluation: "",
    accessibility: "",
    location: "",
  },
};

// Lit le store. Le crée vide s'il n'existe pas encore.
function load() {
  if (!fs.existsSync(STORE_PATH)) return { ...EMPTY, defaults: { ...EMPTY.defaults } };
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    // Merge avec EMPTY pour garantir que toutes les collections existent
    return {
      ...EMPTY,
      ...parsed,
      defaults: { ...EMPTY.defaults, ...(parsed.defaults || {}) },
    };
  } catch (e) {
    console.error("griotheque.json corrompu :", e.message);
    return { ...EMPTY, defaults: { ...EMPTY.defaults } };
  }
}

// Écrit le store de façon atomique (tempfile + rename) pour pas le corrompre.
function save(store) {
  const tmp = STORE_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, STORE_PATH);
}

// ---- Générique : CRUD sur une collection ------------------------------
// Toutes les entités (formations, workshops, trainers, sessions, resources)
// suivent le même pattern : array d'objets avec un `id`. On factorise.

function listCollection(name, { sort = true } = {}) {
  const store = load();
  let arr = store[name] || [];
  if (sort) {
    arr = [...arr].sort((a, b) => {
      const pa = a.position ?? 0;
      const pb = b.position ?? 0;
      if (pa !== pb) return pa - pb;
      return (a.title || a.name || a.id || "").localeCompare(b.title || b.name || b.id || "");
    });
  }
  return arr;
}

function getInCollection(name, id) {
  const store = load();
  return (store[name] || []).find((x) => x.id === id) || null;
}

function upsertInCollection(name, item) {
  if (!item || !item.id) throw new Error(`upsert ${name}: id required`);
  const store = load();
  const arr = store[name] || [];
  const i = arr.findIndex((x) => x.id === item.id);
  const now = new Date().toISOString();
  const next = {
    ...item,
    position: Number(item.position) || 0,
    updated_at: now,
    created_at: (i >= 0 ? arr[i].created_at : null) || now,
  };
  if (i >= 0) arr[i] = next;
  else arr.push(next);
  store[name] = arr;
  save(store);
  return next;
}

function deleteFromCollection(name, id) {
  const store = load();
  const before = (store[name] || []).length;
  store[name] = (store[name] || []).filter((x) => x.id !== id);
  save(store);
  return before - store[name].length;
}

// ---- API nommée par entité (lisibilité pour les callers) -----------------

// FORMATIONS
export const listFormations = (opts) => listCollection("formations", opts);
export const getFormation = (id) => getInCollection("formations", id);
export const upsertFormation = (f) => upsertInCollection("formations", f);
export const deleteFormation = (id) => deleteFromCollection("formations", id);

// WORKSHOPS
export const listWorkshops = (opts) => listCollection("workshops", opts);
export const getWorkshop = (id) => getInCollection("workshops", id);
export const upsertWorkshop = (w) => upsertInCollection("workshops", w);
export const deleteWorkshop = (id) => deleteFromCollection("workshops", id);

// TRAINERS
export const listTrainers = (opts) => listCollection("trainers", opts);
export const getTrainer = (id) => getInCollection("trainers", id);
export const upsertTrainer = (t) => upsertInCollection("trainers", t);
export const deleteTrainer = (id) => deleteFromCollection("trainers", id);

// SESSIONS
export const listSessions = (opts) => listCollection("sessions", opts);
export const getSession = (id) => getInCollection("sessions", id);
export const upsertSession = (s) => upsertInCollection("sessions", s);
export const deleteSession = (id) => deleteFromCollection("sessions", id);

// RESOURCES
export const listResources = (opts) => listCollection("resources", opts);
export const getResource = (id) => getInCollection("resources", id);
export const upsertResource = (r) => upsertInCollection("resources", r);
export const deleteResource = (id) => deleteFromCollection("resources", id);

// LEADS (emails capturés via lead-gate des ressources)
// Spécifique : append-only en pratique, id auto-généré, tri par date desc
export function listLeads({ sort = true } = {}) {
  const store = load();
  let arr = store.leads || [];
  if (sort) {
    arr = [...arr].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }
  return arr;
}

export function addLead({ email, name, resource_id, consent, source }) {
  if (!email) throw new Error("addLead: email required");
  const store = load();
  const id = `lead-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const lead = {
    id,
    email: String(email).trim().toLowerCase(),
    name: name ? String(name).trim() : "",
    resource_id: resource_id || "",
    consent: !!consent,
    source: source || "site",
    created_at: new Date().toISOString(),
  };
  store.leads = [...(store.leads || []), lead];
  save(store);
  return lead;
}

export function deleteLead(id) {
  const store = load();
  const before = (store.leads || []).length;
  store.leads = (store.leads || []).filter((l) => l.id !== id);
  save(store);
  return before - store.leads.length;
}

// ---- Legacy stubs (compat ancien backoffice studio) ----------------------
// Ces fonctions sont importées par les vieilles routes app/api/projects/ et
// app/api/site/ qu'on n'a pas pu supprimer (permissions). On les neutralise
// pour que le build Next.js ne casse pas. Elles ne sont jamais appelées en
// pratique côté backoffice griothèque.
export const listProjects = () => [];
export const getProject = () => null;
export const upsertProject = () => { throw new Error("legacy: use upsertFormation"); };
export const deleteProject = () => 0;
export const rowToProject = (p) => p;
export const projectToRow = (p) => p;
export const getDb = () => ({});

// ---- SITE CONTENT (textes marketing éditables du site lagriotheque) ------
// Stocké sous `site_content` dans griotheque.json, organisé en sections
// imbriquées : { home: { manifesto, tagline... }, approche: {...}, ... }.
// Voir lib/site-content-defaults.js pour le schéma complet.
//
// Pattern : on retourne TOUJOURS un objet complet (defaults mergés avec les
// overrides utilisateur) pour que les consumers (UI BO + exporter) n'aient
// jamais à se soucier des clés manquantes.

import {
  SITE_CONTENT_DEFAULTS,
  mergeSiteContent,
} from "./site-content-defaults.js";

export function getSiteContent() {
  const store = load();
  return mergeSiteContent(store.site_content);
}

// Remplace TOUT le bloc site_content (rare — utilisé pour reset).
export function setSiteContent(next) {
  const store = load();
  store.site_content = next || {};
  save(store);
  return getSiteContent();
}

// Patch partiel : { home: { manifesto: "..." } } met à jour juste cette clé,
// sans toucher au reste. C'est le mode normal utilisé par la page d'admin.
export function patchSiteContent(partial) {
  if (!partial || typeof partial !== "object") return getSiteContent();
  const store = load();
  const current = store.site_content || {};
  for (const section of Object.keys(partial)) {
    current[section] = {
      ...(current[section] || {}),
      ...(partial[section] || {}),
    };
  }
  store.site_content = current;
  save(store);
  return getSiteContent();
}

// Compat : ces 3 noms étaient des stubs avant. On les garde pour ne casser
// aucun import existant, mais ils pointent maintenant vers le vrai contenu.
export const getContent = (section) => {
  const all = getSiteContent();
  return section ? all[section] : all;
};
export const setContent = (section, values) => {
  if (!section) return setSiteContent(values);
  return patchSiteContent({ [section]: values });
};
export const listContent = () => Object.keys(SITE_CONTENT_DEFAULTS);

// ACTIVE PAGES (toggles des pages du site lagriotheque)
export function getActivePages() {
  const store = load();
  return { ...EMPTY.active_pages, ...(store.active_pages || {}) };
}

export function setActivePages(partial) {
  const store = load();
  store.active_pages = { ...EMPTY.active_pages, ...(store.active_pages || {}), ...partial };
  save(store);
  return store.active_pages;
}

// DEFAULTS (textes mutualisés)
export function getDefaults() {
  const store = load();
  return { ...EMPTY.defaults, ...(store.defaults || {}) };
}

export function setDefaults(partial) {
  const store = load();
  store.defaults = { ...EMPTY.defaults, ...(store.defaults || {}), ...partial };
  save(store);
  return store.defaults;
}
