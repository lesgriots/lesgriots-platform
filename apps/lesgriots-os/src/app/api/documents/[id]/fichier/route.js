/**
 * /api/documents/:id/fichier — relire une pièce déposée.
 *
 * Les scans déposés portent des signatures manuscrites et des noms
 * d'apprenants. Ils ne sont donc jamais servis par un chemin public : le
 * fichier vit dans data/archives, hors de public/, et cette route est la
 * seule porte, derrière l'authentification.
 */

import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

const RACINE = path.join(process.cwd(), 'data', 'archives');

const MIMES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.heic': 'image/heic',
  '.webp': 'image/webp',
};

async function _GET(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    if (!doc) return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 });

    // L'identifiant vient de la base, pas de l'URL : aucun chemin ne peut
    // être fabriqué de l'extérieur. On cherche l'extension réellement posée.
    const dossier = path.join(RACINE, String(doc.contexte_id || ''));
    let trouve = null;
    for (const extension of Object.keys(MIMES)) {
      const candidat = path.join(dossier, `${id}${extension}`);
      try { await fs.access(candidat); trouve = { candidat, extension }; break; } catch { /* suivant */ }
    }
    if (!trouve) return NextResponse.json({ error: 'Le fichier n’est plus sur le disque.' }, { status: 410 });

    const octets = await fs.readFile(trouve.candidat);
    const nom = `${String(doc.libelle || 'document')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'document'}${trouve.extension}`;

    return new NextResponse(octets, {
      headers: {
        'Content-Type': MIMES[trouve.extension],
        'Content-Disposition': `inline; filename="${nom}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('sessions:read', _GET);
