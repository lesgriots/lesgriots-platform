'use client';

/**
 * /entreprises — les entreprises clientes de l'organisme de formation.
 *
 * La vue vient de `src/features/griotheque/vues.jsx` : c'est exactement celle
 * de l'ancienne interface, montée ici dans la coquille de l'OS.
 */

import TopBar from '@/components/layout/TopBar';
import { EntreprisesView, useDonneesFormation } from '@/features/griotheque/vues';

export default function EntreprisesPage() {
  const { clients, sessions, chargement, recharger } = useDonneesFormation();

  return (
    <>
      <TopBar title="Entreprises" subtitle={clients.length ? `${clients.length} entreprise(s)` : ''} />
      <div style={{ padding: '0 24px 48px' }}>
        {chargement ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Chargement…</p>
        ) : (
          <EntreprisesView clients={clients} sessions={sessions} onRefresh={recharger} />
        )}
      </div>
    </>
  );
}
