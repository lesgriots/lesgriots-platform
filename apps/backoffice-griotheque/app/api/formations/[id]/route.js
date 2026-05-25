// GET /api/formations/[id]   → récupère une formation
// PUT /api/formations/[id]   → upsert (with id from URL)
// DELETE /api/formations/[id]→ supprime
import { NextResponse } from "next/server";
import { getFormation, upsertFormation, deleteFormation } from "../../../../lib/db.js";

export async function GET(_req, { params }) {
  const f = getFormation(params.id);
  if (!f) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(f);
}

export async function PUT(req, { params }) {
  try {
    const body = await req.json();
    const saved = upsertFormation({ ...body, id: params.id });
    return NextResponse.json(saved);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(_req, { params }) {
  const n = deleteFormation(params.id);
  return NextResponse.json({ deleted: n });
}
