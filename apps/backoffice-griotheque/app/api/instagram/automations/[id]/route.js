import { NextResponse } from "next/server";
import { getAutomation, upsertAutomation, deleteAutomation } from "../../../../../lib/instagram-store.js";
export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  const a = getAutomation(params.id);
  return a ? NextResponse.json(a) : NextResponse.json({ error: "introuvable" }, { status: 404 });
}
export async function PUT(req, { params }) {
  try { return NextResponse.json(upsertAutomation({ ...(await req.json()), id: params.id })); }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}
export async function DELETE(req, { params }) {
  return NextResponse.json({ deleted: deleteAutomation(params.id) });
}
