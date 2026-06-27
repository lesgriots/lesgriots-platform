// POST /api/upload-programme/[id]  (multipart/form-data avec champ "file")
// → upload le PDF programme d'une formation dans
//   apps/lagriotheque/img/programmes/{id}.pdf
//   (le fichier est nommé exactement par l'id, écrase l'ancien si existe)
//
// GET /api/upload-programme/[id]
// → vérifie si un PDF existe déjà pour cette formation, renvoie le chemin
//
// DELETE /api/upload-programme/[id]
// → supprime le PDF programme d'une formation
//
// Convention : un seul PDF par formation, nommé par son id. Le frontend du
// site (lagriotheque) construit l'URL directement : img/programmes/{id}.pdf
// donc le nom de fichier doit matcher exactement l'id.
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PROGRAMMES_DIR = path.resolve(
  process.cwd(),
  "..",
  "lagriotheque",
  "img",
  "programmes"
);

function safeId(id) {
  // Whitelist stricte : on n'accepte que des id slug-safe (lettres, chiffres,
  // tirets, underscores). Empêche les ../ et autres traversal paths.
  if (!id || typeof id !== "string") return null;
  if (!/^[a-z0-9_-]+$/i.test(id)) return null;
  return id;
}

export async function POST(req, { params }) {
  try {
    const id = safeId(params.id);
    if (!id) {
      return NextResponse.json(
        { error: "id invalide (lettres, chiffres, tirets uniquement)" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "missing file" }, { status: 400 });
    }

    const original = file.name || "programme.pdf";
    const ext = path.extname(original).toLowerCase();
    if (ext !== ".pdf") {
      return NextResponse.json(
        { error: "Le programme doit être un PDF (extension .pdf attendue)" },
        { status: 400 }
      );
    }

    await fs.mkdir(PROGRAMMES_DIR, { recursive: true });
    const targetPath = path.join(PROGRAMMES_DIR, `${id}.pdf`);
    const bytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(targetPath, bytes);

    return NextResponse.json({
      ok: true,
      id,
      path: `img/programmes/${id}.pdf`,
      bytes: bytes.length,
    });
  } catch (err) {
    console.error("upload-programme error:", err);
    return NextResponse.json(
      { error: err.message || "Upload échoué" },
      { status: 500 }
    );
  }
}

export async function GET(req, { params }) {
  try {
    const id = safeId(params.id);
    if (!id) return NextResponse.json({ exists: false });
    const targetPath = path.join(PROGRAMMES_DIR, `${id}.pdf`);
    const { searchParams } = new URL(req.url);
    const wantsFile = searchParams.get("file") === "1";

    try {
      const stat = await fs.stat(targetPath);
      // ?file=1 → sert le binaire PDF directement (preview ou download)
      if (wantsFile) {
        const bytes = await fs.readFile(targetPath);
        return new NextResponse(bytes, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Length": String(stat.size),
            "Content-Disposition": `inline; filename="${id}.pdf"`,
            "Cache-Control": "no-store",
          },
        });
      }
      // Sinon → métadonnées JSON
      return NextResponse.json({
        exists: true,
        id,
        path: `img/programmes/${id}.pdf`,
        bytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      });
    } catch {
      if (wantsFile) {
        return NextResponse.json({ error: "PDF introuvable" }, { status: 404 });
      }
      return NextResponse.json({ exists: false, id });
    }
  } catch (err) {
    console.error("upload-programme check error:", err);
    return NextResponse.json({ exists: false, error: err.message });
  }
}

export async function DELETE(_req, { params }) {
  try {
    const id = safeId(params.id);
    if (!id) {
      return NextResponse.json({ error: "id invalide" }, { status: 400 });
    }
    const targetPath = path.join(PROGRAMMES_DIR, `${id}.pdf`);
    try {
      await fs.unlink(targetPath);
      return NextResponse.json({ ok: true, deleted: `img/programmes/${id}.pdf` });
    } catch (err) {
      if (err.code === "ENOENT") {
        return NextResponse.json({ ok: true, deleted: null, note: "déjà absent" });
      }
      throw err;
    }
  } catch (err) {
    console.error("upload-programme delete error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
