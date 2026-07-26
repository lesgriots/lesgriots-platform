'use client';

/**
 * /catalogue — le catalogue de formations, DANS la coquille de l'OS.
 *
 * Existait déjà, mais seulement à l'intérieur de l'ancienne interface
 * `/formations`, qui a sa propre barre latérale : cliquer sur « Formations »
 * te faisait donc sortir de l'OS et atterrir dans une autre application.
 * Cette page corrige ça — même coquille, même identité, on ne sort plus.
 *
 * L'ancienne interface reste accessible pour ce qui n'est pas encore migré
 * (pipeline, intervenants, lieux, qualité), via le lien en bas de page.
 */

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import { Card, Badge, Skeleton, EmptyState } from '@/components/ui';

const euros = (n) => n
  ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  : '—';

export default function CataloguePage() {
  const [formations, setFormations] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [q, setQ] = useState('');
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/formations').then((r) => r.json()),
      fetch('/api/sessions').then((r) => r.json()).catch(() => []),
    ])
      .then(([f, s]) => {
        setFormations(Array.isArray(f) ? f : (f.items || []));
        setSessions(Array.isArray(s) ? s : (s.items || []));
      })
      .catch((e) => { console.warn('[Catalogue]', e); setErreur('Chargement impossible.'); });
  }, []);

  // Nombre de sessions par formation : l'information la plus parlante
  // à côté d'un titre de catalogue.
  const compteur = useMemo(() => {
    const m = {};
    for (const s of sessions) m[s.formation_id] = (m[s.formation_id] || 0) + 1;
    return m;
  }, [sessions]);

  const visibles = useMemo(() => {
    if (!formations) return [];
    const t = q.trim().toLowerCase();
    if (!t) return formations;
    return formations.filter((f) =>
      [f.title, f.categorie, f.thematique].filter(Boolean).join(' ').toLowerCase().includes(t));
  }, [formations, q]);

  return (
    <>
      <TopBar title="Formations" subtitle={formations ? `${formations.length} au catalogue` : ''} />

      <div style={{ padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {erreur && <Card><p style={{ color: 'var(--danger)', margin: 0 }}>{erreur}</p></Card>}
        {!formations && !erreur && <Skeleton />}

        {formations && (
          <>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher une formation…"
              style={{
                width: '100%', maxWidth: 420, padding: '10px 13px',
                border: '1px solid var(--border-2)', borderRadius: 8,
                background: 'var(--surface)', color: 'var(--text)',
                fontFamily: 'inherit', fontSize: 14,
              }}
            />

            {visibles.length === 0 ? (
              <EmptyState title="Aucune formation" message="Aucun résultat pour cette recherche." />
            ) : (
              <Card padding="none">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead>
                    <tr>
                      {['Formation', 'Durée', 'Tarif', 'Sessions', 'Statut'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', fontSize: 10, letterSpacing: '0.1em',
                          textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 500,
                          padding: '14px 12px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((f) => (
                      <tr key={f.id}>
                        <td style={{ padding: '13px 12px', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ fontWeight: 500 }}>{f.title}</div>
                          {(f.categorie || f.thematique) && (
                            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{f.categorie || f.thematique}</div>
                          )}
                        </td>
                        <td style={{ padding: '13px 12px', borderBottom: '1px solid var(--border)' }}>
                          {f.duration_hours ? `${f.duration_hours} h` : '—'}
                          {f.duration_days ? ` · ${f.duration_days} j` : ''}
                        </td>
                        <td style={{ padding: '13px 12px', borderBottom: '1px solid var(--border)' }}>{euros(f.price_ht)}</td>
                        <td style={{ padding: '13px 12px', borderBottom: '1px solid var(--border)' }}>{compteur[f.id] || 0}</td>
                        <td style={{ padding: '13px 12px', borderBottom: '1px solid var(--border)' }}>
                          <Badge tone={String(f.status || '').toLowerCase() === 'active' ? 'success' : 'neutral'}>
                            {f.status || '—'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: 0 }}>
              Pipeline, intervenants, lieux et qualité ne sont pas encore migrés dans cette coquille :{' '}
              <Link href="/formations" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
                ouvrir l’ancienne interface ↗
              </Link>
            </p>
          </>
        )}
      </div>
    </>
  );
}
