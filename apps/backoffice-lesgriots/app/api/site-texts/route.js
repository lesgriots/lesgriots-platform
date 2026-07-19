// GET/POST des méta + textes épars + réseaux du site.
import { NextResponse } from "next/server";
import { getSiteTexts, setSiteTexts } from "../../../lib/db.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getSiteTexts());
}

export async function POST(req) {
  try {
    const body = await req.json();
    return NextResponse.json(setSiteTexts(body));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
