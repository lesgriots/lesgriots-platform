// GET  /api/home-video → { src, poster }
// POST /api/home-video → enregistre { src, poster } dans le store.
import { NextResponse } from "next/server";
import { getHomeVideo, setHomeVideo } from "../../../lib/db.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getHomeVideo());
}

export async function POST(req) {
  try {
    const body = await req.json();
    const saved = setHomeVideo(body);
    return NextResponse.json(saved);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
