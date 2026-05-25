// GET  /api/leads → liste des leads (consultable depuis le backoffice)
// POST /api/leads → enregistre un lead depuis le site lagriotheque
//
// CORS : on autorise les origins du site (localhost:8082 en dev, lagriotheque.com en prod)
// pour que le site puisse POSTer depuis un domaine différent.
import { NextResponse } from "next/server";
import { listLeads, addLead } from "../../../lib/db.js";

// Origines autorisées à POST sur cette route (cross-origin)
const ALLOWED_ORIGINS = [
  "http://localhost:8082",
  "http://localhost:8081",
  "http://localhost:8080",
  "https://lagriotheque.com",
  "https://www.lagriotheque.com",
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

// Preflight CORS — le navigateur envoie OPTIONS avant POST cross-origin
export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

// Liste (depuis le backoffice, même origine = pas besoin de CORS)
export async function GET() {
  return NextResponse.json(listLeads());
}

// Enregistre un nouveau lead (depuis le site)
export async function POST(req) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const body = await req.json();
    const { email, name, resource_id, consent } = body || {};

    // Validation basique de l'email
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400, headers });
    }

    const lead = addLead({ email, name, resource_id, consent, source: "site" });

    return NextResponse.json({ ok: true, id: lead.id }, { headers });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500, headers });
  }
}
