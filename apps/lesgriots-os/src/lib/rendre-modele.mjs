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
 * Une note sur le petit serveur ci-dessous, qui a l'air superflu et ne
 * l'est pas. Le premier essai chargeait la page en `file://` : Chromium
 * imprimait quatre pages blanches. La raison est que le composant de
 * pagination est importé en module ES, et qu'un navigateur refuse les
 * modules servis en `file://`. Le composant ne se définissait jamais, et
 * la règle `doc-page:not(:defined) { visibility: hidden }` faisait le
 * reste. On sert donc le dossier de travail en HTTP sur la boucle locale,
 * sur un port éphémère, le temps de l'impression.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const executer = promisify(execFile);

const CHROMIUM = process.env.CHROMIUM_BIN || '/usr/bin/chromium';

/** Les fichiers dont un modèle a besoin à côté de lui. */
const VOISINS = ['support.js', 'doc-page.js', 'logo-wordmark.svg', 'logo-lesgriots-ink.png'];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

/**
 * Injecte les valeurs sans toucher à la structure du modèle.
 *
 * Deux gestes seulement : une variable globale posée avant tout le reste,
 * et une première ligne ajoutée à renderVals() qui la préfère si elle
 * existe. Le modèle garde ses valeurs de démonstration : ouvert seul dans
 * un navigateur, il continue de s'afficher comme avant.
 */

/**
 * Retire du HTML les blocs marqués `data-si="…"` dont toutes les valeurs
 * sont vides. Un programme sans intervenant renseigné ne doit pas imprimer
 * le titre « Intervenants » au-dessus du vide.
 *
 * Le retrait se fait ici, sur la chaîne servie à Chromium, et pas dans un
 * script embarqué dans la page : le moteur de rendu des modèles reconstruit
 * le document depuis sa propre copie du contenu, et un retrait fait au
 * chargement peut être écrasé. Côté serveur, il n'y a pas de course.
 */
export function retirerBlocsVides(html, valeurs) {
  const vide = (x) => {
    if (x === null || x === undefined) return true;
    // Un faux booléen vaut absence : data-si="afficherTTC" retire le bloc
    // quand la TVA ne s'applique pas.
    if (typeof x === 'boolean') return !x;
    if (Array.isArray(x)) return x.length === 0;
    if (typeof x === 'object') return false;
    return String(x).trim() === '';
  };

  // Les clés acceptent un chemin pointé : data-si="annexe.objectifs".
  const lire = (cle) => cle.split('.').reduce((o, k) => (o == null ? undefined : o[k]), valeurs);

  let sortie = html;
  let curseur = 0;
  for (;;) {
    // N'importe quelle balise peut porter le marqueur : un span dans une
    // phrase disparaît avec sa ponctuation, un div emporte sa section.
    const attr = sortie.slice(curseur).match(/<(div|span|p|li|section)\b[^>]*\bdata-si="([^"]+)"[^>]*>/);
    if (!attr) break;
    const debut = curseur + attr.index;
    const tag = attr[1];
    const cles = attr[2].split(' ');

    // Trouver la fin du bloc en comptant les balises de même nom imbriquées.
    let profondeur = 0;
    let fin = -1;
    const balise = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
    balise.lastIndex = debut;
    for (let m; (m = balise.exec(sortie));) {
      profondeur += m[0].startsWith('</') ? -1 : 1;
      if (profondeur === 0) { fin = m.index + m[0].length; break; }
    }
    if (fin === -1) break; // balises déséquilibrées : on ne touche à rien

    if (cles.every((c) => vide(lire(c)))) {
      sortie = sortie.slice(0, debut) + sortie.slice(fin);
      curseur = debut;
    } else {
      curseur = debut + attr[0].length;
    }
  }
  return sortie;
}

export function injecter(html, valeurs) {
  if (!valeurs) return html;
  html = retirerBlocsVides(html, valeurs);
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

/** Sert un dossier sur la boucle locale, le temps d'une impression. */
function servir(dossier) {
  return new Promise((resolve) => {
    const serveur = createServer(async (req, res) => {
      const nom = decodeURIComponent((req.url || '/').split('?')[0]);
      const cible = path.join(dossier, path.normalize(nom).replace(/^(\.\.[/\\])+/, ''));
      try {
        const corps = await fs.readFile(cible);
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(cible)] || 'application/octet-stream' });
        res.end(corps);
      } catch {
        res.writeHead(404); res.end('introuvable');
      }
    });
    serveur.listen(0, '127.0.0.1', () => resolve({ serveur, port: serveur.address().port }));
  });
}

/** Rend un modèle en PDF et renvoie le chemin du fichier produit. */
export async function rendre(cheminModele, valeurs, cheminSortie) {
  const dossierSource = path.dirname(cheminModele);
  const atelier = await fs.mkdtemp(path.join(os.tmpdir(), 'modele-'));
  let serveur = null;

  try {
    for (const voisin of VOISINS) {
      try { await fs.copyFile(path.join(dossierSource, voisin), path.join(atelier, voisin)); } catch { /* absent */ }
    }

    const html = await fs.readFile(cheminModele, 'utf8');
    await fs.writeFile(path.join(atelier, 'document.html'), injecter(html, valeurs), 'utf8');

    const site = await servir(atelier);
    serveur = site.serveur;

    // `--virtual-time-budget` laisse au composant le temps de se définir et
    // aux polices d'arriver. Sans lui, Chromium imprime avant que la page
    // n'existe.
    await executer(CHROMIUM, [
      '--headless',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-pdf-header-footer',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=15000',
      `--print-to-pdf=${cheminSortie}`,
      `http://127.0.0.1:${site.port}/document.html`,
    ], { timeout: 90000, maxBuffer: 8 * 1024 * 1024 });

    const { size } = await fs.stat(cheminSortie);
    if (size < 4000) {
      throw new Error(`Le PDF produit fait ${size} octets : la page est probablement restée vide.`);
    }
    return { chemin: cheminSortie, octets: size };
  } finally {
    if (serveur) serveur.close();
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
  const r = await rendre(path.resolve(modele), JSON.parse(brut), path.resolve(sortie));
  console.log(`ok ${r.chemin} · ${Math.round(r.octets / 1024)} Ko`);
}
