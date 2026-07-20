// POST /api/export → EXPORTER RÉEL (milestone 2).
// Hydrate le template site.html (marqueurs <!-- BO:xxx -->) avec le store
// lesgriots.json et écrit apps/lesgriots/site.live.html (gitignoré).
// Si le site est en mode "live", met aussi à jour index.html.
//
// Le template reste versionné et intact : l'export remplace uniquement le
// CONTENU entre marqueurs, dans une copie. Relançable à volonté.
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  listProjects, getHomeVideo, getAbout, listShop,
  listJournal, listArchive, getSiteTexts, getMode,
} from "../../../lib/db.js";

const SITE_ROOT = path.resolve(process.cwd(), "..", "lesgriots");
const TEMPLATE = path.join(SITE_ROOT, "site.html");
const OUTPUT = path.join(SITE_ROOT, "site.live.html");
const ATT_TEMPLATE = path.join(SITE_ROOT, "attente.html");
const ATT_OUTPUT = path.join(SITE_ROOT, "attente.live.html");
const INDEX = path.join(SITE_ROOT, "index.html");

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function fill(html, name, inner) {
  const re = new RegExp(`(<!-- BO:${name} -->)[\\s\\S]*?(<!-- /BO:${name} -->)`);
  if (!re.test(html)) throw new Error(`marqueur BO:${name} introuvable dans site.html`);
  return html.replace(re, `$1\n${inner}\n$2`);
}

