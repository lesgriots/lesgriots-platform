/**
 * La marque dans les emails, en un seul endroit.
 *
 * Deux choses que tout envoi doit porter : le logo LA GRIOTHÈQUE en tête du
 * message, et la mention légale de l'organisme en pied. Les rassembler ici
 * évite qu'un modèle sorte un jour sans marque parce qu'on a oublié de le
 * brancher.
 *
 * Le logo part en pièce jointe interne, référencée par `cid:`. Gmail, Outlook
 * et Apple Mail bloquent par défaut les images distantes : un logo appelé par
 * URL serait invisible chez la majorité des destinataires, ce qui est pire que
 * pas de logo du tout.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { emailHtml } from './email-html';

const CID = 'logogriotheque';

let cacheLogo = null;

/** Lu une fois, gardé en mémoire : c'est 8 ko, et ça part à chaque envoi. */
function logo() {
  if (cacheLogo !== null) return cacheLogo;
  try {
    const fichier = path.join(process.cwd(), 'public', 'branding', 'griotheque-logo-ink.png');
    cacheLogo = readFileSync(fichier);
  } catch (e) {
    console.warn('[email-marque] logo introuvable :', e.message);
    cacheLogo = false;
  }
  return cacheLogo;
}

/** La pièce jointe du logo, ou rien si le fichier manque : jamais d'échec d'envoi pour un logo. */
export function pieceLogo() {
  const contenu = logo();
  if (!contenu) return [];
  return [{
    filename: 'la-griotheque.png',
    content: contenu,
    cid: CID,
    contentDisposition: 'inline',
  }];
}

/**
 * Habille un corps de texte : logo, mise en forme, bouton d'espace apprenant,
 * mention légale. Renvoie le HTML prêt à partir.
 */
export function habiller({ objet = '', corps = '', lien = '', organisme = {} }) {
  const pied = [
    organisme.raison_sociale || 'LES GRIOTS',
    organisme.nda ? `Déclaration d’activité n° ${organisme.nda}` : '',
    organisme.siret ? `SIRET ${organisme.siret}` : '',
    organisme.email || '',
  ].filter(Boolean).join(' · ');

  return emailHtml({ titre: objet, corps, lien, pied });
}
