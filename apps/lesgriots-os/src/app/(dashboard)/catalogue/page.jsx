'use client';

/**
 * /catalogue — le catalogue de formations, avec tout ce qu'il savait faire : création, fiche détaillée, modules, tarifs, catégories.
 *
 * La vue vient de `src/features/griotheque/vues.jsx` : c'est exactement celle
 * de l'ancienne interface, montée ici dans la coquille de l'OS. Aucune
 * fonctionnalité n'est perdue au passage.
 */

import TopBar from '@/components/layout/TopBar';
import { FormationsView, useDonneesFormation } from '@/features/griotheque/vues';

export default function CataloguePage() {
  const { formations, sessions, clients, categories, chargement, recharger } = useDonneesFormation();

  return (
    <>
      <TopBar title="Formations" subtitle={formations.length ? `${formations.length} au catalogue` : ''} />
      <div style={{ padding: '0 24px 48px' }}>
        {chargement ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Chargement…</p>
        ) : (
          <FormationsView formations={formations} sessions={sessions} categories={categories} onRefresh={recharger} />
        )}
      </div>
    </>
  );
}
