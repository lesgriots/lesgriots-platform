// POST /api/subscribe → inscription depuis la page "Bientôt" du site.
// 1. Enregistre l'email comme lead (backup local, toujours).
// 2. Crée le contact dans Systeme.io si SYSTEME_API_KEY est configurée.
// CORS : autorise le site lagriotheque.com (cross-origin).
import { NextResponse } from "next/server";
import { addLead } from "../../../lib/db.js";
import { rateLimit, clientIp, tooMany } from "../../../lib/rate-limit.js";

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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  // Anti-spam : 5 inscriptions/minute max par IP
  if (!rateLimit(`${clientIp(req)}:subscribe`, { limit: 5, windowMs: 60_000 })) {
    return tooMany(headers);
  }

  try {
    const body = await req.json();
    const { email, name, source } = body || {};
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400, headers });
    }

    // 1) Backup local — ne perd jamais un email, même si Systeme.io échoue.
    try { addLead({ email, name, source: source || "launch", consent: true }); } catch (e) { /* noop */ }

    // 2) Systeme.io — création du contact si la clé est configurée.
    const key = process.env.SYSTEME_API_KEY;
    if (key) {
      try {
        const payload = { email };
        // Prénom transmis à Systeme.io pour personnaliser les emails
        if (name && typeof name === "string" && name.trim()) {
          payload.fields = [{ slug: "first_name", value: name.trim().slice(0, 80) }];
        }
        await fetch("https://api.systeme.io/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": key },
          body: JSON.stringify(payload),
        });
      } catch (e) { /* on garde quand même le lead local */ }
    }

    return NextResponse.json({ ok: true }, { headers });
  } catch (err) {
    console.error("subscribe POST error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500, headers });
  }
}
