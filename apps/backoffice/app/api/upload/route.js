// POST /api/upload  (multipart/form-data avec champ "file")
// → upload un fichier dans apps/lesgriotsxstudio/img/ et renvoie son chemin relatif (img/foo.jpg)
//
// CONVERSION AUTO (portable Mac + Linux/VPS) : les formats que les navigateurs
// n'affichent pas sont convertis à la volée, côté serveur, avant d'être enregistrés.
//   - Images TIFF / PSD / HEIC / RAW → JPEG
//   - Vidéos MOV / M4V / AVI / MKV   → MP4 H.264
//
// On essaie plusieurs convertisseurs dans l'ordre et on prend le 1er disponible.
// Comme ça le MÊME code marche en local (macOS → sips) ET une fois déployé sur
// le VPS Linux (→ ImageMagick ou vips). La vidéo passe par ffmpeg (Mac + Linux).
//
// Pré-requis sur le VPS Linux (à installer une fois) :
//   apt install ffmpeg imagemagick libheif-examples   # heif pour les .heic
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileP = promisify(execFile);
const IMG_DIR = path.resolve(process.cwd(), "..", "lesgriotsxstudio", "img");

// Formats image à convertir en JPEG.
const IMG_CONVERT = /\.(tif|tiff|psd|heic|heif|raw|cr2|nef|arw|dng)$/i;
// Vidéos à remuxer/réencoder en MP4.
const VID_CONVERT = /\.(mov|m4v|avi|mkv)$/i;

// Cache des binaires détectés (évite de relancer `which` à chaque upload).
const _binCache = new Map();
async function hasBinary(name) {
  if (_binCache.has(name)) return _binCache.get(name);
  let ok = false;
  try { await execFileP("which", [name]); ok = true; } catch { ok = false; }
  _binCache.set(name, ok);
  return ok;
}

// Convertit une image vers JPEG avec le 1er outil dispo. Renvoie l'outil utilisé.
// Ordre : sips (macOS) → magick (ImageMagick v7) → convert (v6) → vips → ffmpeg.
async function convertImageToJpeg(src, out) {
  if (await hasBinary("sips")) {
    await execFileP("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "85", src, "--out", out]);
    return "sips";
  }
  if (await hasBinary("magick")) {
    await execFileP("magick", [src, "-quality", "85", "-flatten", out]);
    return "imagemagick";
  }
  if (await hasBinary("convert")) {
    await execFileP("convert", [src, "-quality", "85", "-flatten", out]);
    return "imagemagick";
  }
  if (await hasBinary("vips")) {
    await execFileP("vips", ["jpegsave", src, out, "--Q", "85"]);
    return "vips";
  }
  if (await hasBinary("ffmpeg")) {
    // Dernier recours — ffmpeg lit TIFF et beaucoup de RAW (pas le PSD multicalque).
    await execFileP("ffmpeg", ["-v", "error", "-i", src, "-q:v", "3", out, "-y"]);
    return "ffmpeg";
  }
  throw new Error("NO_IMG_TOOL");
}

// Convertit une vidéo en MP4 H.264 + audio AAC. Copie le flux vidéo si possible
// (rapide), sinon réencode en H.264.
async function convertVideoToMp4(src, out) {
  try {
    await execFileP("ffmpeg", ["-v", "error", "-i", src, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out, "-y"]);
  } catch {
    await execFileP("ffmpeg", ["-v", "error", "-i", src, "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out, "-y"]);
  }
}

export async function POST(req) {
  const formData = await req.formData();
  const file = formData.get("file");
  const subdir = (formData.get("subdir") || "").toString().replace(/[^a-z0-9_-]/gi, "");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

  const original = file.name || "upload.bin";
  const srcExt = path.extname(original);
  const base = path.basename(original, srcExt).toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  const stamp = Date.now().toString(36);

  const targetDir = subdir ? path.join(IMG_DIR, subdir) : IMG_DIR;
  await fs.mkdir(targetDir, { recursive: true });

  const bytes = Buffer.from(await file.arrayBuffer());

  const needsImgConvert = IMG_CONVERT.test(original);
  const needsVidConvert = VID_CONVERT.test(original);

  // ---- Cas simple : déjà web-compatible, on écrit tel quel ----------------
  if (!needsImgConvert && !needsVidConvert) {
    const safeName = `${base}-${stamp}${srcExt}`;
    const targetPath = path.join(targetDir, safeName);
    await fs.writeFile(targetPath, bytes);
    const rel = subdir ? `img/${subdir}/${safeName}` : `img/${safeName}`;
    return NextResponse.json({ path: rel, bytes: bytes.length });
  }

  // ---- Conversion : on passe par un fichier temporaire --------------------
  const tmpSrc = path.join(os.tmpdir(), `bo-upload-${stamp}${srcExt}`);
  await fs.writeFile(tmpSrc, bytes);

  try {
    if (needsImgConvert) {
      const outName = `${base}-${stamp}.jpg`;
      const outPath = path.join(targetDir, outName);
      let tool;
      try {
        tool = await convertImageToJpeg(tmpSrc, outPath);
      } catch (e) {
        if (e.message === "NO_IMG_TOOL") {
          return NextResponse.json({
            error: `conversion image impossible : aucun convertisseur trouvé sur le serveur. Installe ImageMagick (apt install imagemagick) ou convertis ${srcExt} en .jpg avant d'uploader.`,
          }, { status: 415 });
        }
        throw e;
      }
      const stat = await fs.stat(outPath);
      const rel = subdir ? `img/${subdir}/${outName}` : `img/${outName}`;
      return NextResponse.json({ path: rel, bytes: stat.size, converted: `${srcExt} → .jpg (${tool})` });
    }

    // Vidéo
    if (!(await hasBinary("ffmpeg"))) {
      return NextResponse.json({
        error: `conversion vidéo impossible : "ffmpeg" n'est pas installé sur le serveur (apt install ffmpeg / brew install ffmpeg) ou convertis ${srcExt} en .mp4 H.264 avant d'uploader.`,
      }, { status: 415 });
    }
    const outName = `${base}-${stamp}.mp4`;
    const outPath = path.join(targetDir, outName);
    await convertVideoToMp4(tmpSrc, outPath);
    const stat = await fs.stat(outPath);
    const rel = subdir ? `img/${subdir}/${outName}` : `img/${outName}`;
    return NextResponse.json({ path: rel, bytes: stat.size, converted: `${srcExt} → .mp4` });
  } catch (e) {
    return NextResponse.json({ error: `conversion échouée : ${e.message}` }, { status: 500 });
  } finally {
    fs.unlink(tmpSrc).catch(() => {});
  }
}
