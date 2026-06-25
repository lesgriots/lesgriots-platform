// /api/content
//
// GET  → renvoie tout le site_content (avec defaults mergés).
// PUT  → patch partiel : { home: { manifesto: "..." }, approche: { lede: "..." } }
//        ne touche pas aux clés non fournies.
//
// Cette route est protégée par le middleware Basic Auth (cf middleware.js) —
// pas besoin de l'ajouter aux publicPaths.

import { NextResponse } from "next/server";
import { getSiteContent, patchSiteContent } from "../../../lib/db.js";
import { SITE_CONTENT_SECTIONS } from "../../../lib/site-content-defaults.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    content: getSiteContent(),
    sections: SITE_CONTENT_SECTIONS,
  });
}

export async function PUT(req) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body invalide" }, { status: 400 });
    }
    const next = patchSiteContent(body);
    return NextResponse.json({ ok: true, content: next });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
