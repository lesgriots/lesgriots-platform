// Seed : construit un lesgriots.json initial à partir du contenu ACTUEL de
// apps/lesgriots/index.html (site ombrelle). Idempotent — relançable.
// Usage : node scripts/seed.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_INDEX = path.resolve(__dirname, "..", "..", "lesgriots", "index.html");
const STORE_PATH = path.resolve(__dirname, "..", "lesgriots.json");

const html = fs.readFileSync(SITE_INDEX, "utf8");

// ---- Home video (balise <video class="stage-home" ...>) ----------------
function attr(tag, name) {
  const m = new RegExp(`${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : "";
}
const homeTag = /<video[^>]*class="[^"]*stage-home[^"]*"[^>]*>/.exec(html);
const homeVideo = homeTag
  ? { src: attr(homeTag[0], "src") || "assets/florale.mp4", poster: attr(homeTag[0], "poster") || "assets/florale.jpg" }
  : { src: "assets/florale.mp4", poster: "assets/florale.jpg" };

// ---- Projects (slides .stage-img avec data-key) ------------------------
const NAMES = { florale: "Florale", indigo: "Indigo Cristal", monument: "Monument", aissata: "Aïssata" };
const projects = [];
const slideRe = /<(?:img|video)[^>]*class="[^"]*stage-img[^"]*"[^>]*>/g;
let m, pos = 0;
while ((m = slideRe.exec(html))) {
  const tag = m[0];
  const key = attr(tag, "data-key");
  if (!key) continue;
  projects.push({
    id: key,
    key,
    name: NAMES[key] || key.charAt(0).toUpperCase() + key.slice(1),
    media: attr(tag, "src"),
    poster: attr(tag, "poster") || "",
    type: /^<video/.test(tag) ? "video" : "image",
    position: pos + 1,
    hidden: false,
  });
  pos++;
}

// ---- About : liens écosystème (<a class="aw-site" ...>) -----------------
const links = [];
const linkRe = /<a[^>]*class="[^"]*aw-site[^"]*"[^>]*>[\s\S]*?<\/a>/g;
let lm;
while ((lm = linkRe.exec(html))) {
  const block = lm[0];
  const url = attr(block, "href");
  const imgM = /<img[^>]*src="([^"]*)"/.exec(block);
  const spanM = /<span[^>]*>([\s\S]*?)<\/span>/.exec(block);
  links.push({
    label: spanM ? spanM[1].trim() : url.replace(/^https?:\/\//, ""),
    url,
    img: imgM ? imgM[1] : "",
  });
}

// ---- Shop : articles de la section boutique (shop-panel) ----------------
// Extraction best-effort : chaque <img> de la grille boutique devient un
// article stub (nom/prix à compléter dans le BO). Sinon [].
const shop = [];
const shopPanel = /<aside[^>]*class="[^"]*shop-panel[^"]*"[^>]*>([\s\S]*?)<\/aside>/.exec(html);
if (shopPanel) {
  const imgs = [...shopPanel[1].matchAll(/<img[^>]*src="([^"]*)"[^>]*>/g)];
  imgs.forEach((im, i) => {
    if (/picsum\.photos/.test(im[1])) return; // placeholder → on ignore
    shop.push({ id: `article-${i + 1}`, name: "", price: "", img: im[1], url: "", position: i + 1, hidden: false });
  });
}

const store = {
  homeVideo,
  projects,
  about: { text: "", links },
  shop,
};

fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
console.log(`✓ lesgriots.json écrit — ${projects.length} projets, homeVideo=${homeVideo.src}, ${links.length} liens, ${shop.length} article(s) boutique`);
