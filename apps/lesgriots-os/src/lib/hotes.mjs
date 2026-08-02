/**
 * Quel domaine sert quoi.
 *
 * Un seul fichier, sans dépendance et sans « use client », parce que trois
 * mondes ont besoin de la réponse : le middleware (edge runtime), le rendu
 * serveur, et le navigateur. Dupliquer la liste, c'était s'assurer qu'un jour
 * l'un des trois se tromperait.
 */

// Domaines servant exclusivement l'organisme de formation.
export const HOTES_GRIOTHEQUE = ['app.lagriotheque.com'];

// L'entrée de l'organisme de formation : la vue d'ensemble, pas le cockpit
// des trois piliers.
export const ACCUEIL_GRIOTHEQUE = '/apercu';

export function estHoteGriotheque(hote) {
  // L'en-tête Host peut porter le port (« app.lagriotheque.com:3010 »).
  const h = String(hote || '').toLowerCase().split(':')[0];
  return HOTES_GRIOTHEQUE.includes(h);
}
