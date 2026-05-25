// Route neutralisée — héritage backoffice studio.
import { NextResponse } from "next/server";
export function GET() { return NextResponse.json(null); }
export function PUT() { return NextResponse.json({ error: "obsolete: use /api/defaults" }, { status: 410 }); }
