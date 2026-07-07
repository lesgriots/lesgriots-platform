// GET /api/workshops, POST /api/workshops
import { NextResponse } from "next/server";
import { listWorkshops, upsertWorkshop } from "../../../lib/db.js";

// Empêche next build de figer le GET en statique (cf. bug 405 /api/pages).
export const dynamic = "force-dynamic";


export async function GET() {
  return NextResponse.json(listWorkshops());
}

export async function POST(req) {
  try {
    const body = await req.json();
    return NextResponse.json(upsertWorkshop(body));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
