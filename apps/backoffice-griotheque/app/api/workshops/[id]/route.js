// GET/PUT/DELETE /api/workshops/[id]
import { NextResponse } from "next/server";
import { getWorkshop, upsertWorkshop, deleteWorkshop } from "../../../../lib/db.js";

// Empêche next build de figer le GET en statique (cf. bug 405 /api/pages).
export const dynamic = "force-dynamic";


export async function GET(_req, { params }) {
  const w = getWorkshop(params.id);
  if (!w) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(w);
}
export async function PUT(req, { params }) {
  try {
    const body = await req.json();
    return NextResponse.json(upsertWorkshop({ ...body, id: params.id }));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
export async function DELETE(_req, { params }) {
  return NextResponse.json({ deleted: deleteWorkshop(params.id) });
}
