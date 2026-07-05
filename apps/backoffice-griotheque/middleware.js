// Auth HTTP Basic — barrière simple pour empêcher l'accès non autorisé en local
// ET en prod si jamais on déploie. Le mot de passe vient de ADMIN_PASSWORD (.env.local).
import { NextResponse } from "next/server";

export function middleware(req) {
  // Endpoints PUBLICS — appelés par le site lagriotheque sans auth.
  // /api/leads = capture des emails depuis la modal ressources (lead-gate).
  // Le visiteur du site n'a pas et ne doit pas avoir le mot de passe back-office,
  // donc on laisse passer sans auth. La route elle-même valide l'email + applique
  // le CORS pour n'accepter que les origines connues (localhost:8082, prod).
  // Le preflight OPTIONS aussi doit passer sans auth, sinon CORS échoue.
  const publicPaths = ["/api/leads", "/api/subscribe", "/api/stripe/create-payment-intent"];
  if (publicPaths.includes(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const auth = req.headers.get("authorization");
  const expected = process.env.ADMIN_PASSWORD;

  // SÉCURITÉ : pas de mot de passe par défaut. Si ADMIN_PASSWORD n'est pas
  // configuré, on bloque tout (503) au lieu d'accepter "changeme".
  if (!expected) {
    return new NextResponse(
      "ADMIN_PASSWORD non configuré — accès refusé. Définir ADMIN_PASSWORD dans .env.local.",
      { status: 503 }
    );
  }

  if (!auth) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="LesGriotsxStudio Back Office"' },
    });
  }
  const [, b64] = auth.split(" ");
  let decoded = "";
  try { decoded = Buffer.from(b64, "base64").toString(); } catch { /* ignore */ }
  const idx = decoded.indexOf(":");
  const password = idx >= 0 ? decoded.slice(idx + 1) : "";
  if (!timingSafeEqual(password, expected)) {
    return new NextResponse("Invalid credentials", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="LesGriotsxStudio Back Office"' },
    });
  }
  return NextResponse.next();
}

// Comparaison en temps constant (le middleware Edge n'a pas crypto.timingSafeEqual).
// Empêche de deviner le mot de passe caractère par caractère via le timing.
function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(String(a));
  const bb = enc.encode(String(b));
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export const config = {
  // Protège tout sauf les fichiers statiques de Next
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
