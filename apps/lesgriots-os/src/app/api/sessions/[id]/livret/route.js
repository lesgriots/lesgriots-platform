/**
 * /api/sessions/:id/livret — le livret d'accueil de la session, en PDF.
 *
 * Le livret est de session, pas nominatif : le même pour tous les inscrits.
 */

import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { rendre } from '@/lib/rendre-modele.mjs';
import { construireLivret } from '@/lib/documents-accueil.mjs';

const MODELE = path.join(process.cwd(), `resources/template-studio/geist-mono/source/Livret d'Accueil.dc.html`);

const nomFichier = (t) => `${String(t || 'document')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  .slice(0, 60) || 'document'}.pdf`;

async function _GET(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const valeurs = construireLivret(db, id);

    const sortie = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'livret-')), 'livret.pdf');
    await rendre(MODELE, valeurs, sortie);
    const pdf = await fs.readFile(sortie);
    await fs.rm(path.dirname(sortie), { recursive: true, force: true });

    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nomFichier('Livret d accueil')}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('sessions:read', _GET);
