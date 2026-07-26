/**
 * /api/reclamations — registre des réclamations, incidents et suggestions.
 *
 * Indicateur 31 du RNQ (traitement des aléas et réclamations) : l'auditeur
 * attend un registre daté et la trace du traitement de chaque entrée.
 * Un registre vide mais tenu est recevable ; un registre inexistant, non.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

// Référence lisible et stable : REC-2026-0001 (compteur par année civile).
function nextReference(db, annee) {
  const row = db.prepare(
    `SELECT COUNT(*) AS n FROM reclamations WHERE reference LIKE ?`
  ).get(`REC-${annee}-%`);
  return `REC-${annee}-${String((row?.n || 0) + 1).padStart(4, '0')}`;
}

async function _GET(req) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const statut = searchParams.get('statut');

    const where = statut ? 'WHERE r.statut = ?' : '';
    const args = statut ? [statut] : [];

    const items = db.prepare(`
      SELECT r.*,
             s.titre  AS session_titre,
             a.nom    AS apprenant_nom,
             a.prenom AS apprenant_prenom
      FROM reclamations r
      LEFT JOIN sessions   s ON s.id = r.session_id
      LEFT JOIN apprenants a ON a.id = r.apprenant_id
      ${where}
      ORDER BY r.recue_le DESC, r.created_at DESC
    `).all(...args);

    // Compteurs pour le bandeau et les alertes du cockpit.
    const stats = db.prepare(`
      SELECT
        COUNT(*)                                                   AS total,
        SUM(CASE WHEN statut IN ('ouverte','en_cours') THEN 1 ELSE 0 END) AS en_cours,
        SUM(CASE WHEN gravite = 'critique' AND statut IN ('ouverte','en_cours') THEN 1 ELSE 0 END) AS critiques
      FROM reclamations
    `).get();

    return NextResponse.json({ items, stats });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _POST(req) {
  try {
    const db = getDb();
    const body = await req.json();
    const {
      nature = 'reclamation', origine = 'apprenant', canal = '',
      auteur_nom = '', auteur_email = '', objet = '', description = '',
      gravite = 'mineure', analyse = '', action_corrective = '',
      responsable = '', session_id = null, apprenant_id = null,
      recue_le = '',
    } = body;

    if (!objet) return NextResponse.json({ error: 'objet requis' }, { status: 400 });

    const date = recue_le || new Date().toISOString().slice(0, 10);
    const id = randomUUID();
    const reference = nextReference(db, date.slice(0, 4));

    db.prepare(`
      INSERT INTO reclamations
        (id, reference, nature, origine, canal, auteur_nom, auteur_email,
         objet, description, gravite, analyse, action_corrective, responsable,
         session_id, apprenant_id, recue_le)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, reference, nature, origine, canal, auteur_nom, auteur_email,
      objet, description, gravite, analyse, action_corrective, responsable,
      session_id || null, apprenant_id || null, date);

    const item = db.prepare('SELECT * FROM reclamations WHERE id = ?').get(id);
    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('qualite:read', _GET);
export const POST = withGuard('qualite:create', _POST);
