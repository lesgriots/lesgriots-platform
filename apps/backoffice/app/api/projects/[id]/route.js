// GET    /api/projects/:id  → un projet
// PUT    /api/projects/:id  → màj (body JSON)
// DELETE /api/projects/:id  → supprime
import { NextResponse } from "next/server";
import { getProject, upsertProject, deleteProject } from "../../../../lib/db.js";

export async function GET(_req, { params }) {
  const p = getProject(params.id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(p);
}

export async function PUT(req, { params }) {
  const body = await req.json();
  body.id = params.id; // id immuable
  const saved = upsertProject(body);
  return NextResponse.json(saved);
}

export async function DELETE(_req, { params }) {
  const deleted = deleteProject(params.id);
  return NextResponse.json({ deleted });
}
