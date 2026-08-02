/**
 * documents-session.mjs — une seule fabrique par document.
 *
 * Il y avait trois portes vers le programme d'une session, et elles ne
 * donnaient pas sur la même pièce : la fiche formation servait la maquette
 * maison, la route de session servait encore l'ancien générateur Python, et
 * la route documents servait l'une ou l'autre selon le paramètre. Résultat :
 * une convocation partait avec un programme d'une génération précédente,
 * sans que rien ne le signale.
 *
 * Ce fichier est désormais l'unique fabrique. Toutes les portes appellent
 * `rendreDocumentSession`, donc elles ne peuvent plus diverger : le jour où
 * un modèle change, il change partout à la fois.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { rendre } from './rendre-modele.mjs';
import { construireProgramme } from './programme-donnees.mjs';
import { construireConvention } from './convention-donnees.mjs';
import { construireConvocation } from './documents-accueil.mjs';
import { construireEmargement } from './emargement-donnees.mjs';
import { construireDevis } from './devis-donnees.mjs';

const MODELES = path.join(process.cwd(), 'resources/template-studio/geist-mono/source');

/** Les documents qui ont une maquette maison, et comment on les remplit. */
export const FABRIQUES = {
  programme: {
    modele: 'Programme de Formation.dc.html',
    valeurs: (db, s) => {
      if (!s.formation_id) throw new Error('Cette session n’est rattachée à aucune formation.');
      return construireProgramme(db, s.formation_id).valeurs;
    },
    nom: (v, s) => `Programme_${s.formation_titre || 'formation'}`,
  },
  convention: {
    modele: 'Convention.dc.html',
    valeurs: (db, s) => construireConvention(db, s.id),
    nom: (v) => `Convention_${v.numero || ''}`,
  },
  convocation: {
    modele: 'Convocation.dc.html',
    valeurs: (db, s, o) => construireConvocation(db, s.id, o?.apprenantId || null),
    nom: (v, s) => `Convocation_${s.formation_titre || 'formation'}`,
  },
  emargement: {
    modele: 'Emargement.dc.html',
    valeurs: (db, s) => construireEmargement(db, s.id),
    nom: (v, s) => `Emargement_${s.formation_titre || 'formation'}`,
  },
  devis: {
    modele: 'Devis.dc.html',
    valeurs: (db, s) => construireDevis(db, s.id),
    nom: (v) => `Devis_${v.numero || ''}`,
  },
  livret: {
    modele: "Livret d'Accueil.dc.html",
    valeurs: (db, s) => construireEmargement && construireConvocation && null,
    nom: () => 'Livret_accueil',
  },
};
// Le livret ne se construit pas comme les autres : il n'a pas besoin de la
// session pour exister. Sa route dédiée reste sa porte.
delete FABRIQUES.livret;

export const aUneMaquette = (type) => Boolean(FABRIQUES[type]);

const ascii = (t) => String(t || 'document')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'document';

/**
 * Produit le PDF d'un document de session. Renvoie `{ pdf, nom }`.
 * Lève si le type n'a pas de maquette : l'appelant retombe alors sur son
 * ancien générateur en connaissance de cause, plutôt que par accident.
 */
export async function rendreDocumentSession(db, type, sessionId, options = {}) {
  const fabrique = FABRIQUES[type];
  if (!fabrique) throw new Error(`Aucune maquette pour « ${type} ».`);

  const s = db.prepare(`
    SELECT s.*, f.title AS formation_titre
    FROM sessions s LEFT JOIN formations f ON f.id = s.formation_id
    WHERE s.id = ?
  `).get(sessionId);
  if (!s) throw new Error('Session introuvable.');

  /*
   * Un acte chiffré à zéro ne part pas tout seul.
   *
   * Convention, devis et facture lisent `tarif` avec un `|| 0` qui transforme
   * une donnée absente en montant nul. Le document sortait « 0,00 € », avec
   * son numéro officiel, et partait chez le client ou chez l'OPCO sans que
   * rien ne l'ait signalé. Un prix manquant et un prix nul ne sont pas la
   * même chose : le premier est un oubli, le second une décision.
   *
   * On refuse donc, en disant où corriger. `options.force` produit quand même
   * un document de travail, exactement comme le programme incomplet.
   */
  const CHIFFRES = new Set(['convention', 'devis', 'facture']);
  if (CHIFFRES.has(type) && !options.force && !(Number(s.tarif) > 0)) {
    const e = new Error(
      `Le tarif de cette session n'est pas renseigné : le document sortirait à 0,00 €. `
      + `Saisis le prix dans Configuration puis Dates et prix, ou demande un document de travail.`,
    );
    e.code = 'TARIF_ABSENT';
    throw e;
  }

  const valeurs = fabrique.valeurs(db, s, options);
  const dossier = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-'));
  try {
    const sortie = path.join(dossier, 'document.pdf');
    await rendre(path.join(MODELES, fabrique.modele), valeurs, sortie);
    return { pdf: await fs.readFile(sortie), nom: `${ascii(fabrique.nom(valeurs, s))}.pdf` };
  } finally {
    await fs.rm(dossier, { recursive: true, force: true });
  }
}
