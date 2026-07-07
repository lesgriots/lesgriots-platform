// Route neutralisée — héritage backoffice studio.
import { NextResponse } from "next/server";

// Empêche next build de figer le GET en statique (cf. bug 405 /api/pages).
export const dynamic = "force-dynamic";

export function GET() { return NextResponse.json(null); }
export function PUT() { return NextResponse.json({ error: "obsolete: use /api/defaults" }, { status: 410 }); }
