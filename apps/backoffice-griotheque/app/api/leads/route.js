// GET  /api/leads → liste des leads (consultable depuis le backoffice)
// POST /api/leads → enregistre un lead depuis le site lagriotheque
//
// CORS : on autorise les origins du site (localhost:8082 en dev, lagriotheque.com en prod)
// pour que le site puisse POSTer depuis un domaine différent.
import { NextResponse } from "next/server";
import { listLeads, addLead } from "../../../lib/db.js";
import { rateLimit, clientIp, tooMany } from "../../../lib/rate-limit.js";

// Empêche next build de figer le GET en statique (cf. bug 405 /api/pages).
export const dynamic = "force-dynamic";


// Origines autorisées à POST sur cette route (cross-origin)
const ALLOWED_ORIGINS = [
  "http://localhost:8082",
  "http://localhost:8081",
  "http://localhost:8080",
  "https://lagriotheque.com",
  "https://www.lagriotheque.com",
];

function corsHeaders(origin) {
  // Fallback = origine PROD (pas localhost) : une origine inconnue ne doit
  // jamais recevoir un Allow-Origin qui lui permette de lire la réponse.
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : "https://lagriotheque.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
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

  // Anti-spam : 5 leads/minute max par IP
  if (!rateLimit(`${clientIp(req)}:leads`, { limit: 5, windowMs: 60_000 })) {
    return tooMany(headers);
  }

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
    // Route publique : on log le détail côté serveur, message générique côté client
    console.error("leads POST error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500, headers });
  }
}
