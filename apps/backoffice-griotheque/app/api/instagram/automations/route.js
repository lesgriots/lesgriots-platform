import { NextResponse } from "next/server";
import { listAutomations, upsertAutomation } from "../../../../lib/instagram-store.js";
export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json(listAutomations()); }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
export async function POST(req) {
  try { return NextResponse.json(upsertAutomation(await req.json())); }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}
