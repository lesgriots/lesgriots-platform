// POST /api/export → régénère ../data.jsx à partir de la DB
import { NextResponse } from "next/server";
import { exportToDataJsx } from "../../../lib/exporter.js";

export async function POST() {
  try {
    const result = await exportToDataJsx();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
