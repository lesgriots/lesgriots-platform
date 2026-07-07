// GET /api/defaults → { methods, evaluation, accessibility, location }
// PUT /api/defaults → merge partial
import { NextResponse } from "next/server";
import { getDefaults, setDefaults } from "../../../lib/db.js";

// CRITIQUE : sans ça, `next build` fige le GET en statique (snapshot du store
// au moment du build) et renvoie 405 sur PUT en production.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getDefaults());
}
export async function PUT(req) {
  try {
    const body = await req.json();
    return NextResponse.json(setDefaults(body));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
