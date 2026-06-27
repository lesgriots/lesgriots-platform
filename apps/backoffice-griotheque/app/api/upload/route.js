// POST /api/upload  (multipart/form-data avec champ "file")
// → upload un fichier (image OU vidéo) dans apps/lagriotheque/img/
//   et renvoie son chemin relatif (img/foo.jpg ou img/video-xxx.mp4)
//
// IMPORTANT : Next.js limite par défaut le body des API routes à 1 Mo.
// Pour permettre l'upload de vidéos (~10-200 Mo), on désactive le bodyParser
// et on augmente sizeLimit. On force aussi le runtime Node (pas Edge) car
// Edge ne supporte pas fs.writeFile.
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Permet d'uploader jusqu'à 500 Mo (largement suffisant pour une vidéo HD)
export const maxDuration = 60;

const IMG_DIR = path.resolve(process.cwd(), "..", "lagriotheque", "img");

// Extensions reconnues pour valider l'upload et détecter le type
const ALLOWED_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp",   // images
  ".mp4", ".mov", ".webm", ".m4v",                     // vidéos
  ".pdf", ".zip", ".fig",                              // ressources (PDF, archives, fichiers Figma)
]);

const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm", ".m4v"]);

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const subdir = (formData.get("subdir") || "").toString().replace(/[^a-z0-9_-]/gi, "");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "missing file" }, { status: 400 });
    }

    // Slug propre du nom : enlève espaces, normalise
    const original = file.name || "upload.bin";
    const ext = path.extname(original).toLowerCase();

    if (!ALLOWED_EXTS.has(ext)) {
      return NextResponse.json({
        error: `Extension ${ext} non autorisée. Accepté : ${[...ALLOWED_EXTS].join(", ")}`
      }, { status: 400 });
    }

    const base = path.basename(original, ext).toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
    const stamp = Date.now().toString(36);
    const safeName = `${base}-${stamp}${ext}`;

    const targetDir = subdir ? path.join(IMG_DIR, subdir) : IMG_DIR;
    await fs.mkdir(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, safeName);

    const bytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(targetPath, bytes);

    const rel = subdir ? `img/${subdir}/${safeName}` : `img/${safeName}`;

    return NextResponse.json({
      path: rel,
      bytes: bytes.length,
      type: VIDEO_EXTS.has(ext) ? "video" : "image",
    });
  } catch (err) {
    console.error("upload error:", err);
    return NextResponse.json({ error: err.message || "Upload échoué" }, { status: 500 });
  }
}
