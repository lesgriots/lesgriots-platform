// DELETE /api/leads/[id] → supprime un lead (depuis le backoffice)
import { NextResponse } from "next/server";
import { deleteLead } from "../../../../lib/db.js";

export async function DELETE(_req, { params }) {
  return NextResponse.json({ deleted: deleteLead(params.id) });
}
