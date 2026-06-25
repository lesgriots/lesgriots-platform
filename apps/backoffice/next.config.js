/** @type {import('next').NextConfig} */
//
// Le BO est servi en prod derrière nginx sur https://admin.lesgriots.com/studio/.
// Pour que Next génère les liens et charge les assets _next/ avec le bon
// préfixe, on configure basePath. En dev local (next dev), on garde la racine
// pour pouvoir tester sur http://localhost:3030 sans préfixe.
const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  reactStrictMode: true,
  // basePath n'est appliqué qu'en prod (dev reste sur /).
  basePath: isProd ? "/studio" : "",
  // assetPrefix : par défaut Next reprend le basePath ; on l'expose en clair
  // pour que les <link> CSS/JS pointent vers /studio/_next/... en prod.
  assetPrefix: isProd ? "/studio" : undefined,
};
export default nextConfig;
