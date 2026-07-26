/**
 * /api/factures — suivi du paiement (cahier des charges § 13).
 *
 * Trois notions que la simple génération de PDF ne couvrait pas :
 *   · le RETARD, calculé à partir de l'échéance (jamais stocké : il change
 *     tout seul avec le temps) ;
 *   · le PAIEMENT PARTIEL, via le montant encaissé ;
 *   · le PAYEUR TIERS et la SUBROGATION — chez un OF, ce n'est pas l'apprenant
 *     qui paie dans la majorité des cas, et on ne relance pas la même personne.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

function numeroSuivant(db, annee) {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM factures WHERE numero LIKE ?`)
    .get(`FAC-${annee}-%`);
  return `FAC-${annee}-${String((row?.n || 0) + 1).padStart(4, '0')}`;
}

function etatPaiement(f, auj) {
  if (['annulee', 'brouillon'].includes(f.statut)) return f.statut;
  const du = f.montant_ttc || 0;
  const paye = f.montant_paye || 0;
  if (paye >= du && du > 0) return 'payee';
  if (paye > 0) return 'partiellement_payee';
  if (f.date_echeance && f.date_echeance < auj) return 'retard';
  return f.statut;
}

async function _GET() {
  try {
    const db = getDb();
    const auj = new Date().toISOString().slice(0, 10);
    const rows = db.prepare(`
      SELECT f.*, c.name AS client_nom,
             a.first_name AS apprenant_prenom, a.last_name AS apprenant_nom
      FROM factures f
      LEFT JOIN clients c    ON c.id = f.client_id
      LEFT JOIN apprenants a ON a.id = f.apprenant_id
      ORDER BY f.date_emission DESC, f.created_at DESC
    `).all();

    const items = rows.map((f) => {
      const etat = etatPaiement(f, auj);
      const reste = Math.max(0, (f.montant_ttc || 0) - (f.montant_paye || 0));
      const retard = etat === 'retard' && f.date_echeance
        ? Math.round((new Date(auj) - new Date(f.date_echeance)) / 86400000)
        : 0;
      return { ...f, statut_effectif: etat, reste_a_payer: reste, jours_retard: retard };
    });

    const encours = items.filter((f) => !['payee', 'annulee', 'brouillon'].includes(f.statut_effectif));
    return NextResponse.json({
      items,
      stats: {
        total: items.length,
        ca_emis: items.filter((f) => f.statut_effectif !== 'annulee')
          .reduce((s, f) => s + (f.montant_ht || 0), 0),
        ca_encaisse: items.reduce((s, f) => s + (f.montant_paye || 0), 0),
        en_attente: encours.length,
        reste_a_encaisser: encours.reduce((s, f) => s + f.reste_a_payer, 0),
        en_retard: items.filter((f) => f.statut_effectif === 'retard').length,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _POST(req) {
  try {
    const db = getDb();
    const b = await req.json();
    const { objet = '', montant_ht = 0, tva_rate = 0, devis_id = null, client_id = null,
      session_id = null, apprenant_id = null, payeur_type = 'apprenant',
      subrogation = 0, date_echeance = '', fichier = '', notes = '' } = b;

    if (!objet) return NextResponse.json({ error: 'objet requis' }, { status: 400 });

    const ht = Number(montant_ht) || 0;
    const tva = Number(tva_rate) || 0;
    const emission = b.date_emission || new Date().toISOString().slice(0, 10);
    const id = randomUUID();

    // Échéance par défaut à 30 jours : le délai usuel entre OF et financeur.
    const echeance = date_echeance
      || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    db.prepare(`
      INSERT INTO factures (id, numero, devis_id, client_id, session_id, apprenant_id,
        objet, montant_ht, tva_rate, montant_ttc, payeur_type, subrogation,
        date_emission, date_echeance, fichier, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, numeroSuivant(db, emission.slice(0, 4)), devis_id, client_id, session_id,
      apprenant_id, objet, ht, tva, Math.round(ht * (1 + tva / 100) * 100) / 100,
      payeur_type, subrogation ? 1 : 0, emission, echeance, fichier, notes);

    return NextResponse.json(db.prepare('SELECT * FROM factures WHERE id = ?').get(id), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('factures:read', _GET);
export const POST = withGuard('factures:write', _POST);
