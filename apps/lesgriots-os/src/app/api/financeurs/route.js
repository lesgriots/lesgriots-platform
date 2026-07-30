/**
 * /api/financeurs — les organismes qui paient les formations.
 *
 * Jusqu'ici, un financeur n'existait que comme mot écrit à la main sur une
 * inscription (« OPCO », « AFDAS », « prise en charge OPCO »). On ne pouvait
 * donc ni retrouver le portail de dépôt, ni la liste des pièces exigées, ni
 * le délai de paiement. Ces informations se rappellent à chaque dossier :
 * elles méritent une fiche.
 *
 * L'écran de répartition (/financeurs) continue de lire les inscriptions ;
 * ces fiches-ci sont le carnet des organismes eux-mêmes.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

export const CHAMPS = [
  'nom', 'type', 'siret', 'adresse', 'postal_code', 'ville',
  'contact_nom', 'contact_email', 'contact_tel', 'numero_adherent',
  'portail_url', 'identifiant_portail', 'pieces_exigees', 'delai_depot',
  'subrogation', 'delai_paiement', 'notes', 'actif',
];

async function _GET() {
  try {
    const db = getDb();
    const items = db.prepare('SELECT * FROM financeurs ORDER BY nom COLLATE NOCASE ASC').all();
    return NextResponse.json(items);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _POST(request) {
  try {
    const db = getDb();
    const corps = await request.json();
    if (!String(corps.nom || '').trim()) {
      return NextResponse.json({ error: 'Le nom du financeur est obligatoire.' }, { status: 400 });
    }
    const id = `fin_${Date.now()}`;
    const colonnes = ['id', ...CHAMPS.filter((c) => c in corps)];
    const valeurs = [id, ...CHAMPS.filter((c) => c in corps).map((c) => corps[c])];
    db.prepare(`INSERT INTO financeurs (${colonnes.join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})`).run(...valeurs);
    return NextResponse.json(db.prepare('SELECT * FROM financeurs WHERE id = ?').get(id), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('formations:read', _GET);
export const POST = withGuard('formations:update', _POST);
