'use client';

/**
 * Thème par section — l'architecture « deux mondes » de LES GRIOTS OS.
 *
 * La partie GRIOTHÈQUE (l'organisme de formation) reprend l'identité du site
 * lagriotheque.com : fond papier #f6f5f3, encre noire, jaune de marque. On y
 * force donc le thème clair, quelle que soit la préférence enregistrée.
 *
 * Le reste (Studio, production, argent, répertoire) garde le cockpit encre
 * sombre, et respecte le basculeur manuel de la barre du haut — la préférence
 * reste mémorisée dans localStorage sous 'os-theme'.
 *
 * Concrètement : entrer dans la Griothèque, c'est changer de monde ; en sortir,
 * c'est retrouver le sien.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Routes qui appartiennent à l'organisme de formation.
const ROUTES_GRIOTHEQUE = [
  '/formations',
  '/sessions-list',
  '/apprenants',
  '/organisme',
];

export function estGriotheque(pathname) {
  return ROUTES_GRIOTHEQUE.some(
    (r) => pathname === r || pathname.startsWith(r + '/')
  );
}

export default function ThemeSection() {
  const pathname = usePathname() || '/';

  useEffect(() => {
    const html = document.documentElement;

    if (estGriotheque(pathname)) {
      // Monde Griothèque : papier imposé, comme le site.
      html.setAttribute('data-theme', 'light');
      html.setAttribute('data-monde', 'griotheque');
      return;
    }

    // Monde Studio : on rend la main à la préférence de l'utilisateur.
    html.setAttribute('data-monde', 'studio');
    let pref = null;
    try { pref = localStorage.getItem('os-theme'); } catch (e) { /* stockage bloqué */ }
    if (pref === 'light') html.setAttribute('data-theme', 'light');
    else html.removeAttribute('data-theme');
  }, [pathname]);

  return null;
}
