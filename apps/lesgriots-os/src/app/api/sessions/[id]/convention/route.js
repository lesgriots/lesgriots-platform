/**
 * /api/sessions/:id/convention — la convention de formation, en PDF.
 *
 * Le document est celui de la SASU LES GRIOTS : contrat sobre, onze articles,
 * annexe programme. Il vaut pour la session entière, pas pour un apprenant ;
 * apprenant_id est accepté mais ignoré, pour ne pas casser les liens archivés.
 */

import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { rendre } from '@/lib/rendre-modele.mjs';
import { construireConvention } from '@/lib/convention-donnees.mjs';

const MODELE = path.join(process.cwd(), 'resources/template-studio/geist-mono/source/Convention.dc.html');

const nomFichier = (t) => `${String(t || 'document')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  .slice(0, 60) || 'document'}.pdf`;

async function _GET(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const valeurs = construireConvention(db, id);

    const sortie = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'convention-')), 'convention.pdf');
    await rendre(MODELE, valeurs, sortie);
    const pdf = await fs.readFile(sortie);
    await fs.rm(path.dirname(sortie), { recursive: true, force: true });

    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nomFichier(`Convention ${valeurs.numero}`)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('sessions:read', _GET);
