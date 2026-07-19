// GET  /api/site-mode        → { mode }
// POST /api/site-mode { mode } → bascule le site :
//   "coming-soon" : copie attente.html  → index.html (page d'attente publique)
//   "live"        : copie site.html     → index.html (site complet)
// Le vrai site est préservé dans site.html ; la page d'attente dans attente.html.
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getMode, setMode } from "../../../lib/db.js";

const SITE_ROOT = path.resolve(process.cwd(), "..", "lesgriots");
const INDEX = path.join(SITE_ROOT, "index.html");
// Le mode "live" publie la version EXPORTÉE (site.live.html, générée par
// /api/export) si elle existe, sinon le template brut site.html.
const FULL_TEMPLATE = path.join(SITE_ROOT, "site.html");
const FULL_EXPORT = path.join(SITE_ROOT, "site.live.html");
const SOON_EXPORT = path.join(SITE_ROOT, "attente.live.html");
const SOON = path.join(SITE_ROOT, "attente.html");

export async function GET() {
  return NextResponse.json({ mode: getMode() });
}

export async function POST(req) {
  try {
    const { mode } = await req.json();
    const target = mode === "live" ? "live" : "coming-soon";
    const src = target === "live"
      ? (fs.existsSync(FULL_EXPORT) ? FULL_EXPORT : FULL_TEMPLATE)
      : (fs.existsSync(SOON_EXPORT) ? SOON_EXPORT : SOON);
    if (!fs.existsSync(src)) {
      return NextResponse.json(
        { error: `Fichier source manquant : ${path.basename(src)}` },
        { status: 400 }
      );
    }
    // Écriture atomique de index.html (tmp + rename).
    const tmp = INDEX + ".tmp";
    fs.copyFileSync(src, tmp);
    fs.renameSync(tmp, INDEX);
    setMode(target);
    return NextResponse.json({
      ok: true,
      mode: target,
      note: target === "live"
        ? "Site complet en ligne (index.html = site.html)."
        : "Page d'attente en ligne (index.html = attente.html).",
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
