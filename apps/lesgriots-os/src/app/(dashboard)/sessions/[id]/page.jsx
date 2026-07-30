'use client';

import { useParams } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import SessionCockpit from '@/components/sessions/SessionCockpit';

/** Fiche canonique d'une session, utilisable depuis le pipeline, l'agenda et la recherche. */
export default function SessionDetailPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  return <>
    <TopBar title="Session de formation" subtitle="Pilotage, documents et suivi opérationnel" />
    <div style={{ padding: '18px 24px 48px', maxWidth: 1900, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <SessionCockpit sessionId={id} />
    </div>
  </>;
}
