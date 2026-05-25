import { NextResponse } from "next/server";
import { listResources, upsertResource } from "../../../lib/db.js";

export async function GET() {
  return NextResponse.json(listResources());
}
export async function POST(req) {
  try {
    const body = await req.json();
    return NextResponse.json(upsertResource(body));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
