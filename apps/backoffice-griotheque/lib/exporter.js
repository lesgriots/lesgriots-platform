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
  getSiteContent,
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

  // Contenu marketing éditable (manifeste, approche, FAQ, headers de page).
  // Lu côté site via le helper text("home.manifesto", fallback).
  const siteContent = getSiteContent();
  const contentBlock = `\nconst SITE_CONTENT = ${JSON.stringify(siteContent, null, 2)};\n`;

  const footer = `
if (typeof window !== "undefined") {
  window.FORMATIONS = FORMATIONS;
  window.WORKSHOPS = WORKSHOPS;
  window.TRAINERS = TRAINERS;
  window.SESSIONS = SESSIONS;
  window.RESOURCES = RESOURCES;
  window.SITE_CONFIG = SITE_CONFIG;
  window.SITE_CONTENT = SITE_CONTENT;
}
`;

  const content = header + defaultsBlock + blocks + configBlock + contentBlock + footer;
  await fs.writeFile(DATA_PATH, content, "utf8");

  // ── SEO : pages HTML statiques (1 par formation) + sitemap + robots ──────
  // Le site est rendu côté navigateur (Babel standalone) → invisible pour
  // Google. On génère donc, à chaque export, une vraie page HTML par
  // formation (contenu réel + meta + Open Graph + JSON-LD Course) que les
  // moteurs peuvent indexer sans exécuter de JS.
  let seo = { pages: 0 };
  try {
    seo = await generateSeoPages(formationsResolved);
  } catch (e) {
    seo = { pages: 0, error: e.message };
  }

  return {
    path: DATA_PATH,
    counts: {
      formations: formations.length,
      workshops: workshops.length,
      trainers: trainers.length,
      sessions: sessions.length,
      resources: resources.length,
    },
    seo,
    bytes: content.length,
  };
}

// ════════════════════════════════════════════════════════════════════════
// GÉNÉRATION SEO — pages statiques indexables + sitemap.xml + robots.txt
// ════════════════════════════════════════════════════════════════════════
const BASE_URL = "https://lagriotheque.com";

function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
// Réduit un champ (string | array | array d'arrays) en texte lisible.
function asText(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(" ");
  if (typeof v === "object") return "";
  return String(v).trim();
}
// Tronque pour une meta description (≈155 caractères).
function metaDesc(s) {
  const t = asText(s).replace(/\s+/g, " ").trim();
  return t.length > 158 ? t.slice(0, 155).trimEnd() + "…" : t;
}
// Extrait le 1er nombre d'un prix ("900 € TTC" → 900).
function priceNumber(p) {
  const m = String(p || "").replace(/\s/g, "").match(/(\d+(?:[.,]\d+)?)/);
  return m ? Number(m[1].replace(",", ".")) : null;
}
function absUrl(src) {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  return `${BASE_URL}/${String(src).replace(/^\//, "")}`;
}

