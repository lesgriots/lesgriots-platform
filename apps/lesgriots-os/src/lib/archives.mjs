/**
 * archives.mjs — les pièces déposées à la main.
 *
 * Tant qu'il n'y a pas de signature électronique, la boucle se referme au
 * scanner : on imprime, on fait signer, on scanne, on dépose. Ces fichiers
 * portent des noms d'apprenants et des signatures manuscrites, donc ils ne
 * vivent pas dans public/ et ne sont jamais servis par un chemin devinable.
 *
 * Ils sont rangés sous data/archives/<session>/<id-du-document><extension> :
 * data/ est le seul dossier que le service systemd a le droit d'écrire, il
 * est hors dépôt Git, et la sauvegarde nocturne l'emporte. Le nom sur le
 * disque est l'identifiant du document, jamais le nom fourni par le client.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export const RACINE = path.join(process.cwd(), 'data', 'archives');

/** Ce qu'un scan peut être, et rien d'autre. */
export const TYPES = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/heic': '.heic',
  'image/webp': '.webp',
};

export const MIMES = Object.fromEntries(Object.entries(TYPES).map(([m, e]) => [e, m]));

export const TAILLE_MAX = 25 * 1024 * 1024;

/**
 * Les pièces qu'on accepte de recevoir, et comment on les nomme.
 *
 * La facture est arrivée dans cette liste sans être une pièce « signée » :
 * elle n'est pas produite ici. Les factures sortent de Henrri, et c'est très
 * bien ainsi, parce que la facturation électronique obligatoire demandera une
 * plateforme agréée, pas un générateur de PDF maison.
 *
 * Mais le dossier d'une session doit contenir sa facture : l'OPCO la réclame,
 * l'auditeur la cherche, et le BPF la compte. On l'accueille donc, sans
 * prétendre l'avoir émise.
 */
export const CATEGORIES = {
  emargement: 'Feuille d’émargement signée',
  convention: 'Convention signée',
  devis: 'Devis signé',
  contrat: 'Contrat signé',
  attestation: 'Attestation signée',
  facture: 'Facture',
};

export const dossier = (sessionId) => path.join(RACINE, String(sessionId || ''));

/**
 * Retrouve le fichier d'un document sur le disque. L'extension n'est pas
 * stockée en base : on essaie celles qu'on accepte, ce qui évite une
 * migration pour une information que le disque porte déjà.
 */
export async function trouverFichier(doc) {
  if (!doc?.id) return null;
  for (const extension of Object.keys(MIMES)) {
    const candidat = path.join(dossier(doc.contexte_id), `${doc.id}${extension}`);
    try { await fs.access(candidat); return { chemin: candidat, extension, mime: MIMES[extension] }; } catch { /* suivant */ }
  }
  return null;
}

/** Efface la pièce du disque. Silencieux si elle n'y était pas. */
export async function effacerFichier(doc) {
  const trouve = await trouverFichier(doc);
  if (!trouve) return false;
  await fs.rm(trouve.chemin, { force: true });
  return true;
}
