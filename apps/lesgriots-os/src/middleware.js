import { NextResponse } from 'next/server';
import { estHoteGriotheque, ACCUEIL_GRIOTHEQUE } from '@/lib/hotes.mjs';

// ⚠️ Le middleware tourne en edge runtime : il ne peut PAS lire SQLite,
// donc il ne fait qu'un tri rapide. La VRAIE validation (session en DB,
// clé API timing-safe, permissions) est faite dans les routes API via
// withGuard (src/lib/api-guard.js).

// Routes publiques (pas besoin d'auth)
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/google',
  // Lien de connexion à usage unique — le token EST l'authentification.
  '/api/auth/lien',
  // Code de connexion depuis un appareil déjà connecté — le code EST
  // l'authentification, la route doit donc être joignable sans session.
  '/api/auth/code',
  // Connexion par mot de passe : c'est une porte d'entrée, elle doit être
  // joignable sans session. Le POST est limité en tentatives côté route.
  '/api/auth/motdepasse',
  '/api/auth/logout',
  '/_next',
  '/favicon.ico',
  '/apple-icon.png',
  // L'onglet réclame l'icône avant toute session : si elle passe par la porte
  // d'authentification, le navigateur reçoit la page de connexion, met cet
  // échec en cache, et l'onglet reste vide.
  '/icon.png',
  '/branding/',
  '/manifest.webmanifest',
  // Pages publiques apprenants (émargement / questionnaires) — accès par token uniquement.
  // NB : '/p/' avec slash final pour ne PAS ouvrir /projects, /providers, etc.
  '/p/',
  // L'espace entreprise, même principe : '/e/' avec slash final.
  '/e/',
  '/api/public',
];

/**
 * Chemins publics EXACTS, et pourquoi la distinction n'est pas un détail.
 *
 * La liste ci-dessus se compare avec startsWith. '/espace' y figurait pour
 * ouvrir la porte de l'espace apprenant, et ouvrait du même coup
 * '/espace-apprenant', qui est l'écran de RÉGLAGES de cet espace, réservé à
 * l'organisme. Le préfixe avait avalé un voisin.
 *
 * Les portes sont des pages précises : on les compare donc à l'identique.
 * Même piège évité côté entreprise, où '/entreprise' aurait ouvert
 * '/entreprises', l'annuaire interne des clients.
 */
const PUBLIC_EXACTS = new Set([
  '/espace',
  '/entreprise',
]);

const API_PREFIX = '/api/';

export function middleware(request) {
  // En production : TOUJOURS actif.
  // En dev : actif seulement si AUTH_ENABLED=true dans .env.local.
  if (process.env.NODE_ENV !== 'production' && process.env.AUTH_ENABLED !== 'true') {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // ── La racine, selon le domaine ────────────────────────────────────────
  // Decision du 26/07/2026 : app.lagriotheque.com est l'OS de l'organisme de
  // formation. Or « / » rend Mission Control, le cockpit des trois piliers,
  // avec le TJM de l'agence et les projets du studio. Ce n'est pas la maison
  // de ce domaine-la : on entre par la vue d'ensemble de la Griotheque.
  if (pathname === '/' && estHoteGriotheque(request.headers.get('host'))) {
    return NextResponse.redirect(new URL(ACCUEIL_GRIOTHEQUE, request.url));
  }

  // Skip public paths
  if (PUBLIC_EXACTS.has(pathname) || PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get('griot_session')?.value;

  // ── Routes API ──
  // Refus rapide si aucune trace d'auth (ni cookie, ni Bearer, ni x-api-key).
  // Sinon on laisse passer : withGuard fait la validation réelle en DB.
  if (pathname.startsWith(API_PREFIX)) {
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const apiKey = request.headers.get('x-api-key');

    if (!sessionToken && !bearerToken && !apiKey) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // ── Pages ──
  // Présence du cookie de session uniquement (validation réelle côté serveur).
  // Un Bearer ou une clé API ne donnent PAS accès aux pages.
  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files
    '/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|branding/|manifest.webmanifest).*)',
  ],
};
