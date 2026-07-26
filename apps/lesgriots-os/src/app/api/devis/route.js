/**
 * /api/devis — suivi du cycle de vie des devis (cahier des charges § 12).
 *
 * L'OS générait déjà les PDF ; ce qui manquait, c'est de savoir ce qu'ils
 * deviennent. Statuts : brouillon → envoyé → consulté → accepté / refusé,
 * plus « expiré » quand la date de validité est dépassée sans réponse.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

function numeroSuivant(db, table, prefixe, annee) {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE numero LIKE ?`)
    .get(`${prefixe}-${annee}-%`);
  return `${prefixe}-${annee}-${String((row?.n || 0) + 1).padStart(4, '0')}`;
}

// Un devis dont la validité est passée sans réponse est périmé de fait :
// on le calcule à l'affichage plutôt que de dépendre d'une tâche planifiée.
function statutEffectif(d, aujourdhui) {
  if (d.statut === 'envoye' || d.statut === 'consulte') {
    if (d.valide_jusqu_au && d.valide_jusqu_au < aujourdhui) return 'expire';
  }
  return d.statut;
}

async function _GET() {
  try {
    const db = getDb();
    const auj = new Date().toISOString().slice(0, 10);
    const rows = db.prepare(`
      SELECT d.*, c.name AS client_nom
      FROM devis d
      LEFT JOIN clients c ON c.id = d.client_id
      ORDER BY d.date_emission DESC, d.created_at DESC
    `).all();

    const items = rows.map((d) => ({ ...d, statut_effectif: statutEffectif(d, auj) }));
    const enAttente = items.filter((d) => ['envoye', 'consulte'].includes(d.statut_effectif));
    const acceptes = items.filter((d) => d.statut_effectif === 'accepte');

    return NextResponse.json({
      items,
      stats: {
        total: items.length,
        en_attente: enAttente.length,
        montant_en_attente: enAttente.reduce((s, d) => s + (d.montant_ht || 0), 0),
        acceptes: acceptes.length,
        montant_accepte: acceptes.reduce((s, d) => s + (d.montant_ht || 0), 0),
        // Taux de transformation : accepté / (accepté + refusé + expiré).
        // On exclut les devis encore en attente, qui ne sont pas un échec.
        taux_conversion: (() => {
          const tranches = items.filter((d) =>
            ['accepte', 'refuse', 'expire'].includes(d.statut_effectif));
          return tranches.length
            ? Math.round((acceptes.length / tranches.length) * 100)
            : null;
        })(),
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
    const { objet = '', montant_ht = 0, tva_rate = 0, client_id = null,
      session_id = null, formation_id = null, apprenant_id = null,
      valide_jusqu_au = '', fichier = '', notes = '' } = b;

    if (!objet) return NextResponse.json({ error: 'objet requis' }, { status: 400 });

    const ht = Number(montant_ht) || 0;
    const tva = Number(tva_rate) || 0;
    const id = randomUUID();
    const emission = b.date_emission || new Date().toISOString().slice(0, 10);

    db.prepare(`
      INSERT INTO devis (id, numero, client_id, session_id, formation_id, apprenant_id,
        objet, montant_ht, tva_rate, montant_ttc, date_emission, valide_jusqu_au, fichier, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, numeroSuivant(db, 'devis', 'DEV', emission.slice(0, 4)),
      client_id, session_id, formation_id, apprenant_id,
      objet, ht, tva, Math.round(ht * (1 + tva / 100) * 100) / 100,
      emission, valide_jusqu_au, fichier, notes);

    return NextResponse.json(db.prepare('SELECT * FROM devis WHERE id = ?').get(id), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('devis:read', _GET);
export const POST = withGuard('devis:write', _POST);
