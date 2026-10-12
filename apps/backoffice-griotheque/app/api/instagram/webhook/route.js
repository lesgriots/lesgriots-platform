// Webhook Meta (Instagram) — PUBLIC, appelé par les serveurs de Meta.
// URL à déclarer chez Meta : https://admin.lagriotheque.com/api/instagram/webhook
//   GET  : poignée de main (hub.challenge) avec IG_VERIFY_TOKEN
//   POST : événements (commentaires, messages). Signature X-Hub-Signature-256
//          vérifiée avec IG_APP_SECRET ; tout corps non signé est rejeté.
// On répond 200 tout de suite et on traite en file : Meta coupe au-delà de
// quelques secondes et renvoie l'événement (dédoublonné côté moteur).
import { verifySignature, getSender, maybeRefreshToken } from "../../../../lib/instagram-api.js";
import { parseWebhook, handleComment, handleMessage, enqueue } from "../../../../lib/griot-dm.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && process.env.IG_VERIFY_TOKEN && p.get("hub.verify_token") === process.env.IG_VERIFY_TOKEN) {
    return new Response(p.get("hub.challenge") || "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(req) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    console.warn("instagram webhook : signature invalide");
    return new Response("bad signature", { status: 401 });
  }
  let body;
  try { body = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

  const sender = getSender();
  for (const ev of parseWebhook(body)) {
    enqueue(() => (ev.kind === "comment" ? handleComment(ev, { sender }) : handleMessage(ev, { sender })));
  }
  maybeRefreshToken();
  return new Response("EVENT_RECEIVED", { status: 200 });
}