function buildFormationHtml(f) {
  const id = f.id;
  const url = `${BASE_URL}/formation/${id}/`;
  const title = asText(f.title) || id;
  const desc = metaDesc(f.description || f.tagline || title);
  const img = absUrl(f.media && f.media.src);
  const priceN = priceNumber(f.price);

  // Facts (paire label/valeur) affichés en haut.
  const facts = [
    ["Discipline", asText(f.discipline)],
    ["Durée", asText(f.duration)],
    ["Format", asText(f.format)],
    ["Lieu", asText(f.location)],
    ["Tarif", asText(f.price)],
    ["Financement", [f.cpf ? "CPF" : "", f.opco ? "OPCO" : ""].filter(Boolean).join(" · ")],
    ["Certification", [asText(f.rs), asText(f.certifier)].filter(Boolean).join(" — ")],
    ["Formateur", f.trainer ? [asText(f.trainer.name), asText(f.trainer.role)].filter(Boolean).join(" · ") : ""],
  ].filter(([, v]) => v);

  const section = (heading, body) => body ? `<section><h2>${esc(heading)}</h2>${body}</section>` : "";
  const para = (v) => { const t = asText(v); return t ? `<p>${esc(t)}</p>` : ""; };
  const ul = (arr) => Array.isArray(arr) && arr.length
    ? `<ul>${arr.map((x) => `<li>${esc(asText(x))}</li>`).join("")}</ul>` : "";

  // Programme structuré (jours → modules → items), avec repli sur chapters.
  let programHtml = "";
  if (Array.isArray(f.program) && f.program.length && typeof f.program[0] === "object") {
    programHtml = f.program.map((d) => {
      const mods = Array.isArray(d.modules) ? d.modules.map((m) => {
        const items = ul(m.items);
        return `<h3>${esc(asText(m.title))}</h3>${items}`;
      }).join("") : "";
      return `<div class="day"><h3 class="day-title">${esc(asText(d.day))}</h3>${mods}</div>`;
    }).join("");
  } else if (Array.isArray(f.chapters)) {
    programHtml = ul(f.chapters);
  }

  // JSON-LD Course
  const ld = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: title,
    description: desc,
    url,
    inLanguage: "fr",
    provider: { "@type": "EducationalOrganization", name: "La Griothèque", url: BASE_URL },
  };
  if (img) ld.image = img;
  if (asText(f.duration)) ld.timeRequired = asText(f.duration);
  if (asText(f.rs) || asText(f.certifier)) {
    ld.educationalCredentialAwarded = [asText(f.rs), asText(f.certifier)].filter(Boolean).join(" — ");
  }
  ld.hasCourseInstance = {
    "@type": "CourseInstance",
    courseMode: "blended",
    ...(asText(f.duration) ? { courseWorkload: asText(f.duration) } : {}),
  };
  if (priceN != null) {
    ld.offers = { "@type": "Offer", price: priceN, priceCurrency: "EUR", category: "Paid", availability: "https://schema.org/InStock", url };
  }

  const factsHtml = facts.map(([k, v]) => `<div class="fact"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — La Griothèque</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)} — La Griothèque">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
${img ? `<meta property="og:image" content="${esc(img)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)} — La Griothèque">
<meta name="twitter:description" content="${esc(desc)}">
${img ? `<meta name="twitter:image" content="${esc(img)}">` : ""}
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
:root{--bg:#0b0b0c;--fg:#e9e6dd;--dim:#9b968a;--accent:#f0c419;--rule:#26241f}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:780px;margin:0 auto;padding:48px 22px 80px}
a{color:var(--accent)}
.tag{color:var(--dim);text-transform:uppercase;letter-spacing:.14em;font-size:12px}
h1{font-size:30px;line-height:1.2;margin:.4em 0 .2em}
.lede{color:var(--dim);font-size:18px;margin:0 0 28px}
.facts{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--rule);border:1px solid var(--rule);margin:0 0 32px}
.fact{background:var(--bg);padding:12px 14px}
.fact dt{color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.1em}
.fact dd{margin:4px 0 0;font-size:15px}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.14em;color:var(--accent);margin:36px 0 10px;border-bottom:1px solid var(--rule);padding-bottom:6px}
h3{font-size:15px;margin:18px 0 6px}
.day-title{color:var(--accent);text-transform:uppercase;letter-spacing:.08em;font-size:12px}
ul{margin:6px 0;padding-left:20px}li{margin:4px 0}
.cta{display:inline-block;margin-top:36px;background:var(--accent);color:#000;font-weight:700;padding:12px 22px;border-radius:2px;text-decoration:none}
.fin a{color:var(--accent)}
footer{margin-top:48px;border-top:1px solid var(--rule);padding-top:18px;color:var(--dim);font-size:13px}
@media(max-width:560px){.facts{grid-template-columns:1fr}}
</style>
</head>
<body>
<main class="wrap">
<p class="tag">La Griothèque · Formation${f.cpf ? " · éligible CPF" : ""}</p>
<h1>${esc(title)}</h1>
${f.tagline ? `<p class="lede">${esc(asText(f.tagline))}</p>` : ""}
${factsHtml ? `<dl class="facts">${factsHtml}</dl>` : ""}
${(f.cpfUrl || f.franceCompetencesUrl) ? `<p class="fin">${f.cpfUrl ? `<a href="${esc(f.cpfUrl)}" rel="nofollow">Voir sur Mon Compte Formation</a>` : ""}${(f.cpfUrl && f.franceCompetencesUrl) ? " · " : ""}${f.franceCompetencesUrl ? `<a href="${esc(f.franceCompetencesUrl)}" rel="nofollow">Fiche France Compétences</a>` : ""}</p>` : ""}
${section("Présentation", para(f.description))}
${section("Objectifs", ul(f.objectives))}
${section("Public visé", para(f.audience))}
${section("Prérequis", para(f.prerequisites))}
${section("Programme", programHtml)}
${section("Méthodes pédagogiques", para(f.methods))}
${section("Évaluation", para(f.evaluation))}
${section("Accessibilité", para(f.accessibility))}
<a class="cta" href="${BASE_URL}/#formation-${esc(id)}">S'informer / s'inscrire →</a>
<footer>La Griothèque — organisme de formation. <a href="${BASE_URL}/">Toutes les formations</a></footer>
</main>
</body>
</html>
`;
}

async function generateSeoPages(formations) {
  const list = (formations || []).filter((f) => f && f.id && f.available !== false);
  let pages = 0;
  for (const f of list) {
    const dir = path.join(SITE_ROOT, "formation", String(f.id));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "index.html"), buildFormationHtml(f), "utf8");
    pages++;
  }

  // sitemap.xml : accueil + 1 url par formation.
  const urls = [`${BASE_URL}/`, ...list.map((f) => `${BASE_URL}/formation/${f.id}/`)];
  const today = new Date().toISOString().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}
</urlset>
`;
  await fs.writeFile(path.join(SITE_ROOT, "sitemap.xml"), sitemap, "utf8");

  // robots.txt : autorise tout + pointe le sitemap.
  const robots = `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`;
  await fs.writeFile(path.join(SITE_ROOT, "robots.txt"), robots, "utf8");

  return { pages, sitemap: urls.length };
}
