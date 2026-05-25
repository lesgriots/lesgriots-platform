// GET  /api/projects  → liste tous les projets
// POST /api/projects  → crée un nouveau projet (body JSON)
import { NextResponse } from "next/server";
import { listProjects, getProject, upsertProject } from "../../../lib/db.js";

export async function GET() {
  return NextResponse.json(listProjects());
}

export async function POST(req) {
  const body = await req.json();
  if (!body.id || !body.name) {
    return NextResponse.json({ error: "id and name are required" }, { status: 400 });
  }
  // Refuse l'id déjà pris (sinon upsert ferait un replace silencieux)
  if (getProject(body.id)) {
    return NextResponse.json({ error: `id "${body.id}" déjà existant` }, { status: 409 });
  }
  try {
    const saved = upsertProject(body);
    return NextResponse.json(saved, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
