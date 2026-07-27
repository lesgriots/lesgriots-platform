'use client';

/**
 * /lieux — les lieux de formation, leur accessibilité et leur équipement.
 *
 * La vue vient de `src/features/griotheque/vues.jsx` : c'est exactement celle
 * de l'ancienne interface, montée ici dans la coquille de l'OS. Aucune
 * fonctionnalité n'est perdue au passage.
 */

import TopBar from '@/components/layout/TopBar';
import { LieuxFormationView } from '@/features/griotheque/vues';

export default function LieuxPage() {
  return (
    <>
      <TopBar title="Lieux" subtitle="Salles, accessibilité, équipement" />
      <div style={{ padding: '0 24px 48px' }}>
        <LieuxFormationView />
      </div>
    </>
  );
}
