// CRUD des tuiles du panneau Archive + réordonnancement.
import { NextResponse } from "next/server";
import { listArchive, upsertArchiveItem, deleteArchiveItem, getArchiveItem } from "../../../lib/db.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listArchive());
}

export async function POST(req) {
  try {
    const body = await req.json();
    if (Array.isArray(body.reorder)) {
      for (const { id, position } of body.reorder) {
        const p = getArchiveItem(id);
        if (p) upsertArchiveItem({ ...p, position });
      }
      return NextResponse.json(listArchive());
    }
    return NextResponse.json(upsertArchiveItem(body));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  return NextResponse.json({ deleted: deleteArchiveItem(id) });
}
