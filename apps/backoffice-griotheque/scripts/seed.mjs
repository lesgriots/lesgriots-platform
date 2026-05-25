// Importe les données existantes depuis apps/lagriotheque/data.jsx
// vers griotheque.json (la base du backoffice).
//
// Usage : npm run seed (ou node scripts/seed.mjs)
//
// Idempotent : ré-exécuter écrase les entrées avec le même id.
// Détecte les références aux DEFAULT_* dans les formations/workshops et
// les stocke comme `null` pour que les futurs changements de DEFAULTS
// s'appliquent automatiquement.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  upsertFormation,
  upsertWorkshop,
  upsertTrainer,
  upsertSession,
  upsertResource,
  setDefaults,
} from "../lib/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Le site Griothèque est dans apps/lagriotheque/data.jsx
const DATA_PATH = path.resolve(__dirname, "..", "..", "lagriotheque", "data.jsx");

// Champs qui peuvent utiliser un DEFAULT_X — on les remplacera par null
// si leur valeur égale le default, pour que les futurs changements de
// defaults propagent automatiquement.
const DEFAULT_AWARE_FIELDS = ["methods", "evaluation", "accessibility", "location"];

async function main() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error("✗ Fichier introuvable :", DATA_PATH);
    process.exit(1);
  }

  // Lit le data.jsx du site et l'évalue dans un sandbox.
  // Le fichier déclare des const FORMATIONS, WORKSHOPS, etc. puis assigne
  // à window.FORMATIONS = FORMATIONS, etc. On simule un window.
  const src = fs.readFileSync(DATA_PATH, "utf8");

  const sandbox = { window: {} };
  // On wrap le code dans une fonction qui reçoit `window` en argument.
  // Les DEFAULT_* déclarés dans le fichier seront évalués et leur valeur
  // sera injectée littéralement dans les formations qui les référencent.
  const wrapper = new Function("window", `
    ${src}
    return {
      FORMATIONS: typeof FORMATIONS !== "undefined" ? FORMATIONS : [],
      WORKSHOPS: typeof WORKSHOPS !== "undefined" ? WORKSHOPS : [],
      TRAINERS: typeof TRAINERS !== "undefined" ? TRAINERS : [],
      SESSIONS: typeof SESSIONS !== "undefined" ? SESSIONS : [],
      RESOURCES: typeof RESOURCES !== "undefined" ? RESOURCES : [],
      DEFAULT_METHODS: typeof DEFAULT_METHODS !== "undefined" ? DEFAULT_METHODS : "",
      DEFAULT_EVALUATION: typeof DEFAULT_EVALUATION !== "undefined" ? DEFAULT_EVALUATION : "",
      DEFAULT_ACCESSIBILITY: typeof DEFAULT_ACCESSIBILITY !== "undefined" ? DEFAULT_ACCESSIBILITY : "",
      DEFAULT_LOCATION: typeof DEFAULT_LOCATION !== "undefined" ? DEFAULT_LOCATION : "",
    };
  `);

  let extracted;
  try {
    extracted = wrapper(sandbox.window);
  } catch (e) {
    console.error("✗ Impossible d'évaluer data.jsx :", e.message);
    process.exit(1);
  }

  const {
    FORMATIONS, WORKSHOPS, TRAINERS, SESSIONS, RESOURCES,
    DEFAULT_METHODS, DEFAULT_EVALUATION, DEFAULT_ACCESSIBILITY, DEFAULT_LOCATION,
  } = extracted;

  // 1. Stocke les 4 textes mutualisés dans griotheque.json
  console.log("→ Importation des textes par défaut...");
  setDefaults({
    methods: DEFAULT_METHODS || "",
    evaluation: DEFAULT_EVALUATION || "",
    accessibility: DEFAULT_ACCESSIBILITY || "",
    location: DEFAULT_LOCATION || "",
  });
  console.log("  ✓ defaults sauvegardés");

  const defaultsMap = {
    methods: DEFAULT_METHODS || "",
    evaluation: DEFAULT_EVALUATION || "",
    accessibility: DEFAULT_ACCESSIBILITY || "",
    location: DEFAULT_LOCATION || "",
  };

  // Pour chaque entité : on détecte les champs qui correspondent à un default
  // et on les remplace par null (pour qu'ils utilisent le default au prochain export)
  function normalizeDefaults(item) {
    const out = { ...item };
    for (const field of DEFAULT_AWARE_FIELDS) {
      if (out[field] !== undefined && out[field] === defaultsMap[field]) {
        out[field] = null;
      }
    }
    return out;
  }

  // 2. Formations
  console.log(`→ Importation de ${FORMATIONS.length} formation(s)...`);
  for (const [i, f] of FORMATIONS.entries()) {
    if (!f.id) {
      console.warn(`  ⚠ formation #${i} sans id, skip`);
      continue;
    }
    upsertFormation({ ...normalizeDefaults(f), position: i });
    console.log(`  ✓ ${f.id} (${f.title || "—"})`);
  }

  // 3. Workshops
  console.log(`→ Importation de ${WORKSHOPS.length} workshop(s)...`);
  for (const [i, w] of WORKSHOPS.entries()) {
    if (!w.id) {
      console.warn(`  ⚠ workshop #${i} sans id, skip`);
      continue;
    }
    upsertWorkshop({ ...normalizeDefaults(w), position: i });
    console.log(`  ✓ ${w.id} (${w.title || "—"})`);
  }

  // 4. Trainers
  console.log(`→ Importation de ${TRAINERS.length} intervenant(s)...`);
  for (const [i, t] of TRAINERS.entries()) {
    if (!t.id) {
      console.warn(`  ⚠ trainer #${i} sans id, skip`);
      continue;
    }
    upsertTrainer({ ...t, position: i });
    console.log(`  ✓ ${t.id} (${t.name || "—"})`);
  }

  // 5. Sessions
  console.log(`→ Importation de ${SESSIONS.length} session(s)...`);
  for (const [i, s] of SESSIONS.entries()) {
    if (!s.id) {
      console.warn(`  ⚠ session #${i} sans id, skip`);
      continue;
    }
    upsertSession({ ...s, position: i });
    console.log(`  ✓ ${s.id}`);
  }

  // 6. Resources
  console.log(`→ Importation de ${RESOURCES.length} ressource(s)...`);
  for (const [i, r] of RESOURCES.entries()) {
    if (!r.id) {
      console.warn(`  ⚠ resource #${i} sans id, skip`);
      continue;
    }
    upsertResource({ ...r, position: i });
    console.log(`  ✓ ${r.id} (${r.title || "—"})`);
  }

  console.log("\n✅ Seed terminé. Recharge http://localhost:3031 pour voir les données.");
}

main().catch((e) => {
  console.error("✗ Erreur :", e);
  process.exit(1);
});
