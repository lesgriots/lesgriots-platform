/** @type {import('next').NextConfig} */
// Servi via le hub admin.lesgriots.com/griotheque/ (convention 2026-07).
// basePath uniquement en prod : en dev local on garde la racine (localhost:3031).
const isProd = process.env.NODE_ENV === "production";
const nextConfig = {
  reactStrictMode: true,
  basePath: isProd ? "/griotheque" : "",
  assetPrefix: isProd ? "/griotheque" : undefined,
  // Permet l'upload de vidéos via /api/upload (par défaut Next.js limite à 1 Mo)
  // On monte à 500 Mo, largement suffisant pour une vidéo HD courte.
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
  // Pour les API routes (App Router), la limite est gérée côté runtime nodejs
  // via le streaming natif — pas de config supplémentaire nécessaire ici.
};
export default nextConfig;
