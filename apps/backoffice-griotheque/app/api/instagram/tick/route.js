// Appelé chaque minute par le timer systemd griotdm-tick (curl local, Basic auth).
import { NextResponse } from "next/server";
import { tick } from "../../../../lib/instagram-publish.js";
import { processFollowups } from "../../../../lib/griot-dm.js";
import { getSender } from "../../../../lib/instagram-api.js";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const ran = await tick();
    let relances = [];
    try { relances = await processFollowups(getSender()); } catch (e) { relances = ["erreur : " + e.message]; }
    return NextResponse.json({ ran, relances });
  }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
