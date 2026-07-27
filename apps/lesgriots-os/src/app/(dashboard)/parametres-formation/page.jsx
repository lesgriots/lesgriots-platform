'use client';

/**
 * /parametres-formation — les réglages propres à l'organisme de formation.
 *
 * La vue vient de `src/features/griotheque/vues.jsx` : c'est exactement celle
 * de l'ancienne interface, montée ici dans la coquille de l'OS. Aucune
 * fonctionnalité n'est perdue au passage.
 */

import TopBar from '@/components/layout/TopBar';
import { ParametresView } from '@/features/griotheque/vues';

export default function ParametresFormationPage() {
  return (
    <>
      <TopBar title="Paramètres" subtitle="Réglages de l'organisme de formation" />
      <div style={{ padding: '0 24px 48px' }}>
        <ParametresView />
      </div>
    </>
  );
}
