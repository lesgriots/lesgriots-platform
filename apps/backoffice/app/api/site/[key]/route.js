// GET /api/site/:key  → renvoie le contenu (ou null si pas encore défini)
// PUT /api/site/:key  → enregistre (body JSON = la valeur directe)
import { NextResponse } from "next/server";
import { getContent, setContent } from "../../../../lib/db.js";

export async function GET(_req, { params }) {
  const value = getContent(params.key, null);
  return NextResponse.json({ key: params.key, value });
}

export async function PUT(req, { params }) {
  const body = await req.json();
  // body est la valeur elle-même (objet, array, string)
  setContent(params.key, body);
  return NextResponse.json({ key: params.key, value: body, ok: true });
}
