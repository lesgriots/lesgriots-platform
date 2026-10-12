// Derniers posts / reels du compte, pour cibler une automatisation.
import { NextResponse } from "next/server";
import { listMedia } from "../../../../lib/instagram-api.js";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const n = Math.min(60, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 30));
  try { return NextResponse.json(await listMedia(n)); }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 502 }); }
}
