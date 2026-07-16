// GET/PUT/DELETE /api/events/[id]
import { NextResponse } from "next/server";
import { getEvent, upsertEvent, deleteEvent } from "../../../../lib/db.js";

// Empêche next build de figer le GET en statique (cf. bug 405 /api/pages).
export const dynamic = "force-dynamic";


export async function GET(_req, { params }) {
  const e = getEvent(params.id);
  if (!e) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(e);
}
export async function PUT(req, { params }) {
  try {
    const body = await req.json();
    return NextResponse.json(upsertEvent({ ...body, id: params.id }));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
export async function DELETE(_req, { params }) {
  return NextResponse.json({ deleted: deleteEvent(params.id) });
}
