'use client';

/**
 * /evaluations — la collecte, session par session.
 *
 * Ton 0 % de satisfaction ne vient pas de mauvaises notes : la table était
 * vide. Cet écran sert à la remplir vite, sans quitter la page, et à voir en
 * un coup d'œil quelles sessions terminées n'ont aucune preuve.
 *
 * Trois moments comptent pour le référentiel : le positionnement avant
 * l'entrée, l'enquête à chaud en fin de session, l'évaluation à froid.
 */

import { useCallback, useEffect, useState } from 'react';
import TopBar from '@/components/layout/TopBar';
import { Card, EmptyState, Skeleton } from '@/components/ui';

const TYPES = [
  { cle: 'positionnement', label: 'Positionnement', quand: 'avant l’entrée' },
  { cle: 'satisfaction',   label: 'Enquête à chaud', quand: 'fin de session' },
  { cle: 'froid',          label: 'À froid',         quand: 'à trois mois' },
];

const mono = {
  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--text-3)',
};

const dateFr = (d) => d
  ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })
  : '—';

export default function EvaluationsPage() {
  const [d, setD] = useState(null);
  const [ouverte, setOuverte] = useState(null);
  const [type, setType] = useState('satisfaction');
  const [brouillon, setBrouillon] = useState({});

  const charger = useCallback(async () => {
    const r = await fetch('/api/griotheque/evaluations').then((x) => x.json()).catch(() => null);
    setD(r);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const enregistrer = async (sessionId, apprenantId) => {
    const cle = apprenantId + ':' + type;
    const v = brouillon[cle] || {};
    if (v.score === undefined && !v.comments) return;
    await fetch('/api/griotheque/evaluations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, apprenant_id: apprenantId, type, score: v.score, comments: v.comments }),
    });
    setBrouillon((b) => { const n = { ...b }; delete n[cle]; return n; });
    charger();
  };

  const retirer = async (sessionId, apprenantId) => {
    await fetch(`/api/griotheque/evaluations?session_id=${sessionId}&apprenant_id=${apprenantId}&type=${type}`,
      { method: 'DELETE' });
    charger();
  };

  const sessions = d?.sessions || [];
  const aTraiter = sessions.filter((s) => s.manque);
  const autres = sessions.filter((s) => !s.manque);

  return (
    <>
      <TopBar
        title="Évaluations"
        subtitle={d
          ? `${d.total_reponses} réponse(s) · moyenne ${d.moyenne_globale ?? '—'}${d.moyenne_globale ? ' / 5' : ''}`
          : ''}
      />

      <div style={{ padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1000 }}>

        {!d && <Skeleton />}

        {d && (
          <>
            <div style={{
              display: 'flex', gap: 34, flexWrap: 'wrap', alignItems: 'flex-end',
              paddingBottom: 14, borderBottom: '1px solid var(--border)',
            }}>
              {[
                ['Réponses collectées', String(d.total_reponses)],
                ['Moyenne', d.moyenne_globale != null ? d.moyenne_globale + ' / 5' : '—'],
                ['Sessions sans enquête', String(d.sessions_sans_enquete)],
              ].map(([l, v]) => (
                <div key={l}>
                  <div style={mono}>{l}</div>
                  <div style={{
                    fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 2,
                    fontVariantNumeric: 'tabular-nums',
                    color: l === 'Sessions sans enquête' && d.sessions_sans_enquete ? 'var(--gold-deep)' : 'inherit',
                  }}>{v}</div>
                </div>
              ))}

              <div style={{ marginLeft: 'auto', display: 'inline-flex', background: 'var(--surface-2)',
                            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 2, gap: 1 }}>
                {TYPES.map((t) => (
                  <button key={t.cle} onClick={() => setType(t.cle)} title={t.quand}
                    style={{
                      padding: '4px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      background: type === t.cle ? 'var(--surface)' : 'transparent',
                      border: '1px solid ' + (type === t.cle ? 'var(--border)' : 'transparent'),
                      color: type === t.cle ? 'var(--text)' : 'var(--text-3)',
                      fontSize: 11, fontWeight: type === t.cle ? 500 : 400, fontFamily: 'inherit',
                    }}>{t.label}</button>
                ))}
              </div>
            </div>

            {sessions.length === 0 && (
              <EmptyState title="Aucune session" message="Les évaluations apparaîtront dès qu’une session existe." />
            )}

            {aTraiter.length > 0 && (
              <div>
                <div style={{ ...mono, marginBottom: 8 }}>
                  À récupérer · {aTraiter.length} session(s) terminée(s) sans enquête
                </div>
                {aTraiter.map((s) => (
                  <LigneSession key={s.id} s={s} type={type} ouverte={ouverte} setOuverte={setOuverte}
                                brouillon={brouillon} setBrouillon={setBrouillon}
                                onEnregistrer={enregistrer} onRetirer={retirer} alerte />
                ))}
              </div>
            )}

            {autres.length > 0 && (
              <div>
                <div style={{ ...mono, marginBottom: 8, marginTop: 8 }}>Autres sessions</div>
                {autres.map((s) => (
                  <LigneSession key={s.id} s={s} type={type} ouverte={ouverte} setOuverte={setOuverte}
                                brouillon={brouillon} setBrouillon={setBrouillon}
                                onEnregistrer={enregistrer} onRetirer={retirer} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function LigneSession({ s, type, ouverte, setOuverte, brouillon, setBrouillon, onEnregistrer, onRetirer, alerte }) {
  const estOuverte = ouverte === s.id;
  const faits = s.inscrits.filter((a) => a.evaluations[type]).length;

  return (
    <Card style={{ marginBottom: 8, borderColor: alerte ? 'var(--gold)' : undefined }}>
      <div
        onClick={() => setOuverte(estOuverte ? null : s.id)}
        style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', flexWrap: 'wrap' }}
      >
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500 }}>
            {s.session_name || s.formation_titre || 'Session sans nom'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {dateFr(s.start_date)} · {s.inscrits.length} inscrit(s)
            {s.terminee ? ' · terminée' : ''}
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
          {faits} / {s.inscrits.length} recueilli(s)
        </div>
        {s.moyenne != null && (
          <div style={{ fontSize: 13.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {s.moyenne} / 5
          </div>
        )}
        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{estOuverte ? '▾' : '▸'}</span>
      </div>

      {estOuverte && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          {s.inscrits.length === 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Aucun inscrit sur cette session.</div>
          )}
          {s.inscrits.map((a) => {
            const cle = a.id + ':' + type;
            const deja = a.evaluations[type];
            const v = brouillon[cle] || {};
            return (
              <div key={a.id} style={{
                display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) 92px minmax(160px, 1.4fr) 92px',
                gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 13 }}>{a.nom}</div>
                {deja ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {deja.score != null ? deja.score + ' / 5' : '—'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{deja.comments || '—'}</div>
                    <button
                      onClick={() => onRetirer(s.id, a.id)}
                      title="Retirer cette note"
                      style={{
                        ...mono, fontSize: 9.5, color: 'var(--text-3)', background: 'none',
                        border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px',
                        cursor: 'pointer', textAlign: 'center',
                      }}
                    >Retirer</button>
                  </>
                ) : (
                  <>
                    <input
                      value={v.score ?? ''}
                      onChange={(e) => setBrouillon((b) => ({ ...b, [cle]: { ...v, score: e.target.value.replace(/[^0-9.,]/g, '') } }))}
                      placeholder="0 à 5" inputMode="decimal"
                      style={champ}
                    />
                    <input
                      value={v.comments ?? ''}
                      onChange={(e) => setBrouillon((b) => ({ ...b, [cle]: { ...v, comments: e.target.value } }))}
                      placeholder="Commentaire"
                      style={champ}
                    />
                    <button
                      onClick={() => onEnregistrer(s.id, a.id)}
                      style={{
                        padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: 'none',
                        background: 'var(--gold)', color: '#141310', fontFamily: 'inherit',
                        fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                      }}
                    >Noter</button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

const champ = {
  width: '100%', padding: '5px 8px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-2)', background: 'var(--surface)',
  color: 'var(--text)', fontFamily: 'inherit', fontSize: 12.5,
};
