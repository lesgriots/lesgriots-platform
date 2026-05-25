// GET /api/workshops, POST /api/workshops
import { NextResponse } from "next/server";
import { listWorkshops, upsertWorkshop } from "../../../lib/db.js";

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
