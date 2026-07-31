/**
 * /api/formations/completude — à combien de pour cent chaque programme est
 * prêt à être publié.
 *
 * Onze mentions sont attendues sur un programme de formation. Ce n'est pas
 * une note de qualité : l'indicateur ne dit pas si le texte est bon, il dit
 * s'il existe. C'est déjà ce qui manquait le plus, et c'est ce qu'un auditeur
 * regarde en premier.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { completudeFormations } from '@/lib/programme-donnees.mjs';

async function _GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const lignes = completudeFormations(getDb(), {
      inclureArchives: searchParams.get('archives') === '1',
    });
    const publiables = lignes.filter((l) => l.publiable).length;
    return NextResponse.json({
      programmes: lignes,
      total: lignes.length,
      publiables,
      moyenne: lignes.length
        ? Math.round(lignes.reduce((t, l) => t + l.pourcentage, 0) / lignes.length)
        : 0,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('formations:read', _GET);
