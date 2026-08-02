'use client';

/**
 * Monde courant — architecture « deux métiers, deux adresses ».
 *
 * Décision du 26/07/2026 : `app.lagriotheque.com` est l'OS de l'ORGANISME DE
 * FORMATION, rien d'autre. Le Studio (projets clients, pipeline agence, TJM,
 * finances globales) partira sur sa propre adresse.
 *
 * C'est donc le DOMAINE qui décide du monde, plus la route :
 *
 *   app.lagriotheque.com  → monde « griotheque » : papier, mot-marque
 *                           LA GRIOTHÈQUE, menu limité à la formation.
 *   toute autre adresse    → monde « studio » : cockpit encre des trois
 *                           piliers, menu complet. La règle par route est
 *                           conservée là-bas, pour que les écrans de formation
 *                           gardent leur identité papier au sein de l'OS.
 *
 * En développement (localhost) on reste en monde Studio pour garder le menu
 * complet sous la main.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { HOTES_GRIOTHEQUE, estHoteGriotheque } from '@/lib/hotes.mjs';

// La liste des domaines vit dans src/lib/hotes.mjs : le middleware en a besoin
// aussi, et il tourne en edge runtime, où ce fichier-ci ne peut pas le suivre.
export { HOTES_GRIOTHEQUE, estHoteGriotheque };

// Routes de formation — servent au sein de l'OS complet (monde Studio),
// pour que ces écrans gardent le papier même hors du domaine Griothèque.
const ROUTES_GRIOTHEQUE = [
  '/formations',
  '/pipeline-formations',
  // La fiche d'une session vit sous /sessions/[id] (distinct de la liste).
  // Sans cette entrée, elle retombait dans le monde Studio au clic sur le rail.
  '/sessions',
  '/sessions-list',
  '/apprenants',
  '/organisme',
  '/apercu',
  '/catalogue',
  '/intervenants',
  '/lieux',
  '/qualite',
  // Écrans de qualité et de pilotage : sans eux, le serveur rendait le menu
  // Studio et le client le remplaçait au montage. Un clignotement, et une
  // erreur d'hydratation à chaque chargement.
  '/amelioration-continue',
  '/a-construire',
  // La fiche d'une affaire vit ici : sans elle, le serveur rendait le menu
  // Studio et le navigateur le remplaçait au montage.
  '/opportunites',
  '/legal',
  '/parametres-formation',
  '/entreprises',
  '/financeurs',
  '/bpf',
  '/agenda',
  '/evaluations',
  '/facturation',
  '/appareil',
  '/espace-apprenant',
  '/emails',
  '/inscriptions',
  '/recyclages',
  '/opportunites-archivees',
  '/workflows',
  '/settings',
];

export function estRouteGriotheque(pathname) {
  const p = String(pathname || '');
  return ROUTES_GRIOTHEQUE.some((r) => p === r || p.startsWith(r + '/'));
}

/**
 * Le domaine prime : sur app.lagriotheque.com, TOUT est Griothèque, y compris
 * les réglages. Ailleurs, on retombe sur la règle par route.
 */
export function estGriotheque(pathname, hostname) {
  const hote = hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '');
  if (estHoteGriotheque(hote)) return true;
  return estRouteGriotheque(pathname);
}

export default function ThemeSection() {
  const pathname = usePathname() || '/';

  useEffect(() => {
    const html = document.documentElement;

    if (estGriotheque(pathname, window.location.hostname)) {
      html.setAttribute('data-theme', 'light');
      html.setAttribute('data-monde', 'griotheque');
      return;
    }

    html.setAttribute('data-monde', 'studio');
    let pref = null;
    try { pref = localStorage.getItem('os-theme'); } catch (e) { /* stockage bloqué */ }
    if (pref === 'light') html.setAttribute('data-theme', 'light');
    else html.removeAttribute('data-theme');
  }, [pathname]);

  return null;
}
