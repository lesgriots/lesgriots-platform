// Contacts Instagram (personnes ayant interagi). PATCH = mettre en pause /
// relancer l'automate pour une personne (quand on reprend la main en DM).
import { NextResponse } from "next/server";
import { loadIg, mutateIg } from "../../../../lib/instagram-store.js";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = loadIg();
  const list = [...s.contacts].sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  return NextResponse.json(list);
}
export async function PATCH(req) {
  const { igsid, paused, reset } = await req.json();
  const c = mutateIg((s) => {
    const x = s.contacts.find((k) => k.igsid === String(igsid));
    if (!x) return null;
    if (typeof paused === "boolean") x.paused = paused;
    if (reset) { x.state = null; x.pending = null; }
    x.updated_at = new Date().toISOString();
    return x;
  });
  return c ? NextResponse.json(c) : NextResponse.json({ error: "introuvable" }, { status: 404 });
}
