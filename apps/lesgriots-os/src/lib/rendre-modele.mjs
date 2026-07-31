#!/usr/bin/env node
/**
 * rendre-modele.mjs — un layout Claude devient un PDF.
 *
 * Les modèles du pack Geist Mono sont des pages HTML complètes : une
 * enveloppe <doc-page> qui pagine en A4 à l'impression, des variables
 * {{ … }}, des boucles <sc-for>, et une classe JavaScript qui fournit les
 * valeurs par sa méthode renderVals(). Ils ont été dessinés pour être
 * imprimés par un navigateur, pas par une bibliothèque PDF.
 *
 * On ne réécrit donc pas le modèle : on lui donne d'autres valeurs, et on
 * laisse Chromium imprimer. La fidélité est exacte, puisque c'est le même
 * moteur que celui où le layout a été dessiné.
 *
 *   node rendre-modele.mjs <modele.dc.html> <valeurs.json> <sortie.pdf>
 *
 * Le modèle est copié dans un dossier temporaire avec ses voisins,
 * support.js, doc-page.js et le logo, pour que les chemins relatifs
 * continuent de fonctionner sans rien exposer publiquement.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const executer = promisify(execFile);

const CHROMIUM = process.env.CHROMIUM_BIN || '/usr/bin/chromium';

/** Les fichiers dont un modèle a besoin à côté de lui. */
const VOISINS = ['support.js', 'doc-page.js', 'logo-wordmark.svg'];

/**
 * Injecte les valeurs sans toucher à la structure du modèle.
 *
 * Deux gestes seulement : une variable globale posée avant tout le reste,
 * et une première ligne ajoutée à renderVals() qui la préfère si elle
 * existe. Le modèle garde ses valeurs de démonstration : ouvert seul dans
 * un navigateur, il continue de s'afficher comme avant.
 */
export function injecter(html, valeurs) {
  const donnees = JSON.stringify(valeurs).replace(/</g, '\\u003c');
  const amorce = `<script>globalThis.__VALEURS = ${donnees};</script>`;

  let sortie = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n${amorce}`);
  if (!sortie.includes('__VALEURS')) sortie = amorce + sortie;

  const avant = sortie;
  sortie = sortie.replace(
    /renderVals\s*\(\s*\)\s*\{/,
    'renderVals() { if (globalThis.__VALEURS) return globalThis.__VALEURS;',
  );
  if (sortie === avant) {
    throw new Error('Ce modèle n’expose pas de renderVals() : impossible de lui passer des valeurs.');
  }
  return sortie;
}

/** Rend un modèle en PDF et renvoie le chemin du fichier produit. */
export async function rendre(cheminModele, valeurs, cheminSortie) {
  const dossierSource = path.dirname(cheminModele);
  const atelier = await fs.mkdtemp(path.join(os.tmpdir(), 'modele-'));

  try {
    for (const voisin of VOISINS) {
      const src = path.join(dossierSource, voisin);
      try { await fs.copyFile(src, path.join(atelier, voisin)); } catch { /* absent, tant pis */ }
    }

    const html = await fs.readFile(cheminModele, 'utf8');
    const page = path.join(atelier, 'document.html');
    await fs.writeFile(page, injecter(html, valeurs), 'utf8');

    // `--virtual-time-budget` laisse au composant le temps de se définir et
    // aux polices d'arriver. Sans lui, Chromium imprime une page blanche.
    await executer(CHROMIUM, [
      '--headless',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-pdf-header-footer',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=12000',
      `--print-to-pdf=${cheminSortie}`,
      `file://${page}`,
    ], { timeout: 60000, maxBuffer: 8 * 1024 * 1024 });

    const { size } = await fs.stat(cheminSortie);
    if (size < 1000) throw new Error('Le PDF produit est vide.');
    return { chemin: cheminSortie, octets: size };
  } finally {
    await fs.rm(atelier, { recursive: true, force: true });
  }
}

// Appel direct en ligne de commande, pour essayer un modèle sans passer par l'app.
if (process.argv[1] && process.argv[1].endsWith('rendre-modele.mjs')) {
  const [modele, valeurs, sortie] = process.argv.slice(2);
  if (!modele || !sortie) {
    console.error('usage : node rendre-modele.mjs <modele.dc.html> <valeurs.json|-> <sortie.pdf>');
    process.exit(2);
  }
  const brut = valeurs && valeurs !== '-' ? await fs.readFile(valeurs, 'utf8') : 'null';
  const donnees = JSON.parse(brut);
  const r = await rendre(path.resolve(modele), donnees, path.resolve(sortie));
  console.log(`ok ${r.chemin} · ${Math.round(r.octets / 1024)} Ko`);
}
