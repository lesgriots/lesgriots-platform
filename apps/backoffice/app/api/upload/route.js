// POST /api/upload  (multipart/form-data avec champ "file")
// → upload un fichier dans apps/lesgriotsxstudio/img/ et renvoie son chemin relatif (img/foo.jpg)
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const IMG_DIR = path.resolve(process.cwd(), "..", "lesgriotsxstudio", "img");

export async function POST(req) {
  const formData = await req.formData();
  const file = formData.get("file");
  const subdir = (formData.get("subdir") || "").toString().replace(/[^a-z0-9_-]/gi, "");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }
  // Slug propre du nom : enlève espaces, normalise
  const original = file.name || "upload.bin";
  const ext = path.extname(original);
  const base = path.basename(original, ext).toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  const stamp = Date.now().toString(36);
  const safeName = `${base}-${stamp}${ext}`;

  const targetDir = subdir ? path.join(IMG_DIR, subdir) : IMG_DIR;
  await fs.mkdir(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, safeName);

  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(targetPath, bytes);

  const rel = subdir
    ? `img/${subdir}/${safeName}`
    : `img/${safeName}`;
  return NextResponse.json({ path: rel, bytes: bytes.length });
}
