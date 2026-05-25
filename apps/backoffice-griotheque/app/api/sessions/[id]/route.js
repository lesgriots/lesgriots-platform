import { NextResponse } from "next/server";
import { getSession, upsertSession, deleteSession } from "../../../../lib/db.js";

export async function GET(_req, { params }) {
  const s = getSession(params.id);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(s);
}
export async function PUT(req, { params }) {
  try {
    const body = await req.json();
    return NextResponse.json(upsertSession({ ...body, id: params.id }));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
export async function DELETE(_req, { params }) {
  return NextResponse.json({ deleted: deleteSession(params.id) });
}
