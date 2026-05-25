// Route neutralisée — héritage backoffice studio.
import { NextResponse } from "next/server";
export function GET() { return NextResponse.json({ error: "obsolete: use /api/formations/[id]" }, { status: 410 }); }
export function PUT() { return NextResponse.json({ error: "obsolete" }, { status: 410 }); }
export function DELETE() { return NextResponse.json({ error: "obsolete" }, { status: 410 }); }
