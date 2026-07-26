/**
 * /api/griotheque/compteurs — les trois chiffres de la barre latérale.
 *
 * Volontairement minuscule : trois COUNT, rien d'autre. La barre latérale se
 * charge sur chaque page, elle n'a pas à payer le prix de la vue d'ensemble.
 *
 * Un compteur vaut null quand il n'y a rien à signaler : l'interface
 * n'affiche alors aucune pastille, plutôt qu'un zéro qui attire l'oeil.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

const PIECES_ATTENDUES = ['kbis', 'nda', 'qualiopi', 'assurance_rc', 'urssaf'];

async function _GET() {
  try {
    const db = getDb();
    const auj = new Date().toISOString().slice(0, 10);

    const sessions = db.prepare(`
      SELECT COUNT(*) AS n FROM sessions
      WHERE start_date >= ? AND COALESCE(status,'') NOT IN ('annulee','archivee')
    `).get(auj).n;

    const apprenants = db.prepare(`SELECT COUNT(*) AS n FROM apprenants`).get().n;

    // Conformité : ce qui manque, pas ce qui va bien.
    const pieces = db.prepare(`SELECT type, expire_le FROM organisme_documents WHERE archived = 0`).all();
    const piecesManquantes = PIECES_ATTENDUES.filter((t) => {
      const p = pieces.find((x) => x.type === t);
      return !p || (p.expire_le && p.expire_le < auj);
    }).length;

    const sessionsIncompletes = db.prepare(`
      SELECT COUNT(*) AS n FROM sessions s
      WHERE s.end_date <> '' AND s.end_date < ?
        AND (
          (SELECT COUNT(*) FROM emargements e WHERE e.session_id = s.id) = 0
          OR (SELECT COUNT(*) FROM evaluations v WHERE v.session_id = s.id AND v.type='satisfaction') = 0
        )
    `).get(auj).n;

    const manques = piecesManquantes + sessionsIncompletes;

    return NextResponse.json({
      sessions: sessions || null,
      apprenants: apprenants || null,
      conformite: manques || null,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('formations:read', _GET);
