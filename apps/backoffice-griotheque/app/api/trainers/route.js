// GET /api/trainers, POST /api/trainers
import { NextResponse } from "next/server";
import { listTrainers, upsertTrainer } from "../../../lib/db.js";

export async function GET() {
  return NextResponse.json(listTrainers());
}
export async function POST(req) {
  try {
    const body = await req.json();
    return NextResponse.json(upsertTrainer(body));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
