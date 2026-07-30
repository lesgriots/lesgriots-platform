/**
 * /api/data — le jeu de données commun aux écrans hérités de l'agence.
 *
 * Trois écrans l'appelaient : la liste des clients, la fiche d'un client et
 * les réglages. La route n'existait pas. La liste affichait donc « impossible
 * de charger les clients » et « 0 client » alors que la base en contient
 * plusieurs, et les réglages perdaient leurs compteurs.
 *
 * Ces écrans attendent un seul objet plutôt que quatre appels ; on le leur
 * rend, en lisant les mêmes tables que les routes déjà en place. Aucune
 * logique nouvelle : c'est un raccord, pas une fonctionnalité.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

/** Une table peut manquer selon l'âge de la base : on ne casse pas pour ça. */
function lire(db, requete) {
  try { return db.prepare(requete).all(); }
  catch (e) { console.warn('[api/data] lecture ignorée :', e.message); return []; }
}

async function _GET() {
  try {
    const db = getDb();
    return NextResponse.json({
      clients: lire(db, 'SELECT * FROM clients ORDER BY company COLLATE NOCASE ASC'),
      projects: lire(db, 'SELECT * FROM projects ORDER BY created_at DESC'),
      providers: lire(db, 'SELECT * FROM providers ORDER BY name COLLATE NOCASE ASC'),
      tasks: lire(db, 'SELECT * FROM tasks ORDER BY created_at DESC'),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('clients:read', _GET);
