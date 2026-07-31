#!/usr/bin/env node
/**
 * controle-mise-en-page.mjs — un document reste-t-il propre quand le
 * contenu grossit ?
 *
 * On ne peut pas relire à l'œil chaque combinaison de données. Ce contrôle
 * lit un PDF produit et cherche les trois défauts qui reviennent toujours :
 *
 *   · une dernière page presque vide (deux lignes orphelines qui débordent) ;
 *   · du texte qui touche le haut ou le bas de la feuille ;
 *   · une page entièrement vide.
 *
 * Il s'appuie sur `pdftotext -bbox` (paquet poppler-utils), qui donne la
 * position de chaque mot. Pas de bibliothèque à installer, pas de parsage
 * de PDF à la main : l'outil existe, on s'en sert.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const executer = promisify(execFile);
const MM = 25.4 / 72;

/** Les mots d'un PDF, page par page, avec leurs positions en millimètres. */
export async function lirePages(chemin) {
  const { stdout } = await executer('pdftotext', ['-bbox', chemin, '-'], { maxBuffer: 32 * 1024 * 1024 });
  const pages = [];
  for (const bloc of stdout.split('<page ').slice(1)) {
    const dim = bloc.match(/width="([\d.]+)" height="([\d.]+)"/);
    const mots = [...bloc.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"/g)]
      .map((m) => ({ yMin: parseFloat(m[2]) * MM, yMax: parseFloat(m[4]) * MM }));
    pages.push({
      hauteur: dim ? parseFloat(dim[2]) * MM : 297,
      mots: mots.length,
      haut: mots.length ? Math.min(...mots.map((m) => m.yMin)) : null,
      bas: mots.length ? Math.max(...mots.map((m) => m.yMax)) : null,
    });
  }
  return pages;
}

/**
 * Juge une mise en page.
 *
 * `margeMin` : distance minimale attendue entre le texte et le bord, en mm.
 * Calé à 4 mm : les en-têtes et pieds de page de la maison se posent
 * volontairement à 5 mm du bord, le défaut qu'on traque est le texte de
 * contenu qui démarre au ras de la feuille (moins de 4 mm).
 * `seuilOrphelin` : une dernière page qui porte moins que ce pourcentage du
 * nombre de mots médian est considérée comme un débordement inutile.
 * `piedDePage` : nombre de mots que le pied de page apporte à chaque page,
 * et qu'il ne faut pas compter comme du contenu.
 */
export function juger(pages, { margeMin = 4, seuilOrphelin = 15, piedDePage = 0 } = {}) {
  const defauts = [];
  const utiles = pages.map((p) => Math.max(0, p.mots - piedDePage));
  const median = [...utiles].sort((a, b) => a - b)[Math.floor(utiles.length / 2)] || 1;

  pages.forEach((p, i) => {
    const n = i + 1;
    if (!p.mots) { defauts.push(`page ${n} : entièrement vide`); return; }
    if (utiles[i] === 0) { defauts.push(`page ${n} : ne porte que le pied de page`); return; }
    if (i === pages.length - 1 && pages.length > 1 && utiles[i] < median * (seuilOrphelin / 100)) {
      defauts.push(`page ${n} : quasi vide (${utiles[i]} mots contre ${median} en médiane), débordement orphelin`);
    }
    if (p.haut < margeMin) defauts.push(`page ${n} : texte à ${p.haut.toFixed(1)} mm du bord haut`);
    if (p.hauteur - p.bas < margeMin) defauts.push(`page ${n} : texte à ${(p.hauteur - p.bas).toFixed(1)} mm du bord bas`);
  });
  return defauts;
}

export async function controler(chemin, options) {
  const pages = await lirePages(chemin);
  return { pages: pages.length, defauts: juger(pages, options) };
}

if (process.argv[1] && process.argv[1].endsWith('controle-mise-en-page.mjs')) {
  const args = process.argv.slice(2);
  const pied = Number((args.find((a) => a.startsWith('--pied=')) || '').split('=')[1] || 0);
  const cibles = args.filter((a) => !a.startsWith('--'));
  if (!cibles.length) {
    console.error('usage : node controle-mise-en-page.mjs [--pied=N] <fichier.pdf> [...]');
    process.exit(2);
  }
  let echecs = 0;
  for (const c of cibles) {
    const r = await controler(c, { piedDePage: pied });
    const nom = c.split('/').pop();
    if (r.defauts.length) {
      echecs += 1;
      console.log(`✗ ${nom} — ${r.pages} page(s)`);
      r.defauts.forEach((d) => console.log(`    ${d}`));
    } else {
      console.log(`✓ ${nom} — ${r.pages} page(s), mise en page saine`);
    }
  }
  process.exit(echecs ? 1 : 0);
}
