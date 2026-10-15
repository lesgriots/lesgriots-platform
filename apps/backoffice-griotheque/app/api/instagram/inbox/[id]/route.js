// Un fil de conversation : lecture (marque comme lu) et réponse manuelle.
// Répondre met l'automate en pause 24 h pour cette personne (par défaut),
// pour qu'il ne parle pas en même temps que toi.
import { NextResponse } from "next/server";
import { getConversation, getSender } from "../../../../../lib/instagram-api.js";
import { loadIg, mutateIg, upsertContact, logIg } from "../../../../../lib/instagram-store.js";
import { isMe, other, contactView, windowInfo } from "../../../../../lib/griot-inbox.js";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req, { params }) {
  const { id } = await params;
  try {
    const cv = await getConversation(id, 50);
    const p = other(cv);
    const msgs = ((cv.messages && cv.messages.data) || []).map((m) => ({
      id: m.id, text: m.message || "", at: m.created_time, from_me: isMe(m.from),
    })).reverse();
    const lastInMsg = [...msgs].reverse().find((m) => !m.from_me);
    const c = mutateIg((s) => {
      const x = upsertContact(s, String(p.id), {});
      if (!x.username && p.username) x.username = p.username;
      if (lastInMsg && (!x.last_in_at || x.last_in_at < lastInMsg.at)) x.last_in_at = lastInMsg.at;
      x.seen_at = new Date().toISOString();
      return x;
    });
    const store = loadIg();
    const links = Object.entries(store.links || {}).filter(([, l]) => l.igsid === String(p.id))
      .map(([t, l]) => ({ token: t, automation: l.automation, url: l.url, at: l.at, clicks: l.clicks || 0, converted: l.converted || null }))
      .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 10);
    const followups = (store.followups || []).filter((f) => f.igsid === String(p.id)).slice(-5);
    return NextResponse.json({
      id: cv.id, igsid: String(p.id || ""), username: p.username || c.username || "",
      messages: msgs, window: windowInfo(c.last_in_at), contact: contactView(c), links, followups,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

export async function POST(req, { params }) {
  await params;
  const { igsid, text, pause_hours } = await req.json();
  const msg = String(text || "").trim().slice(0, 1000);
  if (!igsid || !msg) return NextResponse.json({ error: "message vide" }, { status: 400 });
  const store = loadIg();
  const c = (store.contacts || []).find((x) => x.igsid === String(igsid));
  if (!c || !windowInfo(c.last_in_at).open) {
    return NextResponse.json({ error: "Fenêtre de 24 h fermée : Instagram n'autorise un message que dans les 24 h après le dernier message de la personne." }, { status: 409 });
  }
  try {
    const r = await getSender().sendMessage(String(igsid), { text: msg });
    const h = pause_hours === 0 ? 0 : Math.max(1, Math.min(72, Number(pause_hours) || 24));
    const x = mutateIg((s) => {
      const k = upsertContact(s, String(igsid), {});
      if (h) k.paused_until = new Date(Date.now() + h * 3600e3).toISOString();
      logIg(s, { type: "réponse manuelle", igsid: k.igsid, username: k.username, text: msg.slice(0, 80) });
      return k;
    });
    return NextResponse.json({ ok: true, message_id: r && r.message_id, contact: contactView(x) });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
