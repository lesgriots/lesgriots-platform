// GET /api/preview?p=img/foo.jpg → renvoie le fichier depuis le dossier du site studio.
// Le backoffice vit dans apps/backoffice/ et le site studio dans apps/lesgriotsxstudio/.
// Sert aux miniatures du back office ET au découpeur vidéo (VideoTrimmer).
//
// Supporte les requêtes Range (206 Partial Content) : indispensable pour que
// le <video> du découpeur puisse seeker librement dans un gros fichier source
// (scrub des poignées, extraction des vignettes de la filmstrip) sans devoir
// télécharger tout le fichier d'abord. Streaming via createReadStream — on ne
// charge plus le fichier entier en mémoire.
import path from "path";
import { stat } from "fs/promises";
import { createReadStream } from "fs";
import { Readable } from "stream";

const SITE_ROOT = path.resolve(process.cwd(), "..", "lesgriotsxstudio");

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

  let st;
  try {
    st = await stat(abs);
    if (!st.isFile()) throw new Error("not a file");
  } catch {
    return new Response("not found", { status: 404 });
  }

  const ext = path.extname(abs).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";

  // Requête partielle (seek vidéo) → 206 + Content-Range.
  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    if (!m) return new Response("bad range", { status: 416 });
    const start = parseInt(m[1], 10);
    const end = m[2] ? Math.min(parseInt(m[2], 10), st.size - 1) : st.size - 1;
    if (start >= st.size || end < start) {
      return new Response("range not satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${st.size}` },
      });
    }
    const stream = Readable.toWeb(createReadStream(abs, { start, end }));
    return new Response(stream, {
      status: 206,
      headers: {
        "Content-Type": mime,
        "Content-Range": `bytes ${start}-${end}/${st.size}`,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      },
    });
  }

  // Fichier complet, en streaming.
  const stream = Readable.toWeb(createReadStream(abs));
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(st.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
    },
  });
}
