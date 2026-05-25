// GET /api/formations → liste des formations
// POST /api/formations → crée/met à jour une formation (body = objet formation)
import { NextResponse } from "next/server";
import { listFormations, upsertFormation } from "../../../lib/db.js";

export async function GET() {
  return NextResponse.json(listFormations());
}

export async function POST(req) {
  try {
    const body = await req.json();
    const saved = upsertFormation(body);
    return NextResponse.json(saved);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
