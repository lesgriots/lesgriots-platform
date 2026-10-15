// Lien suivi envoyé en DM : compte le clic puis redirige vers la vraie page.
// Public (le contact n'est pas connecté au BO). Jeton inconnu → accueil du site.
import { NextResponse } from "next/server";
import { recordClick, destination } from "../../../../../lib/griot-track.js";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req, { params }) {
  const { token } = await params;
  const t = String(token || "");
  let link = null;
  if (/^[a-f0-9]{10}$/.test(t)) { try { link = recordClick(t); } catch (e) { console.warn("griot go:", e.message); } }
  const to = link ? destination(link, t) : "https://lagriotheque.com/";
  return NextResponse.redirect(to, { status: 302, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
