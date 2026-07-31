/**
 * /api/sessions/:id/pieces-signees — déposer une pièce signée à la main.
 *
 * Tant qu'on ne fait pas signer électroniquement, la convention, le devis et
 * la feuille d'émargement reviennent en papier. Cette route est l'endroit où
 * ils rentrent : le scan rejoint le registre de la session, daté et
 * versionné, à côté des documents que l'OS produit lui-même.
 *
 *   POST …/pieces-signees   multipart : « fichier », « categorie »
 *   GET  …/pieces-signees   la liste, filtrable par ?categorie=
 *
 * La suppression passe par DELETE /api/documents/:id, qui efface aussi le
 * fichier : un scan illisible ou déposé au mauvais endroit n'a aucune valeur
 * de preuve, il n'y a rien à conserver.
 */

import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { CATEGORIES, TYPES, TAILLE_MAX, dossier } from '@/lib/archives.mjs';

const jourFr = () => new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

async function _POST(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;

    if (!db.prepare('SELECT id FROM sessions WHERE id = ?').get(id)) {
      return NextResponse.json({ error: 'Session introuvable.' }, { status: 404 });
    }

    const formulaire = await req.formData();

    const categorie = String(formulaire.get('categorie') || 'emargement');
    if (!CATEGORIES[categorie]) {
      return NextResponse.json({
        error: `Catégorie inconnue (${categorie}). Attendu : ${Object.keys(CATEGORIES).join(', ')}.`,
      }, { status: 400 });
    }

    const fichier = formulaire.get('fichier');
    if (!fichier || typeof fichier.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Aucun fichier reçu.' }, { status: 400 });
    }

    const extension = TYPES[fichier.type];
    if (!extension) {
      return NextResponse.json({
        error: `Format non accepté (${fichier.type || 'inconnu'}). Dépose un PDF ou une photo.`,
      }, { status: 415 });
    }

    const octets = Buffer.from(await fichier.arrayBuffer());
    if (!octets.length) return NextResponse.json({ error: 'Le fichier est vide.' }, { status: 400 });
    if (octets.length > TAILLE_MAX) {
      return NextResponse.json({
        error: `Le fichier fait ${Math.round(octets.length / 1024 / 1024)} Mo, la limite est de 25 Mo.`,
      }, { status: 413 });
    }

    const documentId = crypto.randomUUID();
    const cible = dossier(id);
    await fs.mkdir(cible, { recursive: true });
    await fs.writeFile(path.join(cible, `${documentId}${extension}`), octets);

    const libelle = String(formulaire.get('libelle') || '').trim()
      || `${CATEGORIES[categorie]} · ${jourFr()}`;

    const rang = db.prepare(`
      SELECT COUNT(*) AS n FROM documents
      WHERE categorie = ? AND signe = 1 AND contexte_id = ?
    `).get(categorie, id)?.n || 0;

    db.prepare(`
      INSERT INTO documents (id, categorie, libelle, fichier, contexte_type, contexte_id,
                             version, signe, notes)
      VALUES (?, ?, ?, ?, 'session', ?, ?, 1, ?)
    `).run(
      documentId,
      categorie,
      libelle,
      `/api/documents/${documentId}/fichier`,
      id,
      rang + 1,
      `Scan déposé · ${String(fichier.name || 'sans nom').slice(0, 120)} · ${Math.round(octets.length / 1024)} Ko`,
    );

    return NextResponse.json(db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _GET(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const categorie = new URL(req.url).searchParams.get('categorie');
    const items = categorie
      ? db.prepare(`SELECT * FROM documents WHERE signe = 1 AND archived = 0 AND contexte_id = ? AND categorie = ?
                    ORDER BY created_at DESC`).all(id, categorie)
      : db.prepare(`SELECT * FROM documents WHERE signe = 1 AND archived = 0 AND contexte_id = ?
                    ORDER BY created_at DESC`).all(id);
    return NextResponse.json(items);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withGuard('sessions:update', _POST);
export const GET = withGuard('sessions:read', _GET);
