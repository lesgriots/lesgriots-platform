// POST /api/subscribe → inscription newsletter (footer du site + page "Bientôt").
// 1. Enregistre l'email comme lead (backup local, toujours).
// 2. Upsert le contact dans Systeme.io (champ "source" + tags) via lib/systeme.js.
//    Bug historique corrigé : cette route lisait SYSTEME_API_KEY alors que
//    /etc/lagriotheque-backoffice.env définit SYSTEMEIO_API_KEY — aucune
//    inscription "launch" n'était donc jamais synchronisée. lib/systeme.js
//    accepte désormais les deux noms.
// CORS : autorise le site lagriotheque.com (cross-origin).
import { NextResponse } from "next/server";
import { addLead } from "../../../lib/db.js";
import { rateLimit, clientIp, tooMany } from "../../../lib/rate-limit.js";
import { syncContactToSystemeIo, sioSlug, splitName } from "../../../lib/systeme.js";

// Empêche next build de figer le GET en statique (cf. bug 405 /api/pages).
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
    const { email, name, first_name, last_name, phone } = body || {};
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400, headers });
    }

    // Deux entrées légitimes : "launch" (page Bientôt) et "newsletter" (footer).
    const source = body.source === "launch" ? "launch" : "newsletter";

    // 1) Backup local — ne perd jamais un email, même si Systeme.io échoue.
    try { addLead({ email, name, first_name, last_name, phone, source, consent: true }); } catch (e) { /* noop */ }

    // 2) Systeme.io — contact + champ "source" + tags (fire-and-forget).
    // "Newsletter" est l'unique tag du plan gratuit (créé le 05/08/2026) :
    // il existe déjà, donc il se pose même sans plan payant — c'est lui qui
    // sert de cible aux campagnes. Les tags src-* attendront l'upgrade.
    const guessed = splitName(name);
    syncContactToSystemeIo({
      email,
      firstName: first_name || guessed.firstName,
      lastName: last_name || guessed.lastName,
      phone,
      source,
      tags: ["Newsletter", "site-lagriotheque", "src-" + sioSlug(source)],
    }).catch((e) => console.warn("systeme.io sync:", e.message));

    return NextResponse.json({ ok: true }, { headers });
  } catch (err) {
    console.error("subscribe POST error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500, headers });
  }
}
