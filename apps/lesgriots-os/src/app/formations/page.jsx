import { redirect } from 'next/navigation';

// L'ancienne application complète avait sa propre navigation : elle masquait
// les écrans récents (Emails, Agenda, Facturation…). Cette URL reste pour les
// marque-pages existants, mais elle bascule désormais vers la coquille unique
// de LA GRIOTHÈQUE OS.
const DESTINATIONS = {
  overview: '/apercu',
  pipeline: '/pipeline-formations',
  sessions: '/sessions-list',
  apprenants: '/apprenants',
  formateurs: '/intervenants',
  lieux: '/lieux',
  qualite: '/qualite',
  parametres: '/parametres-formation',
};

export default async function AncienneRouteFormations({ searchParams }) {
  const params = await searchParams;
  redirect(DESTINATIONS[params?.tab] || '/apercu');
}
