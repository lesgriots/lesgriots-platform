// GET /api/events, POST /api/events
import { NextResponse } from "next/server";
import { listEvents, upsertEvent } from "../../../lib/db.js";

// Empêche next build de figer le GET en statique (cf. bug 405 /api/pages).
export const dynamic = "force-dynamic";


export async function GET() {
  return NextResponse.json(listEvents());
}

export async function POST(req) {
  try {
    const body = await req.json();
    return NextResponse.json(upsertEvent(body));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
