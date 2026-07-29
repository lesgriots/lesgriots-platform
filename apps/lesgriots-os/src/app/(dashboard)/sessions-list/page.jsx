'use client';

/**
 * /sessions-list — les sessions, avec émargements, inscriptions, documents et devis.
 *
 * La vue vient de `src/features/griotheque/vues.jsx` : c'est exactement celle
 * de l'ancienne interface, montée ici dans la coquille de l'OS. Aucune
 * fonctionnalité n'est perdue au passage.
 */

import { useEffect, useState } from 'react';
import SessionWorkspace from '@/components/sessions/SessionWorkspace';

export default function SessionsListPage() {
  const [initialSessionId, setInitialSessionId] = useState();

  // Cette page est rendue côté client : lire l'URL ici évite de rendre toute
  // la page dynamique uniquement pour un paramètre de navigation.
  useEffect(() => {
    setInitialSessionId(new URLSearchParams(window.location.search).get('session') || undefined);
  }, []);

  return <SessionWorkspace initialSessionId={initialSessionId} />;
}
