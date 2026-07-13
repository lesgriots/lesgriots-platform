// POST /api/trim  (JSON: { src, start, end })
// Découpe le segment [start, end] d'une vidéo déjà présente dans
// apps/lesgriotsxstudio/img/ et le ré-encode en boucle web optimisée :
//   .mp4 H.264, sans audio, faststart, yuv420p → parfait pour une vidéo
//   de fond en boucle (autoplay muted loop côté site).
// Renvoie le chemin relatif du clip généré (img/xxx-loop-xxx.mp4).
//
// Pré-requis serveur : ffmpeg (déjà installé sur le VPS).
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileP = promisify(execFile);
const SITE_ROOT = path.resolve(process.cwd(), "..", "lesgriotsxstudio");
const IMG_DIR = path.join(SITE_ROOT, "img");

async function hasFfmpeg() {
  try { await execFileP("which", ["ffmpeg"]); return true; } catch { return false; }
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const src = (body.src || "").toString();
  const start = Number(body.start);
  const end = Number(body.end);

  if (!src) return NextResponse.json({ error: "src manquant" }, { status: 400 });
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return NextResponse.json({ error: "bornes invalides (fin doit être après début)" }, { status: 400 });
  }
  const duration = Math.min(end - start, 600); // garde-fou : 10 min max
  if (duration < 0.2) return NextResponse.json({ error: "segment trop court" }, { status: 400 });

  // Résout le fichier source et vérifie qu'il reste bien sous img/ (anti-traversée).
  const abs = path.resolve(SITE_ROOT, src);
  if (!abs.startsWith(IMG_DIR + path.sep)) {
    return NextResponse.json({ error: "chemin source non autorisé" }, { status: 400 });
  }
  try { await fs.access(abs); } catch { return NextResponse.json({ error: "fichier source introuvable" }, { status: 404 }); }

  if (!(await hasFfmpeg())) {
    return NextResponse.json({ error: "ffmpeg n'est pas installé sur le serveur" }, { status: 415 });
  }

  const srcExt = path.extname(abs);
  const base = path.basename(abs, srcExt).replace(/-loop-[a-z0-9]+$/i, "");
  const stamp = Date.now().toString(36);
  const outName = `${base}-loop-${stamp}.mp4`;
  const outPath = path.join(IMG_DIR, outName);

  // Recadrage optionnel : { zoom ≥ 1, px, py ∈ [0,1], ratio? } envoyé par le
  // découpeur du BO (format device + zoom + pan de l'image).
  //   - sans ratio : crop iw/zoom × ih/zoom (même ratio que la source)
  //   - avec ratio R : crop = plus grand rectangle de ratio R contenu dans
  //     la source, divisé par zoom → w = min(iw, ih*R)/zoom, h = w/R
  //   - position : x = (iw - ow) * px. Dimensions paires (requis yuv420p).
  //   NB : la virgule dans min() est échappée (\,) pour le parseur de
  //   filtergraph ffmpeg.
  let vf = null;
  const c = body.crop;
  if (c) {
    const z = Math.min(Math.max(Number(c.zoom) || 1, 1), 6);
    const ratio = Number(c.ratio);
    const hasRatio = Number.isFinite(ratio) && ratio >= 0.2 && ratio <= 5;
    if (z > 1.001 || hasRatio) {
      const px = Math.min(Math.max(Number(c.px ?? 0.5), 0), 1);
      const py = Math.min(Math.max(Number(c.py ?? 0.5), 0), 1);
      const zs = z.toFixed(4);
      const wExpr = hasRatio
        ? `floor(min(iw\\,ih*${ratio.toFixed(6)})/${zs}/2)*2`
        : `floor(iw/${zs}/2)*2`;
      const hExpr = hasRatio
        ? `floor(ow/${ratio.toFixed(6)}/2)*2`
        : `floor(ih/${zs}/2)*2`;
      vf = `crop=${wExpr}:${hExpr}:(iw-ow)*${px.toFixed(4)}:(ih-oh)*${py.toFixed(4)}`;
    }
  }

  // Cap de résolution : les boucles servent de thumbs (cellules 130-190px)
  // et de fonds hover — 1280px de large suffisent largement, même en retina.
  // Une source 1920/4K ré-encodée telle quelle double/quadruple le poids
  // pour zéro gain visuel. -2 = hauteur paire auto (requis yuv420p).
  const SCALE = "scale=min(1280\\,iw):-2";
  vf = vf ? `${vf},${SCALE}` : SCALE;

  try {
    // -ss avant -i : seek rapide ; ré-encodage → coupe précise.
    await execFileP("ffmpeg", [
      "-v", "error",
      "-ss", String(start),
      "-i", abs,
      "-t", String(duration),
      ...(vf ? ["-vf", vf] : []),
      "-an",                          // sans audio (boucle muette)
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outPath, "-y",
    ], { maxBuffer: 1024 * 1024 * 8 });

    const stat = await fs.stat(outPath);
    return NextResponse.json({ path: `img/${outName}`, bytes: stat.size, duration });
  } catch (e) {
    return NextResponse.json({ error: `découpage échoué : ${e.message}` }, { status: 500 });
  }
}
