/**
 * /api/formations/[id]/programme — le programme de formation, en PDF.
 *
 * Deux usages :
 *
 *   GET …/programme?controle=1   la liste des mentions manquantes, en JSON
 *   GET …/programme              le PDF, ou 409 avec la liste des manques
 *   GET …/programme?force=1      le PDF quand même, en connaissance de cause
 *
 * Le refus par défaut est délibéré. Un programme incomplet ne se voit pas :
 * il se lit comme les autres, il se transmet au client, et le trou apparaît
 * un an plus tard devant un auditeur. Mieux vaut une erreur maintenant, avec
 * l'endroit exact où aller remplir.
 */

import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { construireProgramme } from '@/lib/programme-donnees.mjs';
import { rendre } from '@/lib/rendre-modele.mjs';

const MODELE = path.join(
  process.cwd(),
  'resources/template-studio/geist-mono/source/Programme de Formation.dc.html',
);

const nomFichier = (titre) => `${String(titre || 'programme')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60) || 'programme'}.pdf`;

async function _GET(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const { searchParams } = new URL(req.url);

    const { valeurs, manques, formation } = construireProgramme(db, id);

    if (searchParams.get('controle')) {
      return NextResponse.json({
        formation: formation.title,
        complet: manques.length === 0,
        manques,
      });
    }

    if (manques.length && !searchParams.get('force')) {
      return NextResponse.json({
        error: `Ce programme ne peut pas être publié : ${manques.length} mention(s) obligatoire(s) manquante(s).`,
        manques,
        astuce: 'Ajoute ?force=1 pour produire quand même un document de travail.',
      }, { status: 409 });
    }

    const sortie = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'prog-')), 'programme.pdf');
    await rendre(MODELE, valeurs, sortie);
    const pdf = await fs.readFile(sortie);
    await fs.rm(path.dirname(sortie), { recursive: true, force: true });

    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nomFichier(formation.title)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('formations:read', _GET);
