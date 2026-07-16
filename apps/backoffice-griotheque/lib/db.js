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
import { validateEntity } from "./validate.js";

const STORE_PATH = path.join(process.cwd(), "griotheque.json");

// Pages du site lagriotheque qu'on peut activer/désactiver depuis le backoffice.
// true = visible dans le menu et accessible ; false = masquée du menu (URL bloquée).
const DEFAULT_ACTIVE_PAGES = {
  // Page de lancement "Bientôt" (capture email). Sémantique INVERSE des autres :
  // launch:true = le site entier est masqué et remplacé par la page de capture.
  // Désactivé par défaut (false) pour que le site normal s'affiche.
  launch: false,
  home: true,
  approche: true,
  formations: true,
  workshops: true,
  agenda: true,
  events: true,
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
  events: [],         // événements IRL (masterclasses, talks, soirées, projections)
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
//
// SÉCURITÉ DONNÉES : si le fichier EXISTE mais est corrompu, on THROW au lieu
// de retourner un store vide. Ancien comportement = retour vide silencieux →
// la sauvegarde suivante écrasait toutes les données. Maintenant : le fichier
// corrompu est mis en quarantaine (copie horodatée) et l'API renvoie une
// erreur claire. Les données restent récupérables depuis backups/.
function load() {
  if (!fs.existsSync(STORE_PATH)) return { ...EMPTY, defaults: { ...EMPTY.defaults } };
  const raw = fs.readFileSync(STORE_PATH, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const quarantine = `${STORE_PATH}.corrupted-${Date.now()}`;
    try { fs.copyFileSync(STORE_PATH, quarantine); } catch { /* best effort */ }
    console.error(`griotheque.json corrompu (copie: ${quarantine}) :`, e.message);
    throw new Error(
      "griotheque.json est corrompu. Aucune écriture possible pour protéger les données. " +
      "Restaurer depuis backups/ ou réparer le JSON."
    );
  }
  // Merge avec EMPTY pour garantir que toutes les collections existent
  return {
    ...EMPTY,
    ...parsed,
    defaults: { ...EMPTY.defaults, ...(parsed.defaults || {}) },
  };
}

// --- Backups rotatifs -------------------------------------------------------
// À chaque écriture, on copie l'état ACTUEL dans backups/ avant de le
// remplacer. On garde les MAX_BACKUPS plus récents. Skip si identique au
// dernier backup (évite d'empiler des copies pendant une session d'édition).
const BACKUP_DIR = path.join(process.cwd(), "backups");
const MAX_BACKUPS = 30;

function backupCurrent() {
  if (!fs.existsSync(STORE_PATH)) return;
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const current = fs.readFileSync(STORE_PATH, "utf8");
    const existing = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("griotheque-") && f.endsWith(".json"))
      .sort(); // timestamps ISO → tri lexicographique = tri chronologique
    const latest = existing[existing.length - 1];
    if (latest && fs.readFileSync(path.join(BACKUP_DIR, latest), "utf8") === current) {
      return; // rien n'a changé depuis le dernier backup
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.writeFileSync(path.join(BACKUP_DIR, `griotheque-${stamp}.json`), current, "utf8");
    // Rotation : supprime les plus anciens au-delà de MAX_BACKUPS
    const all = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("griotheque-") && f.endsWith(".json"))
      .sort();
    for (const f of all.slice(0, Math.max(0, all.length - MAX_BACKUPS))) {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
    }
  } catch (e) {
    // Un backup raté ne doit pas bloquer la sauvegarde elle-même
    console.error("backup griotheque.json échoué :", e.message);
  }
}

// Écrit le store de façon atomique (tempfile + rename) pour pas le corrompre.
function save(store) {
  backupCurrent();
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
  // Validation centralisée : tout écriture (routes API, scripts seed) passe
  // ici — un payload malformé est rejeté avant de toucher le store.
  const invalid = validateEntity(name, item);
  if (invalid) throw new Error(`${name}: ${invalid}`);
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

// EVENTS (événements IRL : masterclasses, talks, soirées, projections)
export const listEvents = (opts) => listCollection("events", opts);
export const getEvent = (id) => getInCollection("events", id);
export const upsertEvent = (e) => upsertInCollection("events", e);
export const deleteEvent = (id) => deleteFromCollection("events", id);

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

const MAX_LEADS = 10000; // garde-fou anti-spam : évite un JSON qui explose

export function addLead({ email, name, phone, resource_id, consent, source }) {
  if (!email) throw new Error("addLead: email required");
  const store = load();
  const normalized = String(email).trim().toLowerCase();
  // Dédoublonnage : même email + même contexte (ressource/source) = on
  // retourne le lead existant au lieu d'empiler des doublons.
  const existing = (store.leads || []).find(
    (l) =>
      l.email === normalized &&
      (l.resource_id || "") === (resource_id || "") &&
      (l.source || "site") === (source || "site")
  );
  if (existing) return existing;
  if ((store.leads || []).length >= MAX_LEADS) {
    throw new Error("addLead: limite de leads atteinte");
  }
  const id = `lead-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const lead = {
    id,
    email: String(email).trim().toLowerCase(),
    name: name ? String(name).trim().slice(0, 120) : "",
    phone: phone ? String(phone).trim().slice(0, 30) : "",
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
