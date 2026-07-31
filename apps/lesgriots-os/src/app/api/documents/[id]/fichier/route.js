/**
 * /api/documents/:id/fichier — relire une pièce déposée.
 *
 * Les scans portent des signatures manuscrites et des noms d'apprenants.
 * Ils vivent hors de public/, et cette route est leur seule porte, derrière
 * l'authentification.
 */

import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { trouverFichier } from '@/lib/archives.mjs';

async function _GET(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    if (!doc) return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 });

    const trouve = await trouverFichier(doc);
    if (!trouve) return NextResponse.json({ error: 'Le fichier n’est plus sur le disque.' }, { status: 410 });

    const nom = `${String(doc.libelle || 'document')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'document'}${trouve.extension}`;

    return new NextResponse(await fs.readFile(trouve.chemin), {
      headers: {
        'Content-Type': trouve.mime,
        'Content-Disposition': `inline; filename="${nom}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('sessions:read', _GET);
