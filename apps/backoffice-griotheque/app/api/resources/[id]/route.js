import { NextResponse } from "next/server";
import { getResource, upsertResource, deleteResource } from "../../../../lib/db.js";

export async function GET(_req, { params }) {
  const r = getResource(params.id);
  if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(r);
}
export async function PUT(req, { params }) {
  try {
    const body = await req.json();
    return NextResponse.json(upsertResource({ ...body, id: params.id }));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
export async function DELETE(_req, { params }) {
  return NextResponse.json({ deleted: deleteResource(params.id) });
}
