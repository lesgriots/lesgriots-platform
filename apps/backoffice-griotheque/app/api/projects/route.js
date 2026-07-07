// Route neutralisée — héritage backoffice studio.
import { NextResponse } from "next/server";

// Empêche next build de figer le GET en statique (cf. bug 405 /api/pages).
export const dynamic = "force-dynamic";

export function GET() { return NextResponse.json([]); }
export function POST() { return NextResponse.json({ error: "obsolete: use /api/formations" }, { status: 410 }); }
