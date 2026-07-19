/** @type {import('next').NextConfig} */
//
// Le BO du site ombrelle est servi en prod derrière nginx sur
// https://admin.lesgriots.com/lesgriots/. Pour que Next génère les liens et
// charge les assets _next/ avec le bon préfixe, on configure basePath. En dev
// local (next dev), on garde la racine pour tester sur http://localhost:3032
// sans préfixe.
const isProd = process.env.NODE_ENV === "production";
const basePath = isProd ? "/lesgriots" : "";

const nextConfig = {
  reactStrictMode: true,
  // basePath n'est appliqué qu'en prod (dev reste sur /).
  basePath,
  // assetPrefix : par défaut Next reprend le basePath ; on l'expose en clair
  // pour que les <link> CSS/JS pointent vers /lesgriots/_next/... en prod.
  assetPrefix: isProd ? "/lesgriots" : undefined,
  // Exposé au code client : les fetch("/api/…") et <img src="/api/preview…">
  // doivent être préfixés À LA MAIN (Next ne préfixe que <Link> et ses assets).
  // Cf. lib/bp.js — sans ça, en prod les appels partent sur /api/… du hub,
  // qui route vers le BO Studio (port 3030) : mauvaise app, pages cassées.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};
export default nextConfig;
