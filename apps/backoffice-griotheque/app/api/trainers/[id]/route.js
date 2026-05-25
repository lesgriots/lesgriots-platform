import { NextResponse } from "next/server";
import { getTrainer, upsertTrainer, deleteTrainer } from "../../../../lib/db.js";

export async function GET(_req, { params }) {
  const t = getTrainer(params.id);
  if (!t) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(t);
}
export async function PUT(req, { params }) {
  try {
    const body = await req.json();
    return NextResponse.json(upsertTrainer({ ...body, id: params.id }));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
export async function DELETE(_req, { params }) {
  return NextResponse.json({ deleted: deleteTrainer(params.id) });
}
