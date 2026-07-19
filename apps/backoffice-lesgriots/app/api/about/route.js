// GET  /api/about → { text, links }
// POST /api/about → enregistre { text, links } dans le store.
import { NextResponse } from "next/server";
import { getAbout, setAbout } from "../../../lib/db.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getAbout());
}

export async function POST(req) {
  try {
    const body = await req.json();
    const saved = setAbout(body);
    return NextResponse.json(saved);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
