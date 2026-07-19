// GET    /api/shop        → liste triée (position)
// POST   /api/shop        → upsert d'un article { id, name, price, img, url, … }
// DELETE /api/shop?id=xxx → suppression
import { NextResponse } from "next/server";
import { listShop, upsertShopItem, deleteShopItem } from "../../../lib/db.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listShop());
}

export async function POST(req) {
  try {
    const body = await req.json();
    const saved = upsertShopItem(body);
    return NextResponse.json(saved);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const n = deleteShopItem(id);
  return NextResponse.json({ deleted: n });
}
