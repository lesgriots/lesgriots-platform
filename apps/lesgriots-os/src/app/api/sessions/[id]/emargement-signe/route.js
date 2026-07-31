/**
 * /api/sessions/:id/emargement-signe — archiver la feuille signée.
 *
 * Une feuille d'émargement signée au stylo n'existe, pour un contrôle, que si
 * on peut la ressortir. Le cycle en présentiel est donc : on imprime, on fait
 * signer, on scanne, et on dépose le scan ici. Le fichier est rangé sur le
 * disque hors dépôt Git, dans data/archives, qui est le seul endroit que le
 * service a le droit d'écrire et que la sauvegarde nocturne emporte.
 *
 *   POST …/emargement-signe   multipart, champ « fichier »
 *   GET  …/emargement-signe   la liste de ce qui est archivé
 *
 * Le fichier lui-même se relit par /api/documents/:id/fichier, derrière la
 * même authentification : rien de ce qui porte une signature d'apprenant ne
 * doit être servi en clair sur une URL devinable.
 */

import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

const RACINE = path.join(process.cwd(), 'data', 'archives');

/** Ce qu'un scan peut être, et rien d'autre. */
const TYPES = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/heic': '.heic',
  'image/webp': '.webp',
};

const TAILLE_MAX = 25 * 1024 * 1024;

const jourFr = () => new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

async function _POST(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;

    const session = db.prepare('SELECT id, code_interne FROM sessions WHERE id = ?').get(id);
    if (!session) return NextResponse.json({ error: 'Session introuvable.' }, { status: 404 });

    const formulaire = await req.formData();
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

    // Le nom sur le disque ne vient jamais du client : il est tiré au sort.
    // Le nom d'origine est conservé dans les notes, pour l'humain.
    const documentId = crypto.randomUUID();
    const dossier = path.join(RACINE, id);
    await fs.mkdir(dossier, { recursive: true });
    await fs.writeFile(path.join(dossier, `${documentId}${extension}`), octets);

    const libelle = String(formulaire.get('libelle') || '').trim()
      || `Feuille d’émargement signée · ${jourFr()}`;

    const rang = db.prepare(`
      SELECT COUNT(*) AS n FROM documents
      WHERE categorie = 'emargement' AND signe = 1 AND contexte_id = ?
    `).get(id)?.n || 0;

    db.prepare(`
      INSERT INTO documents (id, categorie, libelle, fichier, contexte_type, contexte_id,
                             version, signe, notes)
      VALUES (?, 'emargement', ?, ?, 'session', ?, ?, 1, ?)
    `).run(
      documentId,
      libelle,
      `/api/documents/${documentId}/fichier`,
      id,
      rang + 1,
      `Scan déposé · ${String(fichier.name || 'sans nom').slice(0, 120)} · ${Math.round(octets.length / 1024)} Ko`,
    );

    const cree = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
    return NextResponse.json(cree, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _GET(req, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const items = db.prepare(`
      SELECT * FROM documents
      WHERE categorie = 'emargement' AND signe = 1 AND contexte_id = ? AND archived = 0
      ORDER BY created_at DESC
    `).all(id);
    return NextResponse.json(items);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withGuard('sessions:write', _POST);
export const GET = withGuard('sessions:read', _GET);
