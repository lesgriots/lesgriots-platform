/**
 * /api/documents — coffre-fort documentaire (cahier des charges § 15).
 *
 * Indexe les pièces rattachées à une entité : convention d'un apprenant,
 * émargement d'une session, CV d'un formateur, contrat d'un client. Le fichier
 * reste où il est (Drive, disque, coffre) ; ce qu'on gère ici, c'est de savoir
 * qu'il existe, où il est, dans quelle version, s'il est signé et s'il expire.
 *
 * Filtres : ?contexte_type=apprenant&contexte_id=… ou ?categorie=convention
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

const SEUIL_ALERTE_JOURS = 60;

async function _GET(req) {
  try {
    const db = getDb();
    const q = new URL(req.url).searchParams;
    const conditions = ['archived = 0'];
    const args = [];
    for (const champ of ['contexte_type', 'contexte_id', 'categorie']) {
      const v = q.get(champ);
      if (v) { conditions.push(`${champ} = ?`); args.push(v); }
    }

    const rows = db.prepare(`
      SELECT * FROM documents
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
    `).all(...args);

    const auj = new Date().toISOString().slice(0, 10);
    const items = rows.map((d) => {
      let statut = 'permanent';
      let jours = null;
      if (d.expire_le) {
        jours = Math.round((new Date(d.expire_le) - new Date(auj)) / 86400000);
        statut = jours < 0 ? 'expire' : jours <= SEUIL_ALERTE_JOURS ? 'bientot' : 'valide';
      }
      return { ...d, jours_restants: jours, statut };
    });

    return NextResponse.json({
      items,
      stats: {
        total: items.length,
        expires: items.filter((d) => d.statut === 'expire').length,
        bientot: items.filter((d) => d.statut === 'bientot').length,
        non_signes: items.filter((d) => !d.signe && ['convention', 'contrat'].includes(d.categorie)).length,
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
    const { categorie = 'autre', libelle = '', fichier = '', contexte_type = 'autre',
      contexte_id = '', expire_le = '', signe = 0, notes = '' } = b;

    if (!libelle) return NextResponse.json({ error: 'libelle requis' }, { status: 400 });

    // Versionnement automatique : un même libellé sur le même contexte
    // n'écrase rien, il crée la version suivante. On garde l'historique.
    const derniere = db.prepare(`
      SELECT MAX(version) AS v FROM documents
      WHERE libelle = ? AND contexte_type = ? AND contexte_id = ?
    `).get(libelle, contexte_type, contexte_id || '');
    const version = (derniere?.v || 0) + 1;

    const id = randomUUID();
    db.prepare(`
      INSERT INTO documents (id, categorie, libelle, fichier, contexte_type,
        contexte_id, version, expire_le, signe, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, categorie, libelle, fichier, contexte_type, contexte_id || '',
      version, expire_le, signe ? 1 : 0, notes);

    return NextResponse.json(db.prepare('SELECT * FROM documents WHERE id = ?').get(id), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('documents:read', _GET);
export const POST = withGuard('documents:write', _POST);
