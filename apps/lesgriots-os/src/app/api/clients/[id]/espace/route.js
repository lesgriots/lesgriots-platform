/**
 * /api/clients/[id]/espace — le lien permanent de l'espace entreprise.
 *
 * Un lien par entreprise, créé au premier appel et stable ensuite : c'est
 * celui qu'on colle dans un mail au service RH, et qui doit encore marcher
 * six mois plus tard quand il le retrouve dans sa boîte. Le lien court, lui,
 * se demande depuis /entreprise.
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

const BASE = process.env.NEXTAUTH_URL || 'https://app.lagriotheque.com';

async function _GET(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(id);
    if (!client) return NextResponse.json({ error: 'Entreprise introuvable' }, { status: 404 });

    let lien = db.prepare('SELECT token FROM espace_entreprise_liens WHERE client_id = ?').get(id);
    if (!lien) {
      const token = crypto.randomBytes(24).toString('hex');
      db.prepare('INSERT INTO espace_entreprise_liens (id, token, client_id) VALUES (?, ?, ?)')
        .run(`el_${crypto.randomBytes(6).toString('hex')}`, token, id);
      lien = { token };
    }
    return NextResponse.json({ token: lien.token, url: `${BASE}/e/${lien.token}` });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** Le lien a fuité, ou le contact a changé : on le remplace, l'ancien meurt. */
async function _POST(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare('DELETE FROM espace_entreprise_liens WHERE client_id = ?').run(id);
    db.prepare('INSERT INTO espace_entreprise_liens (id, token, client_id) VALUES (?, ?, ?)')
      .run(`el_${crypto.randomBytes(6).toString('hex')}`, token, id);
    return NextResponse.json({ token, url: `${BASE}/e/${token}` });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('clients:read', _GET);
export const POST = withGuard('clients:update', _POST);
