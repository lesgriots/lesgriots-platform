import { NextResponse } from "next/server";
import { listSessions, upsertSession } from "../../../lib/db.js";

export async function GET() {
  return NextResponse.json(listSessions());
}
export async function POST(req) {
  try {
    const body = await req.json();
    return NextResponse.json(upsertSession(body));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
