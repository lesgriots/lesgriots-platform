/**
 * /api/public/document/[id]?token=… — remettre une pièce à qui la porte.
 *
 * Il manquait. L'espace apprenant affichait « Télécharger » depuis le premier
 * jour, et le lien pointait vers /api/documents/[id], une route qui n'a pas
 * de GET et qui, de toute façon, exige une session. L'apprenant recevait donc
 * un 401 en JSON. Le bouton existait, la porte n'existait pas.
 *
 * Ici, le jeton vaut l'identité et `pieceAutorisee` décide seul de ce qui
 * sort. La route ne fait aucun tri par elle-même : deux règles séparées, ce
 * sont deux règles qui divergent.
 */
import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import { getDb } from '@/lib/db.mjs';
import { trouverFichier } from '@/lib/archives.mjs';
import { resoudreJeton, pieceAutorisee } from '@/lib/espace-jetons.mjs';

const nomDeFichier = (doc, extension) => `${String(doc.libelle || doc.categorie || 'document')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  .slice(0, 60) || 'document'}${extension}`;

export async function GET(request, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const token = new URL(request.url).searchParams.get('token');

    const scope = resoudreJeton(db, token);
    // Une pièce absente et une pièce interdite répondent la même chose : sinon
    // la route confirme l'existence d'un document à qui n'y a pas droit.
    const refus = () => NextResponse.json({ error: 'Document indisponible.' }, { status: 404 });
    if (!scope) return refus();

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    if (!doc || !pieceAutorisee(db, scope, doc)) return refus();

    const trouve = await trouverFichier(doc);
    if (!trouve) {
      return NextResponse.json(
        { error: 'Ce document n’est plus disponible en ligne. Écrivez-nous, nous vous le renvoyons.' },
        { status: 410 },
      );
    }

    return new NextResponse(await fs.readFile(trouve.chemin), {
      headers: {
        'Content-Type': trouve.mime,
        'Content-Disposition': `inline; filename="${nomDeFichier(doc, trouve.extension)}"`,
        // Une pièce nominative ne se met pas en cache partagé.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[public/document]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
