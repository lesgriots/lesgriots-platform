// Génère le fichier data.jsx du site studio à partir du store JSON.
// Le backoffice vit dans apps/backoffice/ et le site studio dans apps/lesgriotsxstudio/.
// Donc on remonte d'un cran (..) puis on entre dans lesgriotsxstudio/.
// On écrit du JS plat (PROJECTS = [...]) lisible et facile à debug.
// Le site continue de fonctionner même si le back office est arrêté.
import fs from "fs/promises";
import path from "path";
import { listProjects, listContent } from "./db.js";

const SITE_ROOT = path.resolve(process.cwd(), "..", "lesgriotsxstudio");
const DATA_PATH = path.join(SITE_ROOT, "data.jsx");

// Échappe les chaînes pour les sortir en littéraux JS sûrs.
function s(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

// Génère un placeholder SVG en data URI pour les projets sans cover.
// Fond ink (#0a0a0a), nom du projet en jaune (#f6e21c) au centre, gros.
// Tient en <500 bytes, parfaitement utilisable comme src d'<img> ou backgroundImage.
function placeholderCover(name) {
  const safeName = (name || "—").toUpperCase().slice(0, 30);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice"><rect width="800" height="600" fill="#0a0a0a"/><text x="400" y="305" font-family="Geist Mono, monospace" font-size="36" font-weight="500" fill="#f6e21c" text-anchor="middle" dominant-baseline="middle" letter-spacing="2">${safeName}</text><text x="400" y="350" font-family="Geist Mono, monospace" font-size="11" fill="#8a8378" text-anchor="middle" letter-spacing="3">NO COVER YET</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Renvoie le cover du projet, ou un placeholder si vide.
function safeCover(p) {
  return (p.cover && p.cover.trim()) ? p.cover : placeholderCover(p.name);
}

function formatProject(p, indent = "  ") {
  const lines = [];
  lines.push(`${indent}{`);
  lines.push(`${indent}  id: ${s(p.id)},`);
  lines.push(`${indent}  name: ${s(p.name)},`);
  if (Array.isArray(p.role)) {
    lines.push(`${indent}  role: ${JSON.stringify(p.role)},`);
  } else if (p.role) {
    lines.push(`${indent}  role: ${s(p.role)},`);
  }
  if (p.client) lines.push(`${indent}  client: ${s(p.client)},`);
  lines.push(`${indent}  date: ${s(p.date || "—")},`);
  lines.push(`${indent}  location: ${s(p.location || "—")},`);
  // Toujours émettre un cover — si vide, on génère un placeholder SVG.
  // Comme ça le site n'a jamais d'image cassée ni d'écran noir.
  lines.push(`${indent}  cover: ${s(safeCover(p))},`);
  if (p.thumbVideo) lines.push(`${indent}  thumbVideo: ${s(p.thumbVideo)},`);
  lines.push(`${indent}  strip: ${JSON.stringify(p.strip || [])},`);
  // Resources : on préserve toutes les clés (y compris duration, etc.)
  if (p.resources && p.resources.length) {
    lines.push(`${indent}  resources: [`);
    for (const r of p.resources) {
      const known = ["type", "src", "poster", "label", "aspect", "duration"];
      const parts = [];
      for (const k of known) if (r[k] !== undefined) parts.push(`${k}: ${s(r[k])}`);
      for (const k of Object.keys(r)) if (!known.includes(k)) parts.push(`${k}: ${s(r[k])}`);
      lines.push(`${indent}    { ${parts.join(", ")} },`);
    }
    lines.push(`${indent}  ],`);
  } else {
    lines.push(`${indent}  resources: [],`);
  }
  lines.push(`${indent}  credits: ${JSON.stringify(p.credits || {})},`);
  lines.push(`${indent}  tags: ${JSON.stringify(p.tags || [])},`);
  lines.push(`${indent}},`);
  return lines.join("\n");
}

export async function exportToDataJsx() {
  const projects = listProjects({ excludeHidden: true });

  const header = `/* global window */
// LESGRIOTSxSTUDIO — projects data
// ⚠️  FICHIER GÉNÉRÉ AUTOMATIQUEMENT par backoffice/.
// Ne pas éditer à la main — ouvre le back office (http://localhost:3030).
// Dernière génération : ${new Date().toISOString()}

`;

  const projectsBlock = `const PROJECTS = [\n${projects.map((p) => formatProject(p)).join("\n")}\n];\n`;

  // Contenu éditorial (intro About, etc.) — exposé via window.SITE_CONTENT.
  const content_rows = listContent();
  const siteContent = {};
  for (const r of content_rows) siteContent[r.key] = r.value;
  const siteBlock = `\nconst SITE_CONTENT = ${JSON.stringify(siteContent, null, 2)};\n`;

  const footer = `\nif (typeof window !== "undefined") {\n  window.PROJECTS = PROJECTS;\n  window.SITE_CONTENT = SITE_CONTENT;\n}\n`;

  const content = header + projectsBlock + siteBlock + footer;
  await fs.writeFile(DATA_PATH, content, "utf8");
  return {
    path: DATA_PATH,
    count: projects.length,
    contentKeys: Object.keys(siteContent),
    bytes: content.length,
  };
}
