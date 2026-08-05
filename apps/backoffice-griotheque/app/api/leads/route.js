// GET  /api/leads → liste des leads (consultable depuis le backoffice)
// POST /api/leads → enregistre un lead depuis le site lagriotheque
//
// CORS : on autorise les origins du site (localhost:8082 en dev, lagriotheque.com en prod)
// pour que le site puisse POSTer depuis un domaine différent.
//
// Chaque lead est aussi poussé vers Systeme.io (contact + champ "source" +
// tags) via lib/systeme.js — fire-and-forget, la capture locale prime.
import { NextResponse } from "next/server";
import { listLeads, addLead } from "../../../lib/db.js";
import { rateLimit, clientIp, tooMany } from "../../../lib/rate-limit.js";
import { syncContactToSystemeIo, sioSlug, splitName } from "../../../lib/systeme.js";

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

// ---- Normalisation de la source -------------------------------------------
// Le site envoie des sources hétérogènes : "cpf", "contact", "launch",
// "newsletter", "inscription:<kind>:<titre>", ou rien du tout (téléchargement
// de ressource, identifié par resource_id). On en tire :
//   - source : une valeur courte et stable (stockée en base + tag src-<source>)
//   - detail : la trace complète pour le champ "source" du contact Systeme.io
// Historique : l'ancienne whitelist ["site","launch","cpf","contact"] écrasait
// "inscription:…" et les ressources en "site" — l'intention était perdue.
const KIND_LABELS = { formation: "inscription-formation", workshop: "inscription-workshop", event: "inscription-evenement" };

function normalizeSource(body) {
  const raw = String(body.source || "").slice(0, 160);
  if (["cpf", "contact", "launch", "newsletter", "site"].includes(raw)) {
    const detail = raw === "cpf" && body.resource_id ? `cpf:${String(body.resource_id).replace(/^cpf-/, "")}` : raw;
    return { source: raw, detail };
  }
  if (raw.startsWith("inscription:")) {
    const kind = raw.split(":")[1];
    return { source: KIND_LABELS[kind] || "inscription", detail: raw };
  }
  if (body.resource_id) {
    return { source: "ressource", detail: `ressource:${String(body.resource_id).slice(0, 80)}` };
  }
  return { source: "site", detail: "site" };
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
    const { email, name, first_name, last_name, phone, resource_id, consent, subject, message } = body || {};

    // Validation basique de l'email
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400, headers });
    }

    const { source, detail } = normalizeSource(body);
    const lead = addLead({ email, name, first_name, last_name, phone, resource_id, consent, source, subject, message });

    // Passerelle CRM : chaque lead est poussé vers Systeme.io (contact +
    // champ "source" + tags). Fire-and-forget : une panne Systeme.io ne
    // bloque jamais la capture, le lead est déjà enregistré dans le BO.
    const guessed = splitName(name);
    const tags = ["site-lagriotheque", "src-" + sioSlug(source)];
    // "Newsletter" = l'unique tag du plan gratuit, déjà créé → se pose sans
    // upgrade. Une inscription newsletter/launch vaut abonnement.
    if (source === "newsletter" || source === "launch") tags.unshift("Newsletter");
    if (source === "contact" && subject) tags.push("sujet-" + sioSlug(subject));
    syncContactToSystemeIo({
      email,
      firstName: first_name || guessed.firstName,
      lastName: last_name || guessed.lastName,
      phone,
      source: detail,
      tags,
    }).catch((e) => console.warn("systeme.io sync:", e.message));

    return NextResponse.json({ ok: true, id: lead.id }, { headers });
  } catch (err) {
    // Route publique : on log le détail côté serveur, message générique côté client
    console.error("leads POST error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500, headers });
  }
}