export async function POST() {
  try {
    let html = fs.readFileSync(TEMPLATE, "utf8");

    const projects = listProjects({ excludeHidden: true });
    const home = getHomeVideo();
    const about = getAbout();
    const shop = listShop({ excludeHidden: true });
    const journal = listJournal({ excludeHidden: true });
    const archive = listArchive({ excludeHidden: true });
    const { meta, texts, social } = getSiteTexts();

    // ---- Méta (hors marqueurs : title + description) --------------------
    if (meta.title) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(meta.title)}</title>`);
    if (meta.description) {
      if (/<meta name="description"/.test(html)) {
        html = html.replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(meta.description)}" />`);
      } else {
        html = html.replace("</title>", `</title>\n<meta name="description" content="${esc(meta.description)}" />`);
      }
    }

    // ---- Stage : stack d'images + vidéo d'accueil ------------------------
    html = fill(html, "STAGE_IMAGES", projects.map((p, i) => {
      const src = p.type === "video" ? (p.poster || p.media) : p.media;
      const cls = i === 0 ? "stage-img is-active is-visible" : "stage-img";
      return `    <img class="${cls}" data-key="${esc(p.key || p.id)}" src="${esc(src)}" alt="" />`;
    }).join("\n"));

    html = fill(html, "HOME_VIDEO",
      `  <video class="stage-home" id="stage-home" src="${esc(home.src)}" poster="${esc(home.poster)}" autoplay muted loop playsinline preload="auto"></video>`);

    // ---- Index / journal --------------------------------------------------
    html = fill(html, "JR_BG", journal.map((j) =>
      `      <img data-bg="${esc(j.id)}" src="${esc(j.img)}" alt="" />`).join("\n"));
    html = fill(html, "JR_ROWS", journal.map((j) =>
      `    <div class="jr-row" data-key="${esc(j.id)}"><dt>${esc(j.date)}</dt><dd>${esc(j.title)}</dd></div>`).join("\n"));
    html = fill(html, "JR_FOOT",
      `  <footer class="jr-foot"><span>${esc(texts.footer || "© LES GRIOTS")}</span><a href="${esc(social.instagram || "#")}" target="_blank" rel="noopener">INSTAGRAM</a></footer>`);

    // ---- Player ----------------------------------------------------------
    html = fill(html, "PLAYER_SUB", `    <span class="player-sub">${esc(texts.playerSub)}</span>`);

    // ---- Données par projet (panneau : hero/intro/note/galerie) ----------
    const lgData = {};
    for (const j of journal) {
      lgData[j.id] = {
        hero: j.hero || "",
        intro: j.intro || "",
        note: j.note || "",
        gallery: j.gallery || [],
      };
    }
    html = fill(html, "DATA",
      `<script id="lg-data">window.LG_PROJECTS = ${JSON.stringify(lgData)};</script>`);

    // ---- About — structure EXACTE du panneau du site, partagée avec
    // la page d'attente : phrase sur écran noir, puis les 3 sites en
    // grande grille « pin-up » (aw-sites) qui montent en cascade.
    // Les doubles retours à la ligne du texte About deviennent des respirations
    // de paragraphes (le template ne rend qu'un seul <p>).
    const para = (t) => esc(t).replace(/\n{2,}/g, "<br /><br />").replace(/\n/g, "<br />");
    const hasEn = !!(about.text_en && about.text_en.trim());
    const aboutTextHtml =
      `    <div class="about-slide"><p data-lang="fr">${para(about.text)}</p>` +
      (hasEn ? `<p data-lang="en">${para(about.text_en)}</p>` : ``) +
      `</div>`;
    // Toggle FR/EN : présent seulement si une version anglaise existe.
    // Le carré de langue affiche la langue OPPOSÉE : « English » quand le
    // site est en français, « Français » quand il est en anglais.
    const langToggleHtml = hasEn
      ? `<button type="button" class="lang-toggle" aria-label="Français / English"><span>English</span></button>`
      : ``;
    // Sections « à la Saint Heron » : un écran par pilier, visuel de fond
    // assombri + bloc éditorial (titre, paragraphe, lien vers le site).
    // Présentation des sites « comme ça » (réf. envoyée par Moos) : écran
    // CLAIR, rangée horizontale de rectangles (visuel du site) avec le nom
    // en serif centré dessous. Révélation en cascade à l'arrivée.
    const aboutSitesHtml =
      `    <div class="about-slide ah-section aw2-slide"><div class="aw2-row">\n` +
      (about.links || []).map((l) =>
        `      <a class="aw2-item" href="${esc(l.url)}" target="_blank" rel="noopener"><span class="aw2-frame"><img src="${esc(l.img)}" alt="${esc(l.label)}" onerror="this.parentNode.style.display='none'" /></span><span class="aw2-label">${esc(l.label)}</span></a>`).join("\n") +
      `\n    </div></div>`;
    html = fill(html, "ABOUT_TEXT", aboutTextHtml);
    html = fill(html, "LANG_TOGGLE", langToggleHtml);
    html = fill(html, "ABOUT_SITES", aboutSitesHtml);

    // ---- Shop ------------------------------------------------------------
    html = fill(html, "SHOP_PRODUCTS", shop.map((p) =>
      `    <article class="sp-product" data-desc="${esc(p.desc)}" data-url="${esc(p.url)}" data-price="${esc(p.price)}"><img src="${esc(p.img)}" alt="" /><h3>${esc(p.name)}</h3><a href="${p.url ? esc(p.url) : "#"}"${p.url ? ' target="_blank" rel="noopener"' : ""}>(&nbsp;&nbsp;Acheter&nbsp;&nbsp;)</a></article>`).join("\n"));

    // ---- Archive ---------------------------------------------------------
    const tiles = [];
    archive.forEach((a, i) => {
      tiles.push(`    <a href="${a.url ? esc(a.url) : "#"}" title="${esc(a.title)}"${a.url ? ' target="_blank" rel="noopener"' : ""}><img src="${esc(a.img)}" alt="${esc(a.title)}" /></a>`);
      if ((i + 1) % 5 === 0) tiles.push(`    <a href="#" class="ar-gap"></a>`);
    });
    html = fill(html, "ARCHIVE_TILES", tiles.join("\n"));

    // ---- Cache-bust styles.css -------------------------------------------
    const v = Date.now().toString(36);
    html = html.replace(/href="styles\.css[^"]*"/, `href="styles.css?v=${v}"`);

    // ---- Page d'attente : hydratée elle aussi (vidéo + About) ------------
    let att = fs.readFileSync(ATT_TEMPLATE, "utf8");
    const attFill = (name, inner) => {
      const re = new RegExp(`(<!-- BO:${name} -->)[\\s\\S]*?(<!-- /BO:${name} -->)`);
      if (!re.test(att)) throw new Error(`marqueur BO:${name} introuvable dans attente.html`);
      att = att.replace(re, `$1\n${inner}\n$2`);
    };
    attFill("ATT_VIDEO",
      `  <video class="home-video" src="${esc(home.src)}" poster="${esc(home.poster)}" autoplay muted loop playsinline preload="auto"></video>`);
    attFill("ATT_ABOUT_TEXT", aboutTextHtml);
    attFill("ATT_LANG_TOGGLE", langToggleHtml);
    attFill("ATT_ABOUT_SITES", aboutSitesHtml);

    // ---- Écriture atomique -----------------------------------------------
    const tmp = OUTPUT + ".tmp";
    fs.writeFileSync(tmp, html, "utf8");
    fs.renameSync(tmp, OUTPUT);
    const tmpA = ATT_OUTPUT + ".tmp";
    fs.writeFileSync(tmpA, att, "utf8");
    fs.renameSync(tmpA, ATT_OUTPUT);

    // La page ACTIVE est republiée dans la foulée (index.html), quel que soit le mode.
    const mode = getMode();
    const src = mode === "live" ? OUTPUT : ATT_OUTPUT;
    const t2 = INDEX + ".tmp";
    fs.copyFileSync(src, t2);
    fs.renameSync(t2, INDEX);
    const published = true;

    return NextResponse.json({
      ok: true,
      count: projects.length,
      journal: journal.length,
      archive: archive.length,
      shop: shop.length,
      home: !!home.src,
      links: (about.links || []).length,
      published,
      note: mode === "live"
        ? "Site complet régénéré et publié (page d'attente aussi mise à jour)."
        : "Pages régénérées — la page d'attente (active) est publiée, le site complet est prêt derrière.",
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
