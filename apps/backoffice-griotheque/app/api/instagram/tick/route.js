// Appelé chaque minute par le timer systemd griotdm-tick (curl local, Basic auth).
import { NextResponse } from "next/server";
import { tick } from "../../../../lib/instagram-publish.js";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try { return NextResponse.json({ ran: await tick() }); }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
