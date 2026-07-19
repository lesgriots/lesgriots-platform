// POST /api/upload  (multipart/form-data avec champ "file")
// → upload un fichier dans apps/lesgriots/uploads/ et renvoie son chemin
//   relatif au site (uploads/foo.jpg), servi ensuite par /api/preview.
//
// Adapté du BO Studio (apps/backoffice/app/api/upload/route.js) :
//   - conversion auto des formats non-web (TIFF/PSD/HEIC → JPEG, MOV/AVI → MP4)
//   - remux faststart des mp4 (sinon écran noir sur les gros fichiers)
//   - offload R2 des vidéos lourdes si les variables R2_* sont posées
//     (fichier /etc/lesgriots-backoffice.env sur le VPS), sinon disque local.
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { r2Enabled, r2MinBytes, r2UploadBuffer, r2UploadFile, videoContentType } from "../../../lib/r2.js";

const VIDEO_WEB = /\.(mp4|webm|m4v)$/i;
const execFileP = promisify(execFile);
const UP_DIR = path.resolve(process.cwd(), "..", "lesgriots", "uploads");

const IMG_CONVERT = /\.(tif|tiff|psd|heic|heif|raw|cr2|nef|arw|dng)$/i;
const VID_CONVERT = /\.(mov|m4v|avi|mkv)$/i;

const _binCache = new Map();
async function hasBinary(name) {
  if (_binCache.has(name)) return _binCache.get(name);
  let ok = false;
  try { await execFileP("which", [name]); ok = true; } catch { ok = false; }
  _binCache.set(name, ok);
  return ok;
}

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
    await execFileP("ffmpeg", ["-v", "error", "-i", src, "-q:v", "3", out, "-y"]);
    return "ffmpeg";
  }
  throw new Error("NO_IMG_TOOL");
}

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

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }

  const original = file.name || "upload.bin";
  const srcExt = path.extname(original);
  const base = path.basename(original, srcExt).toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  const stamp = Date.now().toString(36);

  await fs.mkdir(UP_DIR, { recursive: true });
  let bytes = Buffer.from(await file.arrayBuffer());

  const needsImgConvert = IMG_CONVERT.test(original);
  const needsVidConvert = VID_CONVERT.test(original);

  // ---- Déjà web-compatible : écriture directe ---------------------------
  if (!needsImgConvert && !needsVidConvert) {
    const safeName = `${base}-${stamp}${srcExt}`;
    // Remux faststart des mp4 > 2 Mo (index moov en tête → lecture immédiate).
    if (VIDEO_WEB.test(safeName) && bytes.length > 2 * 1024 * 1024 && (await hasBinary("ffmpeg"))) {
      const t1 = path.join(os.tmpdir(), `fs-src-${stamp}${srcExt}`);
      const t2 = path.join(os.tmpdir(), `fs-out-${stamp}${srcExt}`);
      try {
        await fs.writeFile(t1, bytes);
        await execFileP("ffmpeg", ["-v", "error", "-i", t1, "-c", "copy", "-movflags", "+faststart", t2, "-y"]);
        bytes = Buffer.from(await fs.readFile(t2));
      } catch { /* remux raté → original conservé */ }
      finally {
        fs.unlink(t1).catch(() => {});
        fs.unlink(t2).catch(() => {});
      }
    }
    // Vidéo lourde + R2 configuré → bucket (multipart), sinon disque local.
    if (VIDEO_WEB.test(safeName) && r2Enabled() && bytes.length > r2MinBytes()) {
      try {
        const url = await r2UploadBuffer(`videos/${safeName}`, bytes, videoContentType(safeName));
        return NextResponse.json({ path: url, bytes: bytes.length, storage: "r2" });
      } catch (e) {
        console.error("upload R2 échoué, fallback local :", e.message);
      }
    }
    await fs.writeFile(path.join(UP_DIR, safeName), bytes);
    return NextResponse.json({ path: `uploads/${safeName}`, bytes: bytes.length });
  }

  // ---- Conversion via fichier temporaire --------------------------------
  const tmpSrc = path.join(os.tmpdir(), `bo-upload-${stamp}${srcExt}`);
  await fs.writeFile(tmpSrc, bytes);

  try {
    if (needsImgConvert) {
      const outName = `${base}-${stamp}.jpg`;
      const outPath = path.join(UP_DIR, outName);
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
      return NextResponse.json({ path: `uploads/${outName}`, bytes: stat.size, converted: `${srcExt} → .jpg (${tool})` });
    }

    if (!(await hasBinary("ffmpeg"))) {
      return NextResponse.json({
        error: `conversion vidéo impossible : "ffmpeg" n'est pas installé sur le serveur (apt install ffmpeg) ou convertis ${srcExt} en .mp4 H.264 avant d'uploader.`,
      }, { status: 415 });
    }
    const outName = `${base}-${stamp}.mp4`;
    const outPath = path.join(UP_DIR, outName);
    await convertVideoToMp4(tmpSrc, outPath);
    const stat = await fs.stat(outPath);
    if (r2Enabled() && stat.size > r2MinBytes()) {
      try {
        const url = await r2UploadFile(`videos/${outName}`, outPath, "video/mp4");
        fs.unlink(outPath).catch(() => {});
        return NextResponse.json({ path: url, bytes: stat.size, converted: `${srcExt} → .mp4`, storage: "r2" });
      } catch (e) {
        console.error("upload R2 échoué, fallback local :", e.message);
      }
    }
    return NextResponse.json({ path: `uploads/${outName}`, bytes: stat.size, converted: `${srcExt} → .mp4` });
  } catch (e) {
    return NextResponse.json({ error: `conversion échouée : ${e.message}` }, { status: 500 });
  } finally {
    fs.unlink(tmpSrc).catch(() => {});
  }
}
