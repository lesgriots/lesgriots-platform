// CRUD des entrées de l'Index (journal) + réordonnancement.
import { NextResponse } from "next/server";
import { listJournal, upsertJournalItem, deleteJournalItem, getJournalItem } from "../../../lib/db.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listJournal());
}

export async function POST(req) {
  try {
    const body = await req.json();
    if (Array.isArray(body.reorder)) {
      for (const { id, position } of body.reorder) {
        const p = getJournalItem(id);
        if (p) upsertJournalItem({ ...p, position });
      }
      return NextResponse.json(listJournal());
    }
    return NextResponse.json(upsertJournalItem(body));
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  return NextResponse.json({ deleted: deleteJournalItem(id) });
}
