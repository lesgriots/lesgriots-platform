'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import {
  Card, Badge, Button, Skeleton, EmptyState,
  ViewSwitcher, useViewMode,
} from '@/components/ui';

const fmt = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('company');
  const [view, setView] = useViewMode('clients', 'list');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoadError(false);
    fetch('/api/data')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => {
        setClients(Array.isArray(d.clients) ? d.clients : []);
        setProjects(Array.isArray(d.projects) ? d.projects : []);
        setLoading(false);
      })
      .catch((e) => { console.warn('[Clients] Chargement échoué :', e); setLoadError(true); setLoading(false); });
  }, [reloadKey]);

  // Enrichir clients avec compteur projets + total CA
  const enriched = useMemo(() => clients.map(c => {
    const cp = projects.filter(p => p.clientId === c.id);
    const totalCa = cp.reduce((s, p) => s + (p.revenue || 0), 0);
    const paidCa  = cp.filter(p => p.stage === 'paid').reduce((s, p) => s + (p.revenue || 0), 0);
    return {
      ...c,
      projectCount: cp.length,
      activeCount: cp.filter(p => !['paid', 'lost'].includes(p.stage)).length,
      totalCa, paidCa,
    };
  }), [clients, projects]);

  const filtered = enriched.filter(c => {
    const q = search.toLowerCase();
    return !q
      || (c.company || '').toLowerCase().includes(q)
      || (c.firstName || '').toLowerCase().includes(q)
      || (c.lastName || '').toLowerCase().includes(q)
      || (c.email || '').toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'company') return (a.company || '').localeCompare(b.company || '');
    if (sort === 'ca')      return b.totalCa - a.totalCa;
    if (sort === 'recent')  return (b.createdAt || '').localeCompare(a.createdAt || '');
    if (sort === 'projects')return b.projectCount - a.projectCount;
    return 0;
  });

  const onClick = (id) => router.push(`/clients/${id}`);

  return (
    <>
      <TopBar
        title="Clients"
        subtitle={`${clients.length} client${clients.length > 1 ? 's' : ''}`}
      />
      {/* Deux écrans lisent la même table : celui-ci, hérité de l'agence, et
          Entreprises, avec les fiches de l'organisme de formation. C'est
          Entreprises qui fait foi ; on le dit ici plutôt que de laisser
          saisir au mauvais endroit. */}
      <div style={{ margin: '0 24px 16px', padding: '12px 14px', borderRadius: 10, background: 'var(--gold-soft)', border: '1.5px solid color-mix(in srgb, var(--gold) 45%, transparent)', fontSize: 12.5, lineHeight: 1.6 }}>
        Écran hérité de l’agence. Pour l’organisme de formation, l’écran de référence est{' '}
        <a href="/entreprises" style={{ color: 'var(--gold)', fontWeight: 700 }}>Entreprises</a>, avec les fiches complètes : SIRET, facturation, OPCO, contacts et leurs rôles.
      </div>
      <div style={{
        padding: 'var(--sp-6)',
        display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
      }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un client…"
            style={{
              flex: 1, maxWidth: 360, padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 13,
              outline: 'none', fontFamily: 'var(--font-sans)',
            }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { key: 'company',  label: 'A→Z' },
              { key: 'ca',       label: 'CA' },
              { key: 'projects', label: 'Projets' },
              { key: 'recent',   label: 'Récent' },
            ].map(s => (
              <button key={s.key} onClick={() => setSort(s.key)} style={sortBtnStyle(sort === s.key)}>
                {s.label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <ViewSwitcher value={view} onChange={setView} options={['list', 'cards']} />
        </div>

        {/* Erreur de chargement */}
        {loadError && !loading && (
          <Card variant="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--danger)', fontSize: 13 }}>Impossible de charger les clients.</span>
              <Button variant="danger" size="sm" onClick={() => { setLoading(true); setReloadKey(k => k + 1); }}>Réessayer</Button>
            </div>
          </Card>
        )}

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={56} />)}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon="◌"
            title={search ? 'Aucun résultat' : 'Aucun client'}
            message={search ? 'Affine la recherche.' : 'Crée ton premier client pour démarrer.'}
          />
        ) : view === 'cards' ? (
          <CardsView clients={sorted} onClick={onClick} />
        ) : (
          <ListView clients={sorted} onClick={onClick} />
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// View — Liste (table)
// ─────────────────────────────────────────────────────────
function ListView({ clients, onClick }) {
  return (
    <Card padding="none">
      <div className="resp-table-head" style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1.4fr 1.4fr 100px 100px',
        padding: '10px 18px',
        borderBottom: '1px solid var(--border)',
        fontSize: 10, fontWeight: 600, color: 'var(--text-3)',
        letterSpacing: 0.5, textTransform: 'uppercase',
        fontFamily: 'var(--font-mono)',
      }}>
        <span>Entreprise</span>
        <span>Contact</span>
        <span>Email</span>
        <span style={{ textAlign: 'right' }}>Projets</span>
        <span style={{ textAlign: 'right' }}>CA total</span>
      </div>
      {clients.map((c, i) => (
        <div
          key={c.id}
          className="resp-table-row"
          onClick={() => onClick(c.id)}
          tabIndex={0}
          role="button"
          onKeyDown={(e) => { if (e.key === 'Enter') onClick(c.id); }}
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.4fr 1.4fr 100px 100px',
            padding: '12px 18px',
            borderBottom: i < clients.length - 1 ? '1px solid var(--border)' : 'none',
            alignItems: 'center', fontSize: 13, cursor: 'pointer',
            transition: 'background var(--duration) var(--ease)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.company || `${c.firstName || ''} ${c.lastName || ''}`.trim() || '—'}
          </span>
          <span style={{ color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.company ? `${c.firstName || ''} ${c.lastName || ''}`.trim() : '—'}
          </span>
          <span style={{ color: 'var(--text-3)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.email || '—'}
          </span>
          <span style={{ textAlign: 'right', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            {c.projectCount}{c.activeCount > 0 && <span style={{ color: 'var(--gold)' }}> ({c.activeCount})</span>}
          </span>
          <span style={{
            textAlign: 'right', fontFamily: 'var(--font-mono)',
            fontWeight: 600, color: c.totalCa ? 'var(--text)' : 'var(--text-3)',
          }}>
            {c.totalCa ? fmt(c.totalCa) : '—'}
          </span>
        </div>
      ))}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// View — Cards (grid)
// ─────────────────────────────────────────────────────────
function CardsView({ clients, onClick }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      gap: 12,
    }} className="lg-stagger">
      {clients.map(c => {
        const initials = (c.company || `${c.firstName || ''} ${c.lastName || ''}`.trim() || '?')
          .split(' ').filter(Boolean).slice(0, 2)
          .map(w => w[0]?.toUpperCase()).join('');
        return (
          <Card key={c.id} interactive padding="md" onClick={() => onClick(c.id)} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'var(--gold-soft)', color: 'var(--gold)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 600,
                fontFamily: 'var(--font-title)', flexShrink: 0,
              }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 500, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {c.company || `${c.firstName || ''} ${c.lastName || ''}`.trim() || '—'}
                </div>
                {c.company && (c.firstName || c.lastName) && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    {`${c.firstName || ''} ${c.lastName || ''}`.trim()}
                  </div>
                )}
              </div>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '8px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
              fontSize: 11,
            }}>
              <div>
                <div style={miniLabel}>Projets</div>
                <div style={miniValue}>
                  {c.projectCount}
                  {c.activeCount > 0 && (
                    <span style={{ color: 'var(--gold)', fontSize: 10, marginLeft: 4 }}>
                      ({c.activeCount} actif{c.activeCount > 1 ? 's' : ''})
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={miniLabel}>CA total</div>
                <div style={{ ...miniValue, color: c.totalCa ? 'var(--text)' : 'var(--text-3)' }}>
                  {c.totalCa ? fmt(c.totalCa) : '—'}
                </div>
              </div>
            </div>
            {(c.email || c.phone) && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)' }}>
                {c.email && <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✉ {c.email}</div>}
                {c.phone && <div>☎ {c.phone}</div>}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

const sortBtnStyle = (active) => ({
  padding: '5px 12px',
  borderRadius: 'var(--radius-sm)',
  fontSize: 11,
  fontWeight: 500,
  cursor: 'pointer',
  border: '1px solid ' + (active ? 'var(--gold)' : 'var(--border)'),
  background: active ? 'var(--gold-soft)' : 'transparent',
  color: active ? 'var(--gold-deep)' : 'var(--text-3)',
  fontFamily: 'var(--font-sans)',
  transition: 'all var(--duration) var(--ease)',
});

const miniLabel = {
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  color: 'var(--text-3)',
  fontFamily: 'var(--font-mono)',
  marginBottom: 3,
};

const miniValue = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
};
