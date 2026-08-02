import { redirect } from 'next/navigation';

/**
 * La racine.
 *
 * Elle rendait Mission Control : le cockpit des trois piliers, avec le TJM de
 * l’agence, les projets du Studio et les prestataires. Le Studio est parti
 * vivre sa vie dans apps/studio-os ; il ne reste ici que l’organisme de
 * formation, et sa maison est la vue d’ensemble.
 *
 * Le middleware fait déjà cette redirection sur app.lagriotheque.com. Celle-ci
 * vaut pour toutes les autres adresses (localhost au premier chef), pour qu’il
 * n’existe plus une seule façon d’atterrir sur une page absente.
 */
export default function Racine() {
  redirect('/apercu');
}
