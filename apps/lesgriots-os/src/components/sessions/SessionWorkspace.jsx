'use client';

import TopBar from '@/components/layout/TopBar';
import { SessionsView, useDonneesFormation } from '@/features/griotheque/vues';
import { BandeauEncre, BarreSegmentee } from '@/components/da/BandeauDa';
import { useState } from 'react';

/**
 * Point d'entrée unique des sessions.
 *
 * La liste et la fiche détaillée utilisent volontairement le même espace de
 * travail : une session ouverte conserve donc tous les outils opérationnels
 * (configuration, conventions, convocations, évaluations, suivi et documents)
 * au lieu d'afficher une seconde vue incomplète.
 */
export default function SessionWorkspace({ initialSessionId, vue = 'actives' }) {
  const { formations, sessions: toutes, clients, chargement, recharger } = useDonneesFormation();

  // « Sessions archivées » figurait au menu depuis le début et ouvrait la
  // liste normale : le lien portait un paramètre que personne ne lisait.
  // Sont archivées les sessions annulées et celles qui sont terminées.
  const archivee = (s) => ['cancelled', 'annulee', 'archivee', 'completed', 'termine'].includes(String(s.status || '').toLowerCase());
  const sessions = vue === 'archivees' ? toutes.filter(archivee) : toutes.filter((s) => !archivee(s));
  const session = initialSessionId ? sessions.find((item) => item.id === initialSessionId) : null;
  const title = session ? (session.formation_title || 'Session') : 'Sessions';
  const [seeding, setSeeding] = useState(false);

  /* ── Ce que la maquette met en tête de l'écran ──────────────────────
     Quatre états, dans l'ordre du parcours. Ils se déduisent du statut
     réel des sessions, pas d'une liste écrite à la main : une session
     sans date n'est pas planifiée, quoi qu'en dise son statut. */
  const etat = (x) => {
    const st = String(x.status || '').toLowerCase();
    if (['completed', 'termine', 'terminee', 'terminée'].includes(st)) return 'terminees';
    if (['cancelled', 'annulee', 'annulée', 'archivee'].includes(st)) return 'terminees';
    if (!x.start_date) return st === 'draft' || st === 'brouillon' ? 'projets' : 'planification';
    return 'planifiees';
  };
  const groupes = { projets: [], planification: [], planifiees: [], terminees: [] };
  for (const x of sessions) groupes[etat(x)].push(x);

  const apprenants = sessions.reduce((t, x) => t + (Number(x.inscriptions_count) || 0), 0);
  const SEGMENTS = [
    { cle: 'projets', label: 'Projets', base: '#6f6b60', clair: '#87826f', icone: 'documents' },
    { cle: 'planification', label: 'Planification en cours', base: '#C9821C', clair: '#E09B32', icone: 'configuration' },
    { cle: 'planifiees', label: 'Planifiées', base: '#1B6FB8', clair: '#2C86D4', icone: 'sessions' },
    { cle: 'terminees', label: 'Terminées', base: '#1E8449', clair: '#2B9E5B', icone: 'valide' },
  ].map((g) => {
    const lot = groupes[g.cle];
    return {
      ...g,
      poids: lot.length,
      detail: lot.length
        ? `${lot.length} session${lot.length > 1 ? 's' : ''} · ${lot.reduce((t, x) => t + (Number(x.inscriptions_count) || 0), 0)} apprenant(s)`
        : 'aucune session',
      point: g.cle === 'planification' && lot.length > 0,
    };
  });

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
      <TopBar
        title={vue === 'archivees' ? 'Sessions archivées' : title}
        subtitle={session?.code_interne || (sessions.length ? `${sessions.length} session(s)` : '')}
        right={vue === 'archivees' ? null : (
          <a
            href="/sessions/nouvelle"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px',
              borderRadius: 'var(--radius-md)', background: 'var(--gold)', color: 'var(--gold-ink)',
              border: '1.5px solid var(--gold)', fontSize: 12.5, fontWeight: 800, textDecoration: 'none',
            }}
          >
            ＋ Créer une session
          </a>
        )}
      />
      <div style={{ padding: '18px 24px 48px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {!chargement && sessions.length > 0 && vue !== 'archivees' && (
          <>
            <BandeauEncre
              surTitre="Catalogue · toutes mes sessions"
              titre="Toutes mes sessions"
              phrase="Cliquez sur une session pour voir son avancement et accéder à ses pièces."
              chiffres={[
                { label: 'Sessions', valeur: String(sessions.length), couleur: 'var(--gold)' },
                { label: 'Apprenants', valeur: String(apprenants) },
                { label: 'Terminées', valeur: String(groupes.terminees.length) },
              ]}
            />
            <BarreSegmentee segments={SEGMENTS} />
          </>
        )}
        {vue === 'archivees' && (
          <div style={{ margin: '0 0 16px', padding: '12px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-2)' }}>
            Les sessions terminées et annulées. Elles restent consultables et comptent toujours dans le BPF.{' '}
            <a href="/sessions-list" style={{ color: 'var(--gold)', fontWeight: 700 }}>Revenir aux sessions en cours</a>
          </div>
        )}
        {chargement ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Chargement…</p>
        ) : sessions.length === 0 && vue === 'archivees' ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Aucune session archivée pour le moment.</p>
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
