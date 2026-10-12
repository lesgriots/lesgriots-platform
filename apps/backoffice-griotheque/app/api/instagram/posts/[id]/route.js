import { NextResponse } from "next/server";
import { deletePost, runPost, listPosts } from "../../../../../lib/instagram-publish.js";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req, { params }) {
  const p = listPosts().find((x) => x.id === params.id);
  return p ? NextResponse.json(p) : NextResponse.json({ error: "introuvable" }, { status: 404 });
}
// POST = relancer (après une erreur, ou publier un programmé tout de suite)
export async function POST(req, { params }) {
  runPost(params.id).catch((e) => console.error("publish:", e));
  return NextResponse.json({ ok: true });
}
export async function DELETE(req, { params }) {
  try { return NextResponse.json({ deleted: deletePost(params.id) }); }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 409 }); }
}
