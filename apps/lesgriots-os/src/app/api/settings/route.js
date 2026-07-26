import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

// GET /api/settings — returns all settings as a flat object
async function _GET() {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT key, value FROM settings").all();
    const settings = {};
    rows.forEach(r => {
      try { settings[r.key] = JSON.parse(r.value); } catch { settings[r.key] = r.value; }
    });
    return NextResponse.json(settings);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/settings — upserts multiple key-value pairs from body object
async function _PUT(request) {
  try {
    const db = getDb();
    const body = await request.json();
    const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    const upsertAll = db.transaction((entries) => {
      for (const [key, value] of entries) {
        upsert.run(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
    });
    upsertAll(Object.entries(body));
    // Return updated settings
    const rows = db.prepare("SELECT key, value FROM settings").all();
    const settings = {};
    rows.forEach(r => {
      try { settings[r.key] = JSON.parse(r.value); } catch { settings[r.key] = r.value; }
    });
    return NextResponse.json(settings);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('settings:read', _GET);
export const PUT = withGuard('settings:update', _PUT);
