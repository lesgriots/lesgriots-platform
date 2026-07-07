// GET /api/formations → liste des formations
// POST /api/formations → crée/met à jour une formation (body = objet formation)
import { NextResponse } from "next/server";
import { listFormations, upsertFormation } from "../../../lib/db.js";

// Empêche next build de figer le GET en statique (cf. bug 405 /api/pages).
export const dynamic = "force-dynamic";


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
