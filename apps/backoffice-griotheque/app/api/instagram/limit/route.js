import { NextResponse } from "next/server";
import { publishingLimit } from "../../../../lib/instagram-publish.js";
export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json(await publishingLimit()); }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 502 }); }
}
