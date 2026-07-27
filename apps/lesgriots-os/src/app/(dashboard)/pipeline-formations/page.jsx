'use client';

/**
 * /pipeline-formations — le tunnel de vente de l'organisme, dans la coquille.
 *
 * Il existait déjà, mais uniquement dans l'ancienne interface `/formations`,
 * donc invisible depuis le menu de la Griothèque. Même colonnes, mêmes
 * étapes, mêmes probabilités qu'avant : rien n'est réinventé.
 *
 * Quand le tunnel est vide alors que des sessions existent, on propose de
 * reprendre ces données plutôt que de laisser une page morte.
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import { Card, EmptyState, Skeleton } from '@/components/ui';

const ETAPES = [
  { cle: 'prospect',           label: 'Prospect',           proba: 0.10 },
  { cle: 'besoin',             label: 'Besoin identifié',   proba: 0.25 },
  { cle: 'devis_envoye',       label: 'Devis envoyé',       proba: 0.50 },
  { cle: 'convention_signee',  label: 'Convention signée',  proba: 0.75 },
  { cle: 'financement_valide', label: 'Financement validé', proba: 0.90 },
  { cle: 'session_planifiee',  label: 'Session planifiée',  proba: 1.00 },
];

const euros = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);

export default function PipelineFormationsPage() {
  const [opps, setOpps] = useState(null);
  const [reprise, setReprise] = useState(null);   // ce que l'import créerait
  const [enCours, setEnCours] = useState(false);
  const [survol, setSurvol] = useState(null);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    try {
      const [o, r] = await Promise.all([
        fetch('/api/formation-opportunities').then((x) => x.json()),
        fetch('/api/griotheque/pipeline/import').then((x) => x.json()).catch(() => null),
      ]);
      setOpps(Array.isArray(o) ? o : []);
      setReprise(r);
    } catch (e) {
      console.warn('[Pipeline]', e);
      setErreur('Chargement impossible.');
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const reprendre = async () => {
    setEnCours(true);
    try {
      await fetch('/api/griotheque/pipeline/import', { method: 'POST' });
      await charger();
    } finally { setEnCours(false); }
  };

  // Glisser-déposer : on déplace la carte tout de suite, on enregistre ensuite.
  const deplacer = async (id, etape) => {
    setOpps((p) => p.map((o) => (o.id === id ? { ...o, stage: etape } : o)));
    setSurvol(null);
    try {
      await fetch(`/api/formation-opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: etape }),
      });
    } catch (e) { charger(); }
  };

  const actives = useMemo(() => (opps || []).filter((o) => o.stage !== 'perdu'), [opps]);

  const total = actives.reduce((t, o) => t + (o.revenue || 0), 0);
  const pondere = actives.reduce((t, o) => {
    const e = ETAPES.find((x) => x.cle === o.stage);
    return t + (o.revenue || 0) * (e ? e.proba : 0);
  }, 0);

  const parEtape = {};
  ETAPES.forEach((e) => { parEtape[e.cle] = actives.filter((o) => o.stage === e.cle); });

  return (
    <>
      <TopBar
        title="Pipeline"
        subtitle={opps ? `${actives.length} affaire(s) en cours · ${euros(total)} au total · ${euros(pondere)} pondéré` : ''}
      />

      <div style={{ padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {erreur && <Card><p style={{ color: 'var(--danger)', margin: 0 }}>{erreur}</p></Card>}
        {!opps && !erreur && <Skeleton />}

        {/* Reprise des données déjà saisies ailleurs */}
        {opps && reprise?.a_creer > 0 && (
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
        )}

        {opps && actives.length === 0 && !reprise?.a_creer && (
          <EmptyState
            title="Pipeline vide"
            message="Aucune affaire en cours. Les opportunités apparaîtront ici dès qu’une session ou un devis existe."
          />
        )}

        {/* Le tunnel */}
        {opps && actives.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(180px, 1fr))', gap: 10, overflowX: 'auto' }}>
            {ETAPES.map((e) => {
              const cartes = parEtape[e.cle];
              const somme = cartes.reduce((t, o) => t + (o.revenue || 0), 0);
              return (
                <div
                  key={e.cle}
                  onDragOver={(ev) => { ev.preventDefault(); setSurvol(e.cle); }}
                  onDragLeave={() => setSurvol((s) => (s === e.cle ? null : s))}
                  onDrop={(ev) => { ev.preventDefault(); deplacer(ev.dataTransfer.getData('text/plain'), e.cle); }}
                  style={{
                    background: survol === e.cle ? 'var(--gold-soft)' : 'var(--surface-2)',
                    border: `1px solid ${survol === e.cle ? 'var(--gold)' : 'var(--border)'}`,
                    borderRadius: 10, padding: 10, minHeight: 220,
                    display: 'flex', flexDirection: 'column', gap: 8,
                    transition: 'background 120ms ease, border-color 120ms ease',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em' }}>{e.label}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums' }}>
                      {cartes.length} · {euros(somme)}
                    </div>
                  </div>

                  {cartes.map((o) => (
                    <div
                      key={o.id}
                      draggable
                      onDragStart={(ev) => ev.dataTransfer.setData('text/plain', o.id)}
                      style={{
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: '9px 10px', cursor: 'grab',
                        display: 'flex', flexDirection: 'column', gap: 3,
                      }}
                    >
                      <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.3 }}>{o.client_name}</div>
                      {o.formation_title && (
                        <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.3 }}>{o.formation_title}</div>
                      )}
                      {o.revenue > 0 && (
                        <div style={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>{euros(o.revenue)}</div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {opps && actives.length > 0 && (
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: 0 }}>
            Fais glisser une carte d’une colonne à l’autre pour changer son étape. Le montant pondéré
            applique la probabilité de chaque étape, de 10 % en prospect à 100 % une fois la session posée.
          </p>
        )}
      </div>
    </>
  );
}
