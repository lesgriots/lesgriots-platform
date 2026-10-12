import { NextResponse } from "next/server";
import { refreshToken } from "../../../../lib/instagram-api.js";
export const dynamic = "force-dynamic";

export async function POST() {
  try { return NextResponse.json(await refreshToken()); }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}
