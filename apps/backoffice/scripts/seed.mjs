// Importe les projets existants depuis ../data.jsx dans studio.json.
// Usage : node scripts/seed.mjs
// Exécute une seule fois pour bootstrap la base. Idempotent (replace par id).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { upsertProject, setContent, getContent } from "../lib/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Le seed lit depuis apps/lesgriotsxstudio/ (le site studio est notre source de vérité initiale).
const DATA_PATH = path.resolve(__dirname, "..", "..", "lesgriotsxstudio", "data.jsx");
const I18N_PATH = path.resolve(__dirname, "..", "..", "lesgriotsxstudio", "i18n.jsx");

async function main() {
  const src = fs.readFileSync(DATA_PATH, "utf8");
  // On évalue data.jsx en tant que module CJS via Function.
  // Le fichier expose `const PROJECTS = [...]` puis assigne à window.PROJECTS.
  const sandbox = { window: {} };
  const code = `${src}; module.exports = window.PROJECTS;`;
  const m = { exports: null };
  // eslint-disable-next-line no-new-func
  new Function("module", "window", code)(m, sandbox.window);
  const projects = m.exports;
  if (!Array.isArray(projects)) {
    console.error("Pas de PROJECTS trouvé dans data.jsx");
    process.exit(1);
  }

  let count = 0;
  projects.forEach((p, i) => {
    upsertProject({ ...p, position: i });
    count++;
  });
  console.log(`✓ Importé ${count} projets dans studio.json`);

  // ---- Seed du contenu éditorial (about.intro FR + EN) depuis i18n.jsx ----
  if (getContent("aboutIntro") == null && fs.existsSync(I18N_PATH)) {
    const i18nSrc = fs.readFileSync(I18N_PATH, "utf8");
    const match = i18nSrc.match(/"about\.intro"\s*:\s*\{\s*en\s*:\s*\[([\s\S]*?)\]\s*,\s*fr\s*:\s*\[([\s\S]*?)\]\s*,?\s*\}/);
    if (match) {
      const parseArr = (raw) =>
        raw.split(/",\s*"/)
          .map((s) => s.replace(/^[\s\n"]+|[\s\n",]+$/g, "").trim())
          .filter(Boolean);
      const en = parseArr(match[1]);
      const fr = parseArr(match[2]);
      setContent("aboutIntro", { en, fr });
      console.log(`✓ Importé about.intro (${en.length} parag. EN / ${fr.length} parag. FR) depuis i18n.jsx`);
    } else {
      console.warn("⚠  Impossible de parser about.intro depuis i18n.jsx — passe en édition vide.");
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
