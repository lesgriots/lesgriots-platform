/**
 * /api/sessions/:id/convocation — la convocation nominative, en PDF.
 *
 * `apprenant_id` optionnel : sans lui, la convocation part pour le premier
 * inscrit, ce qui sert d'aperçu depuis la fiche de session.
 */

import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { rendre } from '@/lib/rendre-modele.mjs';
import { construireConvocation } from '@/lib/documents-accueil.mjs';

const MODELE = path.join(process.cwd(), 'resources/template-studio/geist-mono/source/Convocation.dc.html');

const nomFichier = (t) => `${String(t || 'document')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  .slice(0, 60) || 'document'}.pdf`;

async function _GET(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const valeurs = construireConvocation(db, id, searchParams.get('apprenant_id'));
    const qui = valeurs._apprenant;
    delete valeurs._apprenant;

    const sortie = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'convocation-')), 'convocation.pdf');
    await rendre(MODELE, valeurs, sortie);
    const pdf = await fs.readFile(sortie);
    await fs.rm(path.dirname(sortie), { recursive: true, force: true });

    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nomFichier(`Convocation ${valeurs.titre} ${qui ? `${qui.first_name} ${qui.last_name}` : ''}`)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('sessions:read', _GET);
