/**
 * /api/factures/[id] — mise à jour, encaissement, annulation.
 *
 * Enregistrer un encaissement égal ou supérieur au dû bascule la facture en
 * « payée » et pose la date de paiement : un seul geste au lieu de trois.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

const CHAMPS = ['objet', 'montant_ht', 'tva_rate', 'montant_paye', 'statut', 'payeur_type',
  'subrogation', 'devis_id', 'client_id', 'session_id', 'apprenant_id',
  'date_emission', 'date_echeance', 'date_paiement', 'fichier', 'notes'];

async function _PATCH(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const b = await req.json();
    const avant = db.prepare('SELECT * FROM factures WHERE id = ?').get(id);
    if (!avant) return NextResponse.json({ error: 'introuvable' }, { status: 404 });

    const sets = [], args = [];
    for (const c of CHAMPS) {
      if (b[c] === undefined) continue;
      sets.push(`${c} = ?`); args.push(b[c] === null ? null : b[c]);
    }

    const ht = Number(b.montant_ht ?? avant.montant_ht) || 0;
    const tva = Number(b.tva_rate ?? avant.tva_rate) || 0;
    const ttc = Math.round(ht * (1 + tva / 100) * 100) / 100;
    if (b.montant_ht !== undefined || b.tva_rate !== undefined) {
      sets.push('montant_ttc = ?'); args.push(ttc);
    }

    // Encaissement complet → statut et date posés d'office.
    if (b.montant_paye !== undefined) {
      const paye = Number(b.montant_paye) || 0;
      const auj = new Date().toISOString().slice(0, 10);
      if (paye >= ttc && ttc > 0) {
        if (b.statut === undefined) { sets.push("statut = 'payee'"); }
        if (!avant.date_paiement && !b.date_paiement) { sets.push('date_paiement = ?'); args.push(auj); }
      } else if (paye > 0 && b.statut === undefined) {
        sets.push("statut = 'partiellement_payee'");
      }
    }

    if (!sets.length) return NextResponse.json(avant);
    sets.push("updated_at = datetime('now')");
    args.push(id);
    db.prepare(`UPDATE factures SET ${sets.join(', ')} WHERE id = ?`).run(...args);
    return NextResponse.json(db.prepare('SELECT * FROM factures WHERE id = ?').get(id));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _DELETE(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const r = db.prepare('DELETE FROM factures WHERE id = ?').run(id);
    if (!r.changes) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const PATCH = withGuard('factures:write', _PATCH);
export const DELETE = withGuard('factures:write', _DELETE);
