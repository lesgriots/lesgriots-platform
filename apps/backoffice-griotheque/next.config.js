/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
