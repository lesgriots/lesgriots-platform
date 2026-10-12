// Simulateur : rejoue une conversation SANS rien envoyer à Instagram ni créer
// de lead. Les automatisations sont les vraies ; les contacts sont fictifs et
// vivent en mémoire le temps de la session de test.
import { NextResponse } from "next/server";
import { loadIg } from "../../../../lib/instagram-store.js";
import { dryRunSender } from "../../../../lib/instagram-api.js";
import { handleComment, handleMessage } from "../../../../lib/griot-dm.js";
export const dynamic = "force-dynamic";

const sims = globalThis.__griotSims || (globalThis.__griotSims = new Map());

export async function POST(req) {
  const { session = "default", reset, kind, text = "", payload = "", username = "testeur", follows = true, mediaId = "" } = await req.json();
  if (reset || !sims.has(session)) {
    const real = loadIg();
    sims.set(session, { automations: real.automations, contacts: [], log: [], processed: [], stats: {}, n: 0 });
  }
  const store = sims.get(session);
  if (reset && !kind) return NextResponse.json({ ok: true });
  store.n++;
  const sender = dryRunSender({ follows, username });
  const before = store.log.length;
  const res = kind === "comment"
    ? await handleComment({ commentId: "sim-c" + store.n, text, fromId: "sim-" + session, username, mediaId }, { sender, store, dry: true })
    : await handleMessage({ igsid: "sim-" + session, text, payload, mid: "sim-m" + store.n }, { sender, store, dry: true });
  const contact = store.contacts.find((c) => c.igsid === "sim-" + session) || null;
  return NextResponse.json({ result: res, out: sender.out, log: store.log.slice(before), contact });
}
