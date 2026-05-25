// Route neutralisée — héritage backoffice studio.
import { NextResponse } from "next/server";
export function GET() { return NextResponse.json([]); }
export function POST() { return NextResponse.json({ error: "obsolete: use /api/formations" }, { status: 410 }); }
