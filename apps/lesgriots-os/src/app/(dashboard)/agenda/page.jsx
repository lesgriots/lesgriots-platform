'use client';

/**
 * /agenda — les sessions dans le temps.
 *
 * Trois lectures, comme dans l'outil que tu quittais : le calendrier pour
 * situer un mois, le planning pour la suite chronologique, la frise pour voir
 * l'année d'un seul regard. Les dates existaient déjà en base, il manquait
 * seulement l'écran.
 *
 * Couleur : encre et papier. L'or ne marque qu'aujourd'hui.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import { Card, EmptyState, Skeleton, ViewSwitcher, useViewMode } from '@/components/ui';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
              'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

const mono = {
  fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: 'var(--text-3)',
};

const iso = (d) => d.toISOString().slice(0, 10);
const dateFr = (d) => d
  ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  : '—';

const STATUTS = {
  planned: 'Planifiée', ongoing: 'En cours', completed: 'Terminée', cancelled: 'Annulée',
};

export default function AgendaPage() {
  const [sessions, setSessions] = useState(null);
  const [curseur, setCurseur] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [vue, setVue] = useViewMode('agenda-of', 'calendar');
  const [filtre, setFiltre] = useState('all');

  useEffect(() => {
    Promise.all([
      fetch('/api/sessions').then((r) => r.json()).catch(() => []),
      fetch('/api/formations').then((r) => r.json()).catch(() => []),
    ]).then(([s, f]) => {
      const parId = Object.fromEntries((Array.isArray(f) ? f : []).map((x) => [x.id, x.title]));
      setSessions((Array.isArray(s) ? s : []).map((x) => ({ ...x, formation_titre: parId[x.formation_id] || '' })));
    });
  }, []);

  const visibles = useMemo(() => (sessions || []).filter((s) => {
    if (filtre === 'all') return true;
    return String(s.status || '').toLowerCase() === filtre;
  }), [sessions, filtre]);

  const aujourdhui = iso(new Date());

  // ── Calendrier : la grille du mois, lundi en premier ──
  const grille = useMemo(() => {
    const an = curseur.getFullYear(), m = curseur.getMonth();
    const premier = new Date(an, m, 1);
    const decalage = (premier.getDay() + 6) % 7;      // 0 = lundi
    const debut = new Date(an, m, 1 - decalage);
    return Array.from({ length: 42 }, (_, i) => {
      const j = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + i);
      const cle = iso(j);
      return {
        cle, numero: j.getDate(), horsMois: j.getMonth() !== m, aujourdhui: cle === aujourdhui,
        sessions: visibles.filter((s) => s.start_date && cle >= s.start_date && cle <= (s.end_date || s.start_date)),
      };
    });
  }, [curseur, visibles, aujourdhui]);

  const aVenir = useMemo(() => [...visibles]
    .filter((s) => s.start_date)
    .sort((a, b) => a.start_date.localeCompare(b.start_date)), [visibles]);

  return (
    <>
      <TopBar
        title="Agenda"
        subtitle={sessions ? `${visibles.length} session(s)` : ''}
        right={
          <ViewSwitcher
            value={vue} onChange={setVue}
            options={['calendar', 'list', 'timeline']}
            labels={{ calendar: { glyph: '◰', label: 'Calendrier' }, list: { glyph: '☰', label: 'Planning' }, timeline: { glyph: '↔', label: 'Frise' } }}
          />
        }
      />

      <div style={{ padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {!sessions && <Skeleton />}

        {sessions && (
          <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {vue === 'calendar' && (
                <>
                  <button onClick={() => setCurseur(new Date(curseur.getFullYear(), curseur.getMonth() - 1, 1))} style={bouton}>‹</button>
                  <button onClick={() => { const d = new Date(); d.setDate(1); setCurseur(d); }} style={bouton}>Aujourd’hui</button>
                  <button onClick={() => setCurseur(new Date(curseur.getFullYear(), curseur.getMonth() + 1, 1))} style={bouton}>›</button>
                  <strong style={{ fontSize: 15, letterSpacing: '-0.015em', marginLeft: 6 }}>
                    {MOIS[curseur.getMonth()]} {curseur.getFullYear()}
                  </strong>
                </>
              )}
              <select value={filtre} onChange={(e) => setFiltre(e.target.value)}
                      style={{ ...bouton, marginLeft: 'auto', cursor: 'pointer' }}>
                <option value="all">Tous les statuts</option>
                {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {vue === 'calendar' && (
              <Card padding="none">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {JOURS.map((j) => (
                    <div key={j} style={{ ...mono, padding: '10px 10px 8px', borderBottom: '1px solid var(--border-2)' }}>{j}</div>
                  ))}
                  {grille.map((c) => (
                    <div key={c.cle} style={{
                      minHeight: 96, padding: 7, borderBottom: '1px solid var(--border)',
                      borderRight: '1px solid var(--border)',
                      background: c.horsMois ? 'var(--surface-2)' : 'transparent',
                      opacity: c.horsMois ? 0.55 : 1,
                    }}>
                      <div style={{
                        fontSize: 11.5, fontVariantNumeric: 'tabular-nums', marginBottom: 5,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 20, height: 20, borderRadius: '50%',
                        background: c.aujourdhui ? 'var(--gold)' : 'transparent',
                        color: c.aujourdhui ? '#141210' : 'var(--text-3)',
                        fontWeight: c.aujourdhui ? 600 : 400,
                      }}>{c.numero}</div>
                      {c.sessions.map((s) => (
                        <Link key={s.id} href="/sessions-list" style={{
                          display: 'block', fontSize: 10.5, lineHeight: 1.3, marginBottom: 3,
                          padding: '3px 5px', borderRadius: 4, textDecoration: 'none',
                          background: 'var(--surface-3)', color: 'var(--text)',
                          borderLeft: '2px solid var(--text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{s.session_name || s.formation_titre || 'Session'}</Link>
                      ))}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {vue === 'list' && (
              aVenir.length === 0
                ? <EmptyState title="Rien au planning" message="Aucune session ne porte de date pour ce filtre." />
                : (
                  <Card padding="none">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>{['Session', 'Formation', 'Début', 'Fin', 'Lieu', 'Statut'].map((h) => (
                          <th key={h} style={{ ...mono, fontWeight: 400, textAlign: 'left', padding: '11px 10px', borderBottom: '1px solid var(--border-2)' }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {aVenir.map((s) => (
                          <tr key={s.id} style={s.start_date === aujourdhui ? { background: 'var(--gold-soft)' } : undefined}>
                            <td style={{ ...td, fontWeight: 500 }}>{s.session_name || '—'}</td>
                            <td style={{ ...td, color: 'var(--text-3)' }}>{s.formation_titre || '—'}</td>
                            <td style={td}>{dateFr(s.start_date)}</td>
                            <td style={td}>{dateFr(s.end_date)}</td>
                            <td style={{ ...td, color: 'var(--text-3)' }}>{s.location || s.adresse || '—'}</td>
                            <td style={{ ...td, ...mono, fontSize: 9.5 }}>{STATUTS[String(s.status || '').toLowerCase()] || s.status || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )
            )}

            {vue === 'timeline' && <Frise sessions={aVenir} aujourdhui={aujourdhui} />}
          </>
        )}
      </div>
    </>
  );
}

/** La frise : une barre par session, positionnée sur l'amplitude réelle. */
function Frise({ sessions, aujourdhui }) {
  if (sessions.length === 0) {
    return <EmptyState title="Rien à situer" message="Aucune session datée pour ce filtre." />;
  }
  const dates = sessions.flatMap((s) => [s.start_date, s.end_date || s.start_date]).filter(Boolean).sort();
  const debut = new Date(dates[0] + 'T00:00:00').getTime();
  const fin = new Date(dates[dates.length - 1] + 'T00:00:00').getTime();
  const etendue = Math.max(fin - debut, 86400000);
  const pos = (d) => ((new Date(d + 'T00:00:00').getTime() - debut) / etendue) * 100;

  return (
    <Card>
      <div style={{ position: 'relative' }}>
        {/* Aujourd'hui, si la période le contient */}
        {aujourdhui >= dates[0] && aujourdhui <= dates[dates.length - 1] && (
          <div style={{
            position: 'absolute', left: `${pos(aujourdhui)}%`, top: 0, bottom: 0,
            width: 2, background: 'var(--gold)', zIndex: 1,
          }} />
        )}
        {sessions.map((s) => {
          const g = pos(s.start_date);
          const l = Math.max(pos(s.end_date || s.start_date) - g, 1.5);
          return (
            <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: 12, alignItems: 'center', padding: '5px 0' }}>
              <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.session_name || s.formation_titre || 'Session'}
              </div>
              <div style={{ position: 'relative', height: 22 }}>
                <div style={{ position: 'absolute', inset: '9px 0 9px 0', background: 'var(--surface-2)', borderRadius: 2 }} />
                <div title={`${dateFr(s.start_date)} → ${dateFr(s.end_date)}`} style={{
                  position: 'absolute', left: `${g}%`, width: `${l}%`, top: 5, height: 12,
                  background: String(s.status || '').toLowerCase() === 'completed' ? 'var(--text-3)' : 'var(--text)',
                  borderRadius: 3, minWidth: 6,
                }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingLeft: 222 }}>
        <span style={mono}>{dateFr(dates[0])}</span>
        <span style={mono}>{dateFr(dates[dates.length - 1])}</span>
      </div>
    </Card>
  );
}

const bouton = {
  padding: '5px 11px', borderRadius: 'var(--radius-md)', fontSize: 11.5,
  border: '1px solid var(--border-2)', background: 'var(--surface)',
  color: 'var(--text-2)', fontFamily: 'inherit', cursor: 'pointer',
};
const td = { padding: '11px 10px', borderBottom: '1px solid var(--border)', fontSize: 13 };
