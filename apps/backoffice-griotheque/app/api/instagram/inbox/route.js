// Liste des conversations Instagram + infos du contact local.
import { NextResponse } from "next/server";
import { listConversations } from "../../../../lib/instagram-api.js";
import { loadIg } from "../../../../lib/instagram-store.js";
import { isMe, other, contactView, windowInfo } from "../../../../lib/griot-inbox.js";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const convs = await listConversations(50);
    const store = loadIg();
    const out = convs.map((cv) => {
      const p = other(cv);
      const c = (store.contacts || []).find((x) => x.igsid === String(p.id)) || null;
      const m = (cv.messages && cv.messages.data && cv.messages.data[0]) || null;
      const fromMe = m ? isMe(m.from) : false;
      const lastIn = [!fromMe && m ? m.created_time : null, c && c.last_in_at].filter(Boolean).sort().pop() || null;
      const unread = !!(m && !fromMe && (!c || !c.seen_at || Date.parse(c.seen_at) < Date.parse(m.created_time)));
      return {
        id: cv.id, updated_time: cv.updated_time,
        igsid: String(p.id || ""), username: p.username || (c && c.username) || "",
        last: m ? { text: m.message || "", from_me: fromMe, at: m.created_time } : null,
        unread, window: windowInfo(lastIn), contact: contactView(c),
      };
    });
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
