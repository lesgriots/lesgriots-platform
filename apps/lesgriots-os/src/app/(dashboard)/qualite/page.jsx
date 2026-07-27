'use client';

/**
 * /qualite — le suivi qualité et les indicateurs Qualiopi rattachés aux formations et aux sessions.
 *
 * La vue vient de `src/features/griotheque/vues.jsx` : c'est exactement celle
 * de l'ancienne interface, montée ici dans la coquille de l'OS. Aucune
 * fonctionnalité n'est perdue au passage.
 */

import TopBar from '@/components/layout/TopBar';
import { QualiteView, useDonneesFormation } from '@/features/griotheque/vues';

export default function QualitePage() {
  const { formations, sessions, clients, categories, chargement, recharger } = useDonneesFormation();

  return (
    <>
      <TopBar title="Qualité" subtitle={'Indicateurs et preuves du référentiel national'} />
      <div style={{ padding: '0 24px 48px' }}>
        {chargement ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Chargement…</p>
        ) : (
          <QualiteView formations={formations} sessions={sessions} />
        )}
      </div>
    </>
  );
}
