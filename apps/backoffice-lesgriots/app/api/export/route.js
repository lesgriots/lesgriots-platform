// POST /api/export → régénère le site les griots à partir du store.
// STUB (milestone 1) : l'exporter réel (data.jsx + hydratation de index.html)
// arrive en milestone 2. Pour l'instant on renvoie un résumé du store pour que
// le bouton Sync fonctionne sans erreur.
import { NextResponse } from "next/server";
import { listProjects, getHomeVideo, getAbout, listShop } from "../../../lib/db.js";

export async function POST() {
  try {
    const count = listProjects().length;
    return NextResponse.json({
      ok: true,
      count,
      home: !!getHomeVideo().src,
      links: (getAbout().links || []).length,
      shop: listShop().length,
      note: "Exporter réel en milestone 2 (data.jsx + hydratation).",
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
