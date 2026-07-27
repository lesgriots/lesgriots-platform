'use client';

/**
 * /apercu — Vue d'ensemble de l'organisme de formation.
 *
 * Reprend la maquette « Dashboard OF » validée par Moos : quatre indicateurs,
 * les prochaines sessions, la carte de conformité Qualiopi en encre, la liste
 * « À traiter », la satisfaction par formation.
 *
 * Tous les chiffres viennent de la base réelle. Quand une donnée n'existe pas
 * encore (aucune évaluation saisie), on affiche un tiret : jamais un zéro qui
 * laisserait croire à une mauvaise note.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import { Card, Badge, Skeleton } from '@/components/ui';
import CourbeCa from '@/components/charts/CourbeCa';

const euros = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);

const dateFr = (d) => d
  ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  : '—';

function statutSession(s) {
  const max = Number(s.max_participants) || 0;
  if (['brouillon', 'draft', 'preparation'].includes(String(s.status || '').toLowerCase())) {
    return { label: 'Brouillon', tone: 'neutral' };
  }
  if (max && s.inscrits >= max) return { label: 'Complète', tone: 'info' };
  return { label: 'Ouverte', tone: 'gold' };
}

export default function ApercuPage() {
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState('');
  // La durée choisie est mémorisée : on retrouve sa lecture d'un jour à l'autre.
  const [periode, setPeriode] = useState('12m');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const gardee = localStorage.getItem('lg-periode-apercu');
    if (gardee) setPeriode(gardee);
  }, []);

  useEffect(() => {
    setD(null);
    fetch('/api/griotheque/apercu?periode=' + periode)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(setD)
      .catch((e) => { console.warn('[Aperçu]', e); setErreur('Chargement impossible.'); });
  }, [periode]);

  const changerPeriode = (cle) => {
    setPeriode(cle);
    if (typeof window !== 'undefined') localStorage.setItem('lg-periode-apercu', cle);
  };

  const PERIODES = [
    ['30j', '30 jours'], ['90j', '90 jours'], ['12m', '12 mois'],
    ['annee', 'Année'], ['tout', 'Tout'],
  ];

  const i = d?.indicateurs;

  const kpis = [
    { label: 'Sessions planifiées', valeur: i?.sessions_planifiees ?? '—', unite: '90 prochains jours',
      note: d ? `${d.conformite.sessions_terminees} session(s) déjà terminée(s)` : '' },
    { label: 'Apprenants inscrits', valeur: i?.apprenants_inscrits ?? '—', unite: 'personnes',
      note: i?.apprenants_en_attente_financement ? `${i.apprenants_en_attente_financement} en attente de financement` : '' },
    { label: 'Satisfaction', valeur: i?.satisfaction ?? '—', unite: i?.satisfaction ? '/ 5' : 'aucune évaluation',
      note: i?.satisfaction_nb ? `sur ${i.satisfaction_nb} évaluation(s) à chaud` : 'à collecter en fin de session' },
    { label: 'Heures dispensées', valeur: i?.heures_dispensees ?? '—', unite: 'heures',
      note: 'sessions terminées' },
  ];

  return (
    <>
      <TopBar
        title="Vue d’ensemble"
        subtitle="L’organisme de formation en un coup d’œil"
        right={
          <div style={{
            display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: 2, gap: 1,
          }} role="tablist" aria-label="Durée">
            {PERIODES.map(([cle, label]) => {
              const actif = periode === cle;
              return (
                <button
                  key={cle}
                  role="tab"
                  aria-selected={actif}
                  onClick={() => changerPeriode(cle)}
                  style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                    background: actif ? 'var(--surface)' : 'transparent',
                    border: '1px solid ' + (actif ? 'var(--border)' : 'transparent'),
                    color: actif ? 'var(--text)' : 'var(--text-3)',
                    fontSize: 11, fontWeight: actif ? 500 : 400,
                    fontFamily: 'var(--font-sans)', cursor: 'pointer',
                    boxShadow: actif ? 'var(--shadow-sm)' : 'none',
                  }}
                >{label}</button>
              );
            })}
          </div>
        }
      />

      <div style={{ padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {erreur && <Card><p style={{ color: 'var(--danger)', margin: 0 }}>{erreur}</p></Card>}
        {!d && !erreur && <Skeleton />}

        {d && (
          <>
            {/* ── Indicateurs ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
              {kpis.map((k) => (
                <Card key={k.label}>
                  <div style={{ fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                    {k.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 34, letterSpacing: '-0.03em', lineHeight: 1 }}>{k.valeur}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{k.unite}</span>
                  </div>
                  {k.note && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>{k.note}</div>}
                </Card>
              ))}
            </div>

            {/* ── Chiffre d'affaires ── */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                <div>
                  <strong style={{ fontSize: 16, letterSpacing: '-0.015em' }}>Chiffre d’affaires</strong>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    Cumulé sur la durée choisie. Réalisé : sessions terminées. Prévisionnel : sessions posées, non encore tenues.
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, fontSize: 28, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {euros((i?.ca_realise || 0) + (i?.ca_previsionnel || 0))}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>engagé sur la période</div>
                </div>
              </div>
              <CourbeCa serie={d.serie} aujourdhui={new Date().toISOString().slice(0, 10)} />
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}
                 className="apercu-colonnes">

              {/* ── Prochaines sessions ── */}
              <Card>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                  <strong style={{ fontSize: 16, letterSpacing: '-0.015em' }}>Prochaines sessions</strong>
                  <Link href="/sessions-list" style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Tout voir →</Link>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>90 prochains jours</div>

                {d.prochaines.length === 0 ? (
                  <p style={{ fontSize: 13.5, color: 'var(--text-3)', margin: '14px 0' }}>
                    Aucune session programmée. Elles apparaîtront ici dès qu’une date est posée.
                  </p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                    <thead>
                      <tr>
                        {['Formation', 'Début', 'Inscrits', 'Statut'].map((h) => (
                          <th key={h} style={{ textAlign: 'left', fontSize: 10, letterSpacing: '0.1em',
                            textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 500,
                            padding: '0 8px 8px 0', borderBottom: '1px solid var(--border)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {d.prochaines.map((s) => {
                        const st = statutSession(s);
                        return (
                          <tr key={s.id}>
                            <td style={{ padding: '11px 8px 11px 0', borderBottom: '1px solid var(--border)' }}>
                              <div style={{ fontWeight: 500 }}>{s.formation_titre || s.session_name || '—'}</div>
                              {s.location && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{s.location}</div>}
                            </td>
                            <td style={{ padding: '11px 8px 11px 0', borderBottom: '1px solid var(--border)' }}>{dateFr(s.start_date)}</td>
                            <td style={{ padding: '11px 8px 11px 0', borderBottom: '1px solid var(--border)' }}>
                              {s.inscrits}{s.max_participants ? ` / ${s.max_participants}` : ''}
                            </td>
                            <td style={{ padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
                              <Badge tone={st.tone}>{st.label}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Card>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* ── Conformité Qualiopi ── */}
                <div style={{ background: '#0B0B0A', color: '#F1EFE8', borderRadius: 'var(--radius-md, 8px)', padding: '20px 22px' }}>
                  <div style={{ fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#F5CE16' }}>
                    Conformité Qualiopi
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '10px 0 12px' }}>
                    <span style={{ fontWeight: 600, fontSize: 40, letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {d.conformite.pourcentage}
                    </span>
                    <span style={{ fontSize: 15, opacity: 0.6 }}>%</span>
                  </div>
                  <div style={{ height: 5, background: 'rgba(241,239,232,0.18)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: d.conformite.pourcentage + '%', height: '100%', background: '#F5CE16' }} />
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.65, marginTop: 12, lineHeight: 1.45 }}>
                    {d.conformite.pieces_ok} pièce(s) valides sur {d.conformite.pieces_attendues} ·{' '}
                    {d.conformite.sessions_incompletes} session(s) sans preuve complète
                  </div>
                  <a href="/api/qualite/dossier?format=html" target="_blank" rel="noopener"
                     style={{ display: 'inline-block', marginTop: 14, fontSize: 12.5, color: '#F5CE16',
                              borderBottom: '1px solid #F5CE16', paddingBottom: 2 }}>
                    Ouvrir le dossier d’audit ↗
                  </a>
                </div>

                {/* ── À traiter ── */}
                <Card>
                  <strong style={{ fontSize: 16, letterSpacing: '-0.015em' }}>À traiter</strong>
                  <div style={{ marginTop: 10 }}>
                    {d.a_traiter.length === 0 ? (
                      <p style={{ fontSize: 13.5, color: 'var(--success)', margin: 0 }}>
                        Rien à signaler — tous les contrôles automatiques passent.
                      </p>
                    ) : d.a_traiter.map((a, n) => (
                      <div key={n} style={{ display: 'flex', gap: 10, padding: '9px 0',
                        borderTop: n ? '1px solid var(--border)' : 'none' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', marginTop: 6,
                          background: a.ton === 'danger' ? 'var(--danger)' : '#F5CE16' }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5 }}>{a.texte}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{a.meta}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>

            {/* ── Satisfaction par formation ── */}
            <Card>
              <strong style={{ fontSize: 16, letterSpacing: '-0.015em' }}>Satisfaction par formation</strong>
              <div style={{ marginTop: 12 }}>
                {d.satisfaction_par_formation.length === 0 ? (
                  <p style={{ fontSize: 13.5, color: 'var(--text-3)', margin: 0 }}>
                    Aucune évaluation enregistrée pour l’instant. Les enquêtes à chaud alimenteront ce bloc
                    dès la première session clôturée.
                  </p>
                ) : d.satisfaction_par_formation.map((f) => (
                  <div key={f.title} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 5 }}>
                      <span>{f.title}</span>
                      <strong>{f.moy} / 5</strong>
                    </div>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: (f.moy / 5 * 100) + '%', height: '100%', background: 'var(--text)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
