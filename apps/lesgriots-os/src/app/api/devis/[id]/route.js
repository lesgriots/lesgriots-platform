/**
 * /api/devis/[id] — changement de statut et mise à jour.
 *
 * Les dates de suivi s'horodatent toutes seules : passer à « envoyé » pose la
 * date d'envoi, passer à « accepté » ou « refusé » pose la date de réponse.
 * C'est ce qui permet de mesurer un délai de décision sans double saisie.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

const CHAMPS = ['objet', 'montant_ht', 'tva_rate', 'statut', 'client_id', 'session_id',
  'formation_id', 'apprenant_id', 'date_emission', 'date_envoi', 'date_reponse',
  'valide_jusqu_au', 'fichier', 'notes'];

async function _PATCH(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const b = await req.json();
    const avant = db.prepare('SELECT * FROM devis WHERE id = ?').get(id);
    if (!avant) return NextResponse.json({ error: 'introuvable' }, { status: 404 });

    const sets = [], args = [];
    for (const c of CHAMPS) {
      if (b[c] === undefined) continue;
      sets.push(`${c} = ?`); args.push(b[c] === null ? null : b[c]);
    }

    const auj = new Date().toISOString().slice(0, 10);
    if (b.statut === 'envoye' && !avant.date_envoi && !b.date_envoi) {
      sets.push('date_envoi = ?'); args.push(auj);
    }
    if (['accepte', 'refuse'].includes(b.statut) && !avant.date_reponse && !b.date_reponse) {
      sets.push('date_reponse = ?'); args.push(auj);
    }

    // Le TTC se recalcule dès que le HT ou la TVA bouge : jamais saisi à la main.
    if (b.montant_ht !== undefined || b.tva_rate !== undefined) {
      const ht = Number(b.montant_ht ?? avant.montant_ht) || 0;
      const tva = Number(b.tva_rate ?? avant.tva_rate) || 0;
      sets.push('montant_ttc = ?'); args.push(Math.round(ht * (1 + tva / 100) * 100) / 100);
    }

    if (!sets.length) return NextResponse.json(avant);
    sets.push("updated_at = datetime('now')");
    args.push(id);
    db.prepare(`UPDATE devis SET ${sets.join(', ')} WHERE id = ?`).run(...args);
    return NextResponse.json(db.prepare('SELECT * FROM devis WHERE id = ?').get(id));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _DELETE(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const r = db.prepare('DELETE FROM devis WHERE id = ?').run(id);
    if (!r.changes) return NextResponse.json({ error: 'introuvable' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const PATCH = withGuard('devis:write', _PATCH);
export const DELETE = withGuard('devis:write', _DELETE);
