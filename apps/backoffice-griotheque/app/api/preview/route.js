// GET /api/preview?p=img/foo.jpg → renvoie le fichier depuis le site Griothèque.
// Le backoffice vit dans apps/backoffice-griotheque/ et le site dans apps/lagriotheque/.
// Sert à afficher les miniatures (images formations, photos intervenants, etc.).
import fs from "fs/promises";
import path from "path";

const SITE_ROOT = path.resolve(process.cwd(), "..", "lagriotheque");

const MIME = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".gif": "image/gif",
  ".webp": "image/webp", ".svg": "image/svg+xml",
  ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf",
};

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const p = searchParams.get("p");
  if (!p) return new Response("missing p", { status: 400 });

  // Sécurité : empêche les traversées (../) — on résout puis on vérifie que ça reste sous SITE_ROOT.
  const abs = path.resolve(SITE_ROOT, p);
  if (!abs.startsWith(SITE_ROOT + path.sep)) {
    return new Response("forbidden", { status: 403 });
  }

  try {
    const data = await fs.readFile(abs);
    const ext = path.extname(abs).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
