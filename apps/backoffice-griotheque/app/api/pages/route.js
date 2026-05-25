// GET /api/pages → { home: true, formations: true, ... }
// PUT /api/pages → merge partiel { workshops: false }
import { NextResponse } from "next/server";
import { getActivePages, setActivePages } from "../../../lib/db.js";

export async function GET() {
  return NextResponse.json(getActivePages());
}

export async function PUT(req) {
  try {
    const body = await req.json();
    return NextResponse.json(setActivePages(body));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
