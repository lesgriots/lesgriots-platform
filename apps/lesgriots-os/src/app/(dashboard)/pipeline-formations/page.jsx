'use client';

/**
 * /pipeline-formations — le tunnel de vente de l'organisme, dans la coquille.
 *
 * Le tunnel lui-même est la vue d'origine (`GrioPipelineView`) : création
 * d'affaire, glisser-déposer, suppression, montants pondérés, tout est
 * conservé. On ajoute au-dessus une seule chose qui n'existait pas : la
 * reprise des affaires déjà saisies en sessions, qui ne remontaient jamais
 * dans le tunnel.
 */

import { useEffect, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { Card } from '@/components/ui';
import { GrioPipelineView, useDonneesFormation } from '@/features/griotheque/vues';

const euros = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);

function BanniereReprise({ onFait }) {
  const [reprise, setReprise] = useState(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    fetch('/api/griotheque/pipeline/import')
      .then((r) => (r.ok ? r.json() : null))
      .then(setReprise)
      .catch(() => {});
  }, []);

  if (!reprise?.a_creer) return null;

  const reprendre = async () => {
    setEnCours(true);
    try {
      await fetch('/api/griotheque/pipeline/import', { method: 'POST' });
      setReprise(null);
      onFait?.();
    } finally { setEnCours(false); }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <Card>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>
              {reprise.a_creer} affaire(s) déjà dans tes sessions, absentes du pipeline
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
              {euros(reprise.montant)} au total. Elles entrent en « Session planifiée », avec leur
              tarif et leur date d’origine. Rien n’est inventé, rien n’est dupliqué.
            </div>
          </div>
          <button
            onClick={reprendre}
            disabled={enCours}
            style={{
              padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--gold)', color: '#141210', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 600, opacity: enCours ? 0.6 : 1,
            }}
          >
            {enCours ? 'Reprise…' : 'Reprendre mes données'}
          </button>
        </div>
      </Card>
    </div>
  );
}

export default function PipelineFormationsPage() {
  const { formations, chargement } = useDonneesFormation();
  const [cle, setCle] = useState(0);   // force le rechargement du tunnel après reprise

  return (
    <>
      <TopBar title="Pipeline" subtitle="Tunnel de vente de l’organisme de formation" />
      <div style={{ padding: '0 24px 48px' }}>
        <BanniereReprise onFait={() => setCle((k) => k + 1)} />
        {chargement ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Chargement…</p>
        ) : (
          <GrioPipelineView key={cle} formations={formations} />
        )}
      </div>
    </>
  );
}
