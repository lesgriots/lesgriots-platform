import { NextResponse } from "next/server";
import { subscribeWebhooks, getSubscriptions } from "../../../../lib/instagram-api.js";
export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json(await getSubscriptions()); }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 502 }); }
}
export async function POST() {
  try { return NextResponse.json(await subscribeWebhooks()); }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}
