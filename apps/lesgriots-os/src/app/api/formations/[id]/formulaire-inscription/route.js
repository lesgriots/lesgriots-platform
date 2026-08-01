/**
 * /api/formations/:id/formulaire-inscription — les questions posées à
 * l'inscription, et ce qui se passe une fois le formulaire envoyé.
 *
 * Défini sur le programme : toutes ses sessions en héritent. Tant que rien
 * n'est écrit, la route renvoie le formulaire par défaut, en le disant.
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { formulaireDeFormation, assainir, assainirSuite, SOCLE, TYPES } from '@/lib/formulaire-inscription.mjs';

async function _GET(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const { champs, suite, personnalise } = formulaireDeFormation(db, id);
    return NextResponse.json({ champs, suite, personnalise, socle: SOCLE, types: TYPES });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _PUT(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    if (!db.prepare('SELECT id FROM formations WHERE id = ?').get(id)) {
      return NextResponse.json({ error: 'Programme introuvable.' }, { status: 404 });
    }
    const corps = await req.json();
    const champs = assainir(corps?.champs);
    const suite = assainirSuite(corps?.suite);

    db.prepare(`
      INSERT INTO formulaires_inscription (formation_id, champs, suite, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(formation_id) DO UPDATE
        SET champs = excluded.champs, suite = excluded.suite, updated_at = datetime('now')
    `).run(id, JSON.stringify(champs), JSON.stringify(suite));

    return NextResponse.json({ champs, suite, personnalise: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('formations:read', _GET);
export const PUT = withGuard('formations:update', _PUT);
