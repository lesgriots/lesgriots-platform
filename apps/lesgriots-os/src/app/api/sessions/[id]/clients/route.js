/**
 * /api/sessions/[id]/clients — les payeurs d'une session.
 *
 * Une session inter-entreprises a plusieurs clients, chacun avec son prix,
 * son bon de commande et ses cases de BPF. Le champ `client_id` unique de la
 * table sessions ne pouvait pas représenter ça.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

export const CHAMPS = [
  'client_id', 'commercial', 'nb_apprenants_devis',
  'tarif_special', 'type_prix', 'description_prix', 'mode_facturation', 'prix', 'tva',
  'code_client_comptable', 'bon_commande',
  'sous_traitance', 'dispositif_recherche_emploi', 'bpf_autres_produits', 'bpf_autres_apprenants',
  'financeur_id', 'subrogation', 'montant_finance', 'notes',
];

async function _GET(request, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const items = db.prepare(`
      SELECT sc.*, c.company AS client_nom, c.siret AS client_siret,
             f.nom AS financeur_nom, f.type AS financeur_type
      FROM session_clients sc
      LEFT JOIN clients c ON c.id = sc.client_id
      LEFT JOIN financeurs f ON f.id = sc.financeur_id
      WHERE sc.session_id = ?
      ORDER BY sc.created_at ASC
    `).all(id);
    return NextResponse.json(items);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _POST(request, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const corps = await request.json();
    const scId = `sc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const presents = CHAMPS.filter((c) => c in corps);
    const colonnes = ['id', 'session_id', ...presents];
    const valeurs = [scId, id, ...presents.map((c) => corps[c])];
    db.prepare(`INSERT INTO session_clients (${colonnes.join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})`).run(...valeurs);
    return NextResponse.json(db.prepare('SELECT * FROM session_clients WHERE id = ?').get(scId), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('sessions:read', _GET);
export const POST = withGuard('sessions:update', _POST);
