// DELETE /api/leads/[id] → supprime un lead (depuis le backoffice)
import { NextResponse } from "next/server";
import { deleteLead } from "../../../../lib/db.js";

// Empêche next build de figer le GET en statique (cf. bug 405 /api/pages).
export const dynamic = "force-dynamic";


export async function DELETE(_req, { params }) {
  return NextResponse.json({ deleted: deleteLead(params.id) });
}
