// GET /api/places/:id → jauge publique d'un événement (capacité, restantes,
// complet). Appelé par le site lagriotheque pour afficher les places
// restantes et fermer l'inscription quand c'est complet. Aucune donnée
// personnelle n'est renvoyée.
import { NextResponse } from "next/server";
import { getEvent, eventPlaces } from "../../../../lib/db.js";

export const dynamic = "force-dynamic";

const ALLOWED_ORIGINS = [
  "http://localhost:8082",
  "http://localhost:8081",
  "http://localhost:8080",
  "https://lagriotheque.com",
  "https://www.lagriotheque.com",
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : "https://lagriotheque.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function GET(req, { params }) {
  const headers = corsHeaders(req.headers.get("origin"));
  const ev = getEvent(String(params.id || ""));
  if (!ev) return NextResponse.json({ error: "introuvable" }, { status: 404, headers });
  const { capacity, remaining, full } = eventPlaces(ev);
  return NextResponse.json({ capacity, remaining, full }, { headers });
}
