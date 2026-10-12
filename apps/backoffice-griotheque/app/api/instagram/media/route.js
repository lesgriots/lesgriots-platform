// Derniers posts / reels du compte, pour cibler une automatisation.
import { NextResponse } from "next/server";
import { listMedia } from "../../../../lib/instagram-api.js";
export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json(await listMedia(30)); }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 502 }); }
}
