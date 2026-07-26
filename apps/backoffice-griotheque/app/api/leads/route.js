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
    const { email, name, phone, resource_id, consent, source, subject, message } = body || {};

    // Validation basique de l'email
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400, headers });
    }

    // source limité à une liste connue (pas de valeur arbitraire en base)
    const src = ["site", "launch", "cpf", "contact"].includes(source) ? source : "site";
    const lead = addLead({ email, name, phone, resource_id, consent, source: src, subject, message });
    // Passerelle CRM : chaque lead est poussé vers Systeme.io (contact + tags).
    // Fire-and-forget : une panne Systeme.io ne bloque jamais la capture,
    // le lead est déjà enregistré dans le BO.
    syncLeadToSystemeIo(lead).catch((e) => console.warn("systeme.io sync:", e.message));

    return NextResponse.json({ ok: true, id: lead.id }, { headers });
  } catch (err) {
    // Route publique : on log le détail côté serveur, message générique côté client
    console.error("leads POST error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500, headers });
  }
}

// ---- Passerelle Systeme.io ------------------------------------------------
// Pousse un lead vers Systeme.io : upsert du contact + pose des tags.
// Tags posés : "site-lagriotheque" (toujours), "src-<source>", et pour le
// formulaire de contact "sujet-<slug>". Les tags manquants sont créés.
// Clé API : SYSTEMEIO_API_KEY dans /etc/lagriotheque-backoffice.env —
// si absente, la passerelle est simplement inactive (aucune erreur).
const SIO_API = "https://api.systeme.io/api";

function sioSlug(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function sioFetch(key, path, options = {}) {
  const res = await fetch(SIO_API + path, {
    ...options,
    headers: {
      "X-API-Key": key,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok && res.status !== 422) {
    throw new Error(`systeme.io ${path} → ${res.status}`);
  }
  return data;
}

async function sioFindOrCreateContact(key, lead) {
  // 422 sur création = contact existant → on le retrouve par email.
  const created = await sioFetch(key, "/contacts", {
    method: "POST",
    body: JSON.stringify({
      email: lead.email,
      fields: lead.name ? [{ slug: "first_name", value: lead.name.split(" ")[0] }] : [],
    }),
  });
  if (created && created.id) return created;
  const found = await sioFetch(key, "/contacts?email=" + encodeURIComponent(lead.email));
  return found && found.items && found.items[0] ? found.items[0] : null;
}

async function sioTagIds(key, names) {
  const out = [];
  let existing = [];
  try {
    const list = await sioFetch(key, "/tags?limit=100");
    existing = (list && list.items) || [];
  } catch (e) { /* liste indisponible → on tentera la création */ }
  for (const name of names) {
    let tag = existing.find((t) => t.name === name);
    if (!tag) {
      tag = await sioFetch(key, "/tags", { method: "POST", body: JSON.stringify({ name }) });
      // 422 = déjà existant mais absent de la page listée
      if (!tag || !tag.id) {
        const rel = await sioFetch(key, "/tags?limit=100");
        tag = ((rel && rel.items) || []).find((t) => t.name === name);
      }
    }
    if (tag && tag.id) out.push(tag.id);
  }
  return out;
}

async function syncLeadToSystemeIo(lead) {
  const key = process.env.SYSTEMEIO_API_KEY;
  if (!key || !lead || !lead.email) return;
  const contact = await sioFindOrCreateContact(key, lead);
  if (!contact || !contact.id) return;
  const tagNames = ["site-lagriotheque", "src-" + sioSlug(lead.source || "site")];
  if (lead.source === "contact" && lead.subject) tagNames.push("sujet-" + sioSlug(lead.subject));
  const ids = await sioTagIds(key, tagNames);
  for (const tagId of ids) {
    await sioFetch(key, `/contacts/${contact.id}/tags`, {
      method: "POST",
      body: JSON.stringify({ tagId }),
    }).catch(() => {});
  }
}
