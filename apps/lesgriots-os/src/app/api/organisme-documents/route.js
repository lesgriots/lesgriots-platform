/**
 * /api/organisme-documents — pièces officielles de l'organisme de formation.
 *
 * Kbis, déclaration d'activité, certificat Qualiopi, assurance RC pro,
 * attestation de vigilance URSSAF… Ces pièces ont une durée de validité :
 * le rôle de ce module est de prévenir AVANT la péremption, et d'alimenter
 * le volet « Organisme » du dossier d'audit.
 *
 * Le fichier n'est pas stocké en base : on garde une référence (chemin,
 * URL de coffre-fort ou numéro de pièce).
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { randomUUID } from 'crypto';
import { withGuard } from '@/lib/api-guard';

// Seuil d'alerte : une pièce qui expire dans moins de 60 jours doit être
// renouvelée maintenant (un Kbis ou une attestation URSSAF met des semaines).
export const SEUIL_ALERTE_JOURS = 60;

function joursRestants(expire_le) {
  if (!expire_le) return null;
  const fin = new Date(expire_le + 'T00:00:00');
  if (Number.isNaN(fin.getTime())) return null;
  const auj = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00');
  return Math.round((fin - auj) / 86400000);
}

// Statut lisible, calculé et jamais stocké (il change tout seul avec le temps).
function statutDe(jours) {
  if (jours === null) return 'permanent';
  if (jours < 0) return 'expire';
  if (jours <= SEUIL_ALERTE_JOURS) return 'bientot';
  return 'valide';
}

async function _GET(req) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const avecArchives = searchParams.get('archives') === '1';

    const rows = db.prepare(`
      SELECT * FROM organisme_documents
      ${avecArchives ? '' : 'WHERE archived = 0'}
      ORDER BY
        CASE WHEN expire_le = '' THEN 1 ELSE 0 END,
        expire_le ASC,
        libelle ASC
    `).all();

    const items = rows.map((d) => {
      const jours = joursRestants(d.expire_le);
      return { ...d, jours_restants: jours, statut: statutDe(jours) };
    });

    const stats = {
      total: items.length,
      expires: items.filter((d) => d.statut === 'expire').length,
      bientot: items.filter((d) => d.statut === 'bientot').length,
    };

    return NextResponse.json({ items, stats, seuil_jours: SEUIL_ALERTE_JOURS });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _POST(req) {
  try {
    const db = getDb();
    const body = await req.json();
    const {
      type = 'autre', libelle = '', reference = '', emis_le = '',
      expire_le = '', emetteur = '', fichier = '', notes = '',
      indicator = null,
    } = body;

    if (!libelle) return NextResponse.json({ error: 'libelle requis' }, { status: 400 });

    const id = randomUUID();
    db.prepare(`
      INSERT INTO organisme_documents
        (id, type, libelle, reference, emis_le, expire_le, emetteur, fichier, notes, indicator)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, type, libelle, reference, emis_le, expire_le, emetteur, fichier, notes,
      indicator === null || indicator === '' ? null : Number(indicator));

    return NextResponse.json(
      db.prepare('SELECT * FROM organisme_documents WHERE id = ?').get(id),
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('organisme:read', _GET);
export const POST = withGuard('organisme:create', _POST);
