// GET  /api/site-mode                      → { mode, pages }
// POST /api/site-mode { mode?, pages? }     → persiste le mode et/ou les
//   interrupteurs de pages, puis renvoie l'état à jour.
//
// La PUBLICATION ne se fait plus ici : un seul site.html porte désormais son
// mode et ses pages dans un bloc de config (marqueur BO:PAGES). Après un
// changement, l'interface appelle /api/export pour régénérer index.html.
import { NextResponse } from "next/server";
import { getMode, setMode, getPages, setPages } from "../../../lib/db.js";

export async function GET() {
  return NextResponse.json({ mode: getMode(), pages: getPages() });
}

export async function POST(req) {
  try {
    const body = await req.json();
    if (typeof body.mode === "string") setMode(body.mode);
    if (body.pages && typeof body.pages === "object") setPages(body.pages);
    return NextResponse.json({ ok: true, mode: getMode(), pages: getPages() });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
