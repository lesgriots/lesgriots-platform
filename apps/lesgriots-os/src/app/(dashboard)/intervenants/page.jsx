'use client';

/**
 * /intervenants — les formateurs : profils, spécialités, sessions animées.
 *
 * La vue vient de `src/features/griotheque/vues.jsx` : c'est exactement celle
 * de l'ancienne interface, montée ici dans la coquille de l'OS. Aucune
 * fonctionnalité n'est perdue au passage.
 */

import TopBar from '@/components/layout/TopBar';
import { FormateursView } from '@/features/griotheque/vues';

export default function IntervenantsPage() {
  return (
    <>
      <TopBar title="Intervenants" subtitle="Formateurs et co-animateurs" />
      <div style={{ padding: '0 24px 48px' }}>
        <FormateursView />
      </div>
    </>
  );
}
