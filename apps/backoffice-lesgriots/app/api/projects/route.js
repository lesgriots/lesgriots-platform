// GET    /api/projects           → liste triée (position)
// POST   /api/projects           → upsert d'un projet { id, name, media, … }
//                                  ou réordonnancement { reorder: [{id, position}] }
// DELETE /api/projects?id=xxx    → suppression
import { NextResponse } from "next/server";
import { listProjects, upsertProject, deleteProject, getProject } from "../../../lib/db.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listProjects());
}

export async function POST(req) {
  try {
    const body = await req.json();
    if (Array.isArray(body.reorder)) {
      for (const { id, position } of body.reorder) {
        const p = getProject(id);
        if (p) upsertProject({ ...p, position });
      }
      return NextResponse.json(listProjects());
    }
    const saved = upsertProject(body);
    return NextResponse.json(saved);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const n = deleteProject(id);
  return NextResponse.json({ deleted: n });
}
