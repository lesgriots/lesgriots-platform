// Génère le fichier data.jsx du site Griothèque à partir du store JSON.
// Le backoffice vit dans apps/backoffice-griotheque/ et le site dans apps/lagriotheque/.
// Donc on remonte d'un cran (..) puis on entre dans lagriotheque/.
//
// On écrit du JS plat lisible et facile à debug. Les textes mutualisés
// (DEFAULT_METHODS, DEFAULT_EVALUATION, etc.) sont déclarés en tête,
// puis référencés par les formations/workshops via le champ correspondant
// quand il vaut null/undefined côté store.

import fs from "fs/promises";
import path from "path";
import {
  listFormations,
  listWorkshops,
  listTrainers,
  listSessions,
  listResources,
  getDefaults,
  getActivePages,
} from "./db.js";

const SITE_ROOT = path.resolve(process.cwd(), "..", "lagriotheque");
const DATA_PATH = path.join(SITE_ROOT, "data.jsx");

// Mapping des champs "fallback default" : si la valeur est null/undefined
// dans le store, on émet la constante DEFAULT_X au lieu d'un littéral.
const DEFAULT_FIELDS = {
  methods: "DEFAULT_METHODS",
  evaluation: "DEFAULT_EVALUATION",
  accessibility: "DEFAULT_ACCESSIBILITY",
  location: "DEFAULT_LOCATION",
};

// Échappe les chaînes pour les sortir en littéraux JS sûrs (JSON.stringify
// fait déjà l'échappement guillemets/backslashes/unicode).
function s(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

// Émet une valeur, mais si c'est un champ "default-aware" et que la valeur
// est null/undefined/"", on émet le nom de la constante DEFAULT_X à la place.
function emitField(key, value) {
  const defaultConst = DEFAULT_FIELDS[key];
  if (defaultConst && (value === null || value === undefined || value === "")) {
    return defaultConst;
  }
  // Arrays / objects → JSON pretty
  if (Array.isArray(value) || (value && typeof value === "object")) {
    return JSON.stringify(value, null, 2).replace(/\n/g, "\n  ");
  }
  return s(value);
}

// Formate une entité (formation, workshop, trainer, etc.) en objet JS lisible.
function formatEntity(obj, indent = "  ") {
  const lines = [];
  lines.push(`${indent}{`);
  // On met les clés dans un ordre stable et lisible (id en premier)
  const ORDERED_KEYS = [
    "id", "title", "name", "tagline", "discipline",
    "duration", "format", "location", "price", "cpf", "opco",
    "trainer", "trainer_id",
    "media",
    "overview", "description", "audience", "prerequisites",
    "objectives", "chapters", "program",
    "methods", "evaluation", "accessibility",
    "formation_id", "workshop_id",
    "date", "places", "status",
    "role", "bio", "photo",
    "type", "href", "available",
  ];
  const seen = new Set();
  const allKeys = [...ORDERED_KEYS, ...Object.keys(obj)];
  for (const k of allKeys) {
    if (seen.has(k)) continue;
    if (!(k in obj)) continue;
    // Skip metadata internal fields
    if (["position", "created_at", "updated_at"].includes(k)) continue;
    seen.add(k);
    const v = obj[k];
    lines.push(`${indent}  ${k}: ${emitField(k, v)},`);
  }
  lines.push(`${indent}},`);
  return lines.join("\n");
}

// Émet un array d'entités sous forme `const NAME = [ {...}, {...} ];`
function formatArray(name, items) {
  if (!items || items.length === 0) {
    return `const ${name} = [];\n`;
  }
  return `const ${name} = [\n${items.map((i) => formatEntity(i)).join("\n")}\n];\n`;
}

export async function exportToDataJsx() {
  const formations = listFormations();
  const workshops = listWorkshops();
  const trainers = listTrainers();
  const sessions = listSessions();
  const resources = listResources();
  const defaults = getDefaults();

  // Index des intervenants par id pour résoudre trainer_id → { name, role }
  // côté formations/workshops. Comme ça si on édite un intervenant dans la
  // page Intervenants, ça se propage à toutes les formations qui le réfèrent.
  const trainersById = Object.fromEntries(trainers.map((t) => [t.id, t]));

  function resolveTrainer(item) {
    if (item.trainer_id && trainersById[item.trainer_id]) {
      const t = trainersById[item.trainer_id];
      return { ...item, trainer: { name: t.name || "", role: t.role || "" } };
    }
    // Pas de trainer_id ou id introuvable → garde le trainer{} inline existant
    return item;
  }

  // Applique la résolution aux formations + workshops
  const formationsResolved = formations.map(resolveTrainer);
  const workshopsResolved = workshops.map(resolveTrainer);

  const header = `/* global window */
// LA GRIOTHÈQUE — formations data
// ⚠️  FICHIER GÉNÉRÉ AUTOMATIQUEMENT par backoffice-griotheque/.
// Ne pas éditer à la main — ouvre le back office (http://localhost:3031).
// Dernière génération : ${new Date().toISOString()}

`;

  // Textes mutualisés en tête (peuvent être référencés par les formations)
  const defaultsBlock = [
    `const DEFAULT_METHODS = ${s(defaults.methods || "")};`,
    `const DEFAULT_EVALUATION = ${s(defaults.evaluation || "")};`,
    `const DEFAULT_ACCESSIBILITY = ${s(defaults.accessibility || "")};`,
    `const DEFAULT_LOCATION = ${s(defaults.location || "")};`,
    "",
  ].join("\n");

  const blocks = [
    formatArray("FORMATIONS", formationsResolved),
    formatArray("WORKSHOPS", workshopsResolved),
    formatArray("TRAINERS", trainers),
    formatArray("SESSIONS", sessions),
    formatArray("RESOURCES", resources),
  ].join("\n");

  // Configuration du site : pages actives + endpoint API pour les leads
  const activePages = getActivePages();
  const configBlock = `\nconst SITE_CONFIG = ${JSON.stringify({
    activePages,
    leadsEndpoint: "http://localhost:3031/api/leads",
  }, null, 2)};\n`;

  const footer = `
if (typeof window !== "undefined") {
  window.FORMATIONS = FORMATIONS;
  window.WORKSHOPS = WORKSHOPS;
  window.TRAINERS = TRAINERS;
  window.SESSIONS = SESSIONS;
  window.RESOURCES = RESOURCES;
  window.SITE_CONFIG = SITE_CONFIG;
}
`;

  const content = header + defaultsBlock + blocks + configBlock + footer;
  await fs.writeFile(DATA_PATH, content, "utf8");
  return {
    path: DATA_PATH,
    counts: {
      formations: formations.length,
      workshops: workshops.length,
      trainers: trainers.length,
      sessions: sessions.length,
      resources: resources.length,
    },
    bytes: content.length,
  };
}
