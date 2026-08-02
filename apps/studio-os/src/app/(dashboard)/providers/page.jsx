'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import {
  Card, Badge, Button, Skeleton, EmptyState, StarRating,
  ViewSwitcher, useViewMode,
} from '@/components/ui';
import { PROVIDER_CATEGORIES } from '@/lib/constants';

const fmt = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);

function parseCats(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export default function ProvidersPage() {
  const router = useRouter();
  const [providers, setProviders] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [sort, setSort] = useState('name');
  const [view, setView] = useViewMode('providers', 'cards');

  useEffect(() => {
    setLoadError(false);
    fetch('/api/data')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => {
        setProviders(d.providers || []);
        setProjects(d.projects || []);
        setLoading(false);
      })
      .catch((e) => { console.warn('[Prestataires] Chargement échoué :', e); setLoadError(true); setLoading(false); });
  }, [reloadKey]);

  // Enrich providers with stats (total spent, projects count, last activity)
  const enriched = useMemo(() => providers.map(p => {
    const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.name || '';
    let totalSpent = 0;
    let expenseCount = 0;
    let lastDate = '';
    const projectIds = new Set();
    for (const proj of projects) {
      for (const e of (proj.expenses || [])) {
        if (e.provider_id === p.id || e.provider === fullName) {
          totalSpent += Number(e.amount_ttc) || 0;
          expenseCount += 1;
          projectIds.add(proj.id);
          if (e.date && e.date > lastDate) lastDate = e.date;
        }
      }
      for (const t of (proj.tasks || [])) {
        if (t.assigneeId === p.id) projectIds.add(proj.id);
      }
    }
    return {
      ...p,
      fullName,
      cats: parseCats(p.categories),
      totalSpent,
      expenseCount,
      projectCount: projectIds.size,
      lastDate,
    };
  }), [providers, projects]);

  // Collect all categories present in data + standard ones
  const allCategories = useMemo(() => {
    const set = new Set(PROVIDER_CATEGORIES);
    for (const p of enriched) for (const c of p.cats) set.add(c);
    return [...set].sort();
  }, [enriched]);

  const filtered = enriched.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || p.fullName.toLowerCase().includes(q)
      || (p.email || '').toLowerCase().includes(q)
      || p.cats.some(c => c.toLowerCase().includes(q))
      || (p.category || '').toLowerCase().includes(q)
      || (p.company || '').toLowerCase().includes(q);
    const matchCat = catFilter === 'all'
      || p.cats.includes(catFilter)
      || p.category === catFilter;
    return matchSearch && matchCat;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'name')     return a.fullName.localeCompare(b.fullName);
    if (sort === 'rating')   return (Number(b.rating) || 0) - (Number(a.rating) || 0);
    if (sort === 'spent')    return b.totalSpent - a.totalSpent;
    if (sort === 'projects') return b.projectCount - a.projectCount;
    if (sort === 'recent')   return (b.lastDate || '').localeCompare(a.lastDate || '');
    return 0;
  });

  const onClick = (id) => router.push(`/providers/${id}`);
  const totalSpentAll = filtered.reduce((s, p) => s + p.totalSpent, 0);
  const avgRating = filtered.length
    ? filtered.reduce((s, p) => s + (Number(p.rating) || 0), 0) / filtered.length
    : 0;

  return (
    <>
      <TopBar
        title="Prestataires"
        subtitle={`${providers.length} prestataire${providers.length > 1 ? 's' : ''} · ${fmt(totalSpentAll)} engagé${totalSpentAll > 0 ? '' : ''}`}
      />
      <div style={{
        padding: 'var(--sp-6)',
        display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
      }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un prestataire, catégorie, email…"
            style={{
              flex: 1, maxWidth: 360, padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 13, outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            style={{
              padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12,
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--text)', cursor: 'pointer', outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <option value="all">Toutes catégories</option>
            {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { key: 'name',     label: 'A→Z' },
              { key: 'rating',   label: '★' },
              { key: 'spent',    label: 'CA' },
              { key: 'projects', label: 'Projets' },
              { key: 'recent',   label: 'Récent' },
            ].map(s => (
              <button key={s.key} onClick={() => setSort(s.key)} style={sortBtnStyle(sort === s.key)}>
                {s.label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <ViewSwitcher value={view} onChange={setView} options={['cards', 'list']} />
        </div>

        {/* Erreur de chargement */}
        {loadError && !loading && (
          <Card variant="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--danger)', fontSize: 13 }}>Impossible de charger les prestataires.</span>
              <Button variant="danger" size="sm" onClick={() => { setLoading(true); setReloadKey(k => k + 1); }}>Réessayer</Button>
            </div>
          </Card>
        )}

        {/* Content */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={140} />)}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon="◌"
            title={search || catFilter !== 'all' ? 'Aucun résultat' : 'Aucun prestataire'}
            message={search || catFilter !== 'all' ? 'Affine la recherche.' : 'Ajoute ton premier prestataire pour commencer.'}
          />
        ) : view === 'cards' ? (
          <CardsView providers={sorted} onClick={onClick} />
        ) : (
          <ListView providers={sorted} onClick={onClick} />
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Cards view
// ─────────────────────────────────────────────────────────
function CardsView({ providers, onClick }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: 12,
    }} className="lg-stagger">
      {providers.map(p => {
        const initials = p.fullName.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
        return (
          <Card key={p.id} interactive onClick={() => onClick(p.id)} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'var(--gold-soft)', color: 'var(--gold)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, fontWeight: 600,
                fontFamily: 'var(--font-title)', flexShrink: 0,
              }}>{initials || '?'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 500, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {p.fullName || '—'}
                </div>
                {p.company && (
                  <div style={{
                    fontSize: 11, color: 'var(--text-3)', marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{p.company}</div>
                )}
              </div>
            </div>

            {/* StarRating */}
            <div style={{ marginBottom: 10 }}>
              <StarRating value={Number(p.rating) || 0} size={14} />
            </div>

            {/* Catégories */}
            {p.cats.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                {p.cats.slice(0, 3).map(c => (
                  <Badge key={c} tone="gold" size="sm">{c}</Badge>
                ))}
                {p.cats.length > 3 && (
                  <Badge tone="neutral" size="sm" mono>+{p.cats.length - 3}</Badge>
                )}
              </div>
            )}

            {/* Stats */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '8px 0', borderTop: '1px solid var(--border)',
              fontSize: 11,
            }}>
              <div>
                <div style={miniLabel}>Tarif jour</div>
                <div style={miniValue}>
                  {p.tarifJour ? fmt(p.tarifJour) : '—'}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={miniLabel}>Projets</div>
                <div style={miniValue}>{p.projectCount}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={miniLabel}>Total dépensé</div>
                <div style={{ ...miniValue, color: p.totalSpent ? 'var(--text)' : 'var(--text-3)' }}>
                  {p.totalSpent ? fmt(p.totalSpent) : '—'}
                </div>
              </div>
            </div>

            {(p.email || p.phone) && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)' }}>
                {p.email && <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✉ {p.email}</div>}
                {p.phone && <div>☎ {p.phone}</div>}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// List view
// ─────────────────────────────────────────────────────────
function ListView({ providers, onClick }) {
  return (
    <Card padding="none">
      <div className="resp-table-head" style={{
        display: 'grid',
        gridTemplateColumns: '1.8fr 1.4fr 120px 100px 90px 110px',
        padding: '10px 18px',
        borderBottom: '1px solid var(--border)',
        fontSize: 10, fontWeight: 600, color: 'var(--text-3)',
        letterSpacing: 0.5, textTransform: 'uppercase',
        fontFamily: 'var(--font-mono)',
      }}>
        <span>Prestataire</span>
        <span>Catégories</span>
        <span>Rating</span>
        <span style={{ textAlign: 'right' }}>Tarif/j</span>
        <span style={{ textAlign: 'right' }}>Projets</span>
        <span style={{ textAlign: 'right' }}>Dépensé</span>
      </div>
      {providers.map((p, i) => (
        <div
          key={p.id}
          className="resp-table-row"
          onClick={() => onClick(p.id)}
          tabIndex={0}
          role="button"
          onKeyDown={(e) => { if (e.key === 'Enter') onClick(p.id); }}
          style={{
            display: 'grid',
            gridTemplateColumns: '1.8fr 1.4fr 120px 100px 90px 110px',
            padding: '12px 18px',
            borderBottom: i < providers.length - 1 ? '1px solid var(--border)' : 'none',
            alignItems: 'center', fontSize: 13, cursor: 'pointer',
            transition: 'background var(--duration) var(--ease)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.fullName || '—'}
          </span>
          <span style={{
            color: 'var(--text-3)', fontSize: 11,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {p.cats.slice(0, 2).join(' · ') || p.category || '—'}
            {p.cats.length > 2 && ` +${p.cats.length - 2}`}
          </span>
          <span>
            <StarRating value={Number(p.rating) || 0} size={12} />
          </span>
          <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: p.tarifJour ? 'var(--text)' : 'var(--text-3)' }}>
            {p.tarifJour ? fmt(p.tarifJour) : '—'}
          </span>
          <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: p.projectCount ? 'var(--text)' : 'var(--text-3)' }}>
            {p.projectCount || '—'}
          </span>
          <span style={{
            textAlign: 'right', fontFamily: 'var(--font-mono)',
            fontWeight: 600, color: p.totalSpent ? 'var(--text)' : 'var(--text-3)',
          }}>
            {p.totalSpent ? fmt(p.totalSpent) : '—'}
          </span>
        </div>
      ))}
    </Card>
  );
}

const sortBtnStyle = (active) => ({
  padding: '5px 10px',
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
  fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6,
  color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
  marginBottom: 3,
};
const miniValue = {
  fontSize: 13, fontWeight: 600,
  color: 'var(--text)', fontFamily: 'var(--font-mono)',
};
