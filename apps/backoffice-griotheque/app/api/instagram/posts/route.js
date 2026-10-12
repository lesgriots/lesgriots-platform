import { NextResponse } from "next/server";
import { listPosts, savePost, runPost } from "../../../../lib/instagram-publish.js";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try { return NextResponse.json(listPosts()); }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
// Crée un post. Sans date (ou date passée) → publication lancée tout de suite,
// en arrière-plan (une vidéo peut prendre plusieurs minutes chez Meta).
export async function POST(req) {
  try {
    const post = savePost(await req.json());
    if (post.status === "a_publier") runPost(post.id).catch((e) => console.error("publish:", e));
    return NextResponse.json(post);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}
