'use client';

import TopBar from '@/components/layout/TopBar';
import { SessionsView, useDonneesFormation } from '@/features/griotheque/vues';
import { useState } from 'react';

/**
 * Point d'entrée unique des sessions.
 *
 * La liste et la fiche détaillée utilisent volontairement le même espace de
 * travail : une session ouverte conserve donc tous les outils opérationnels
 * (configuration, conventions, convocations, évaluations, suivi et documents)
 * au lieu d'afficher une seconde vue incomplète.
 */
export default function SessionWorkspace({ initialSessionId }) {
  const { formations, sessions, clients, chargement, recharger } = useDonneesFormation();
  const session = initialSessionId ? sessions.find((item) => item.id === initialSessionId) : null;
  const title = session ? (session.formation_title || 'Session') : 'Sessions';
  const [seeding, setSeeding] = useState(false);

  const loadDemo = async () => {
    setSeeding(true);
    try {
      const response = await fetch('/api/demo/griotheque-session', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible de charger la démo.');
      window.location.assign(`/sessions/${data.session_id}`);
    } catch (error) {
      window.alert(error.message || 'Impossible de charger la démo.');
      setSeeding(false);
    }
  };

  return (
    <>
      <TopBar title={title} subtitle={session?.code_interne || (sessions.length ? `${sessions.length} session(s)` : '')} />
      <div style={{ padding: '0 24px 48px' }}>
        {chargement ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Chargement…</p>
        ) : sessions.length === 0 ? (
          <div style={{ marginTop: 32, maxWidth: 620, padding: 22, borderRadius: 'var(--radius-lg)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Aucune session dans la base locale</h2>
            <p style={{ color: 'var(--text-3)', fontSize: 13, lineHeight: 1.55 }}>Charge la session de démonstration GAME OF WORK pour vérifier le cockpit complet. Elle est locale et pourra être supprimée avant l’import de tes données réelles.</p>
            <button type="button" onClick={loadDemo} disabled={seeding} style={{ border: 0, borderRadius: 'var(--radius-md)', padding: '10px 14px', background: 'var(--gold)', color: 'var(--gold-ink)', fontWeight: 800, cursor: 'pointer' }}>{seeding ? 'Création…' : 'Charger la démo GAME OF WORK'}</button>
          </div>
        ) : (
          <SessionsView
            sessions={sessions}
            formations={formations}
            clients={clients}
            initialSessionId={initialSessionId}
            onRefresh={recharger}
            onSessionNavigate={(sessionId) => window.location.assign(`/sessions/${sessionId}`)}
          />
        )}
      </div>
    </>
  );
}
