// POST /api/stripe/create-payment-intent
//
// Body : { workshopId: string, customerEmail?: string, customerName?: string }
// Réponse : { clientSecret: string, paymentIntentId: string }
//
// Crée un PaymentIntent Stripe à partir d'un workshop. Lit le prix dans la
// base SQLite (workshops collection). Renvoie le client_secret qui sera
// utilisé côté frontend pour confirmer le paiement avec Stripe Elements.
//
// Cette route est PUBLIQUE (cf middleware.js publicPaths) : appelée depuis
// le site lagriotheque, pas depuis le backoffice. Elle ne donne accès à
// rien de sensible (le PaymentIntent ne peut être confirmé qu'avec la
// publishable key + le client_secret côté navigateur).
import { NextResponse } from "next/server";
import { listWorkshops } from "../../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CORS : on autorise toutes les origines localhost / 127.0.0.1 en dev
// (peu importe le port) et les origines prod whitelistées.
const ALLOWED_PROD_ORIGINS = new Set([
  "https://lagriotheque.com",
  "https://www.lagriotheque.com",
]);
const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

function corsHeaders(origin) {
  let allowed = "https://lagriotheque.com"; // fallback safe
  if (origin) {
    if (LOCAL_ORIGIN_RE.test(origin) || ALLOWED_PROD_ORIGINS.has(origin)) {
      allowed = origin;
    }
  }
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export async function OPTIONS(req) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin") || ""),
  });
}

// Parse un prix string en cents. "300 €" / "300,00 €" / "300" → 30000.
// Renvoie null si on ne parvient pas à le décomposer.
function priceToCents(priceStr) {
  if (!priceStr) return null;
  const m = String(priceStr).match(/(\d[\d.,\s]*)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/\s/g, "").replace(",", "."));
  if (isNaN(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export async function POST(req) {
  const origin = req.headers.get("origin") || "";
  const corsH = corsHeaders(origin);
  try {
    const { workshopId, customerEmail, customerName } = await req.json();
    if (!workshopId) {
      return NextResponse.json(
        { error: "workshopId requis" },
        { status: 400, headers: corsH }
      );
    }

    // Cherche le workshop dans la base SQLite (source de vérité du backoffice).
    const workshops = listWorkshops();
    const w = workshops.find((x) => x.id === workshopId);
    if (!w) {
      return NextResponse.json(
        { error: "Workshop introuvable : " + workshopId },
        { status: 404, headers: corsH }
      );
    }

    const amount = priceToCents(w.price);
    if (!amount) {
      return NextResponse.json(
        { error: "Prix invalide pour ce workshop : " + w.price },
        { status: 400, headers: corsH }
      );
    }

    const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
    if (!STRIPE_KEY) {
      return NextResponse.json(
        { error: "STRIPE_SECRET_KEY non configurée côté serveur" },
        { status: 500, headers: corsH }
      );
    }

    // Création du PaymentIntent via l'API Stripe (REST, pas la lib npm — on
    // évite une dépendance pour une seule route).
    const params = new URLSearchParams();
    params.set("amount", String(amount));
    params.set("currency", "eur");
    params.set("automatic_payment_methods[enabled]", "true");
    params.set("description", `Workshop ${w.title}`);
    params.set("metadata[workshop_id]", w.id);
    params.set("metadata[workshop_title]", w.title);
    if (customerEmail) params.set("receipt_email", customerEmail);
    if (customerName) params.set("metadata[customer_name]", customerName);

    const r = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(STRIPE_KEY + ":").toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const j = await r.json();
    if (!r.ok) {
      return NextResponse.json(
        { error: j.error?.message || "Erreur Stripe", details: j },
        { status: 500, headers: corsH }
      );
    }

    return NextResponse.json(
      {
        clientSecret: j.client_secret,
        paymentIntentId: j.id,
        amount: j.amount,
        currency: j.currency,
        workshop: { id: w.id, title: w.title, price: w.price },
      },
      { headers: corsH }
    );
  } catch (err) {
    console.error("create-payment-intent error:", err);
    return NextResponse.json(
      { error: err.message || "Erreur serveur" },
      { status: 500, headers: corsH }
    );
  }
}
