'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import { DISCIPLINES } from '@/lib/constants';
import { DisciplinesBadges } from '@/components/DisciplinesPicker';
import {
  Card, Badge, Button, Skeleton, EmptyState,
  ViewSwitcher, useViewMode, useToast,
} from '@/components/ui';

const STAGES = [
  { key: 'lead',        label: 'Lead',     prob: 0.05, tone: 'neutral', color: 'var(--text-3)' },
  { key: 'need',        label: 'Besoin',   prob: 0.10, tone: 'neutral', color: 'var(--text-3)' },
  { key: 'qualify',     label: 'Qualif',   prob: 0.25, tone: 'info',    color: 'var(--info)' },
  { key: 'quoted',      label: 'Devis',    prob: 0.40, tone: 'gold',    color: 'var(--gold)' },
  { key: 'negotiation', label: 'Négo',     prob: 0.60, tone: 'warning', color: 'var(--warning)' },
  { key: 'signed',      label: 'Signé',    prob: 0.90, tone: 'success', color: 'var(--success)' },
  { key: 'active',      label: 'Actif',    prob: 0.95, tone: 'success', color: 'var(--success)' },
  { key: 'delivered',   label: 'Livré',    prob: 0.98, tone: 'pillar',  color: 'var(--pillar-prod)' },
  { key: 'paid',        label: 'Payé',     prob: 1.00, tone: 'success', color: 'var(--success)' },
];
const STAGE_BY_KEY = Object.fromEntries(STAGES.map(s => [s.key, s]));

const PILLAR_COLOR = {
  STUDIO: 'var(--pillar-studio)',
  PROD: 'var(--pillar-prod)',
  GRIOTHEQUE: 'var(--pillar-griotheque)',
};

const fmt = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);

export default function ProjectsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [pillarFilter, setPillarFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [disciplinesFilter, setDisciplinesFilter] = useState([]); // array of keys, [] = tous
  const [view, setView] = useViewMode('projects', 'list');

  // Pour la vue kanban
  const [draggingId, setDraggingId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  useEffect(() => {
    setLoadError(false);
    fetch('/api/data')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setProjects(d.projects || []); setLoading(false); })
      .catch((e) => { console.warn('[Projets] Chargement échoué :', e); setLoading(false); setLoadError(true); toast.error('Échec du chargement'); });
  }, [toast, reloadKey]);

  const filtered = useMemo(() => projects.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || (p.name || '').toLowerCase().includes(q)
      || (p.code || '').toLowerCase().includes(q)
      || (p.client || '').toLowerCase().includes(q)
      || (p.client_company || '').toLowerCase().includes(q);
    const matchPillar = pillarFilter === 'all' || p.pillar === pillarFilter;
    const matchStage = stageFilter === 'all' || p.stage === stageFilter;
    // Disciplines : si filtre vide → tous; sinon il faut au moins une discipline en commun (OR)
    const projectDisc = Array.isArray(p.disciplines) ? p.disciplines : [];
    const matchDisciplines = disciplinesFilter.length === 0
      || disciplinesFilter.some(d => projectDisc.includes(d));
    return matchSearch && matchPillar && matchStage && matchDisciplines;
  }), [projects, search, pillarFilter, stageFilter, disciplinesFilter]);

  const onClick = (id) => router.push(`/projects/${id}`);

  // Drag and drop pour kanban
  const onCardDragStart = useCallback((e, project) => {
    e.dataTransfer.setData('text/plain', project.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(project.id);
  }, []);
  const onCardDragEnd = useCallback(() => { setDraggingId(null); setDropTarget(null); }, []);
  const onDragOver = useCallback((e, stageKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTarget !== stageKey) setDropTarget(stageKey);
  }, [dropTarget]);
  const onDrop = useCallback(async (e, newStage) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    setDropTarget(null); setDraggingId(null);
    const project = projects.find(p => p.id === id);
    if (!project || project.stage === newStage) return;
    const previousStage = project.stage;
    setProjects(prev => prev.map(p => p.id === id ? { ...p, stage: newStage } : p));
    try {
      const r = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...project, stage: newStage }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success(`${project.code} → ${STAGE_BY_KEY[newStage]?.label || newStage}`);
    } catch (err) {
      setProjects(prev => prev.map(p => p.id === id ? { ...p, stage: previousStage } : p));
      toast.error(`Échec : ${err.message}`);
    }
  }, [projects, toast]);

  const pillarFilters = [
    { key: 'all',        label: 'Tous',       count: projects.length },
    { key: 'STUDIO',     label: 'Studio',     count: projects.filter(p => p.pillar === 'STUDIO').length },
    { key: 'PROD',       label: 'Production', count: projects.filter(p => p.pillar === 'PROD').length },
    { key: 'GRIOTHEQUE', label: 'Griothèque', count: projects.filter(p => p.pillar === 'GRIOTHEQUE').length },
  ];

  return (
    <>
      <TopBar
        title="Projets"
        subtitle={`${projects.length} projet${projects.length > 1 ? 's' : ''}`}
      />
      <div style={{
        padding: 'var(--sp-6)',
        display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
        flex: 1, minWidth: 0,
      }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un projet…"
            style={{
              flex: 1, maxWidth: 360, padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 13,
              outline: 'none', fontFamily: 'var(--font-sans)',
            }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {pillarFilters.map(f => {
              const active = pillarFilter === f.key;
              return (
                <button key={f.key} onClick={() => setPillarFilter(f.key)} style={{
                  padding: '5px 12px', borderRadius: 999,
                  fontSize: 11, fontWeight: 500, cursor: 'pointer',
                  border: '1px solid ' + (active ? 'var(--gold)' : 'var(--border)'),
                  background: active ? 'var(--gold-soft)' : 'transparent',
                  color: active ? 'var(--gold-deep)' : 'var(--text-3)',
                  fontFamily: 'var(--font-sans)',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  {f.label}
                  <span style={{
                    fontSize: 9, padding: '0 5px', borderRadius: 999,
                    background: active ? 'var(--gold)' : 'var(--surface-2)',
                    color: active ? 'var(--surface)' : 'var(--text-3)',
                    fontFamily: 'var(--font-mono)',
                    minWidth: 16, textAlign: 'center',
                  }}>{f.count}</span>
                </button>
              );
            })}
          </div>
          <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} style={{
            padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12,
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--text)', cursor: 'pointer', outline: 'none',
            fontFamily: 'var(--font-sans)',
          }}>
            <option value="all">Tous les stages</option>
            {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>

          {/* Filtre disciplines créatives : Image / Stories / Movement */}
          <div style={{
            display: 'flex', gap: 4, alignItems: 'center',
            padding: '2px 4px',
            borderLeft: '1px solid var(--border)',
            paddingLeft: 12, marginLeft: 4,
          }}>
            {DISCIPLINES.map(d => {
              const active = disciplinesFilter.includes(d.key);
              const count = projects.filter(p => Array.isArray(p.disciplines) && p.disciplines.includes(d.key)).length;
              return (
                <button
                  key={d.key}
                  onClick={() => setDisciplinesFilter(prev =>
                    prev.includes(d.key)
                      ? prev.filter(k => k !== d.key)
                      : [...prev, d.key]
                  )}
                  title={`${d.description} · ${count} projet${count > 1 ? 's' : ''}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                    fontSize: 11, fontWeight: active ? 600 : 400,
                    fontFamily: 'var(--font-sans)',
                    background: active ? d.color : 'var(--surface)',
                    color: active ? 'var(--on-solid)' : 'var(--text-3)',
                    border: '1px solid ' + (active ? d.color : 'var(--border)'),
                    cursor: 'pointer',
                    transition: 'all var(--duration) var(--ease)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ fontSize: 12 }}>{d.icon}</span>
                  <span>{d.label}</span>
                  <span style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 6,
                    background: active ? 'color-mix(in srgb, var(--on-solid) 25%, transparent)' : 'var(--surface-2)',
                    color: active ? 'var(--on-solid)' : 'var(--text-3)',
                    fontFamily: 'var(--font-mono)',
                    minWidth: 14, textAlign: 'center',
                  }}>{count}</span>
                </button>
              );
            })}
            {disciplinesFilter.length > 0 && (
              <button
                onClick={() => setDisciplinesFilter([])}
                title="Effacer le filtre disciplines"
                style={{
                  fontSize: 11, padding: '6px 8px',
                  background: 'transparent', border: 'none',
                  color: 'var(--text-3)', cursor: 'pointer',
                  marginLeft: 2,
                }}
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ flex: 1 }} />
          <ViewSwitcher value={view} onChange={setView} options={['list', 'cards', 'kanban']} />
        </div>

        {/* Erreur de chargement */}
        {loadError && !loading && (
          <Card variant="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--danger)', fontSize: 13 }}>Impossible de charger les projets.</span>
              <Button variant="danger" size="sm" onClick={() => { setLoading(true); setReloadKey(k => k + 1); }}>Réessayer</Button>
            </div>
          </Card>
        )}

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={56} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="◌"
            title={search || pillarFilter !== 'all' || stageFilter !== 'all' || disciplinesFilter.length > 0 ? 'Aucun résultat' : 'Aucun projet'}
            message="Affine la recherche ou crée un nouveau projet."
          />
        ) : view === 'cards' ? (
          <CardsView projects={filtered} onClick={onClick} />
        ) : view === 'kanban' ? (
          <KanbanView
            projects={filtered}
            onClick={onClick}
            draggingId={draggingId}
            dropTarget={dropTarget}
            onCardDragStart={onCardDragStart}
            onCardDragEnd={onCardDragEnd}
            onDragOver={onDragOver}
            onDrop={onDrop}
          />
        ) : (
          <ListView projects={filtered} onClick={onClick} />
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// View — Liste (table)
// ─────────────────────────────────────────────────────────
function ListView({ projects, onClick }) {
  return (
    <Card padding="none">
      <div className="resp-table-head" style={{
        display: 'grid',
        gridTemplateColumns: '90px 2.2fr 90px 100px 1.4fr 120px',
        padding: '10px 18px',
        borderBottom: '1px solid var(--border)',
        fontSize: 10, fontWeight: 600, color: 'var(--text-3)',
        letterSpacing: 0.5, textTransform: 'uppercase',
        fontFamily: 'var(--font-mono)',
      }}>
        <span>Code</span>
        <span>Nom</span>
        <span>Pilier</span>
        <span>Stage</span>
        <span>Client</span>
        <span style={{ textAlign: 'right' }}>CA</span>
      </div>
      {projects.map((p, i) => (
        <div
          key={p.id}
          className="resp-table-row"
          onClick={() => onClick(p.id)}
          tabIndex={0}
          role="button"
          onKeyDown={(e) => { if (e.key === 'Enter') onClick(p.id); }}
          style={{
            display: 'grid',
            gridTemplateColumns: '90px 2.2fr 90px 100px 1.4fr 120px',
            padding: '12px 18px',
            borderBottom: i < projects.length - 1 ? '1px solid var(--border)' : 'none',
            alignItems: 'center', fontSize: 13, cursor: 'pointer',
            transition: 'background var(--duration) var(--ease)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{p.code}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span style={{ fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.name}
            </span>
            {Array.isArray(p.disciplines) && p.disciplines.length > 0 && (
              <DisciplinesBadges disciplines={p.disciplines} size="sm" />
            )}
          </div>
          <Badge tone="pillar" pillar={p.pillar} size="sm">{p.pillar}</Badge>
          <Badge tone={STAGE_BY_KEY[p.stage]?.tone || 'neutral'} size="sm">
            {STAGE_BY_KEY[p.stage]?.label || p.stage}
          </Badge>
          <span style={{ color: 'var(--text-2)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.client_company || `${p.clientFirstName || ''} ${p.clientLastName || ''}`.trim() || p.client || '—'}
          </span>
          <span style={{
            textAlign: 'right', fontFamily: 'var(--font-mono)',
            fontWeight: 600, color: p.revenue ? 'var(--text)' : 'var(--text-3)',
          }}>
            {p.revenue ? fmt(p.revenue) : '—'}
          </span>
        </div>
      ))}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// View — Cards
// ─────────────────────────────────────────────────────────
function CardsView({ projects, onClick }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: 12,
    }} className="lg-stagger">
      {projects.map(p => {
        const pillarColor = PILLAR_COLOR[p.pillar] || 'var(--text-3)';
        const stage = STAGE_BY_KEY[p.stage] || STAGES[0];
        const weighted = (p.revenue || 0) * stage.prob;
        return (
          <Card key={p.id} interactive onClick={() => onClick(p.id)} style={{
            cursor: 'pointer',
            borderLeft: `3px solid ${pillarColor}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                {p.code}
              </span>
              <Badge tone="pillar" pillar={p.pillar} size="sm">{p.pillar}</Badge>
            </div>
            <div style={{
              fontSize: 14, fontWeight: 500, color: 'var(--text)',
              marginBottom: 8, lineHeight: 1.35,
            }}>
              {p.name}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <Badge tone={stage.tone} size="sm">{stage.label}</Badge>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                {fmt(p.revenue)}
              </span>
            </div>
            <div style={{
              paddingTop: 8, borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', fontSize: 11,
            }}>
              <span style={{ color: 'var(--text-3)' }}>
                {p.client_company || `${p.clientFirstName || ''} ${p.clientLastName || ''}`.trim() || '—'}
              </span>
              {stage.prob > 0 && stage.prob < 1 && (
                <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-mono)' }}>
                  ↳ {fmt(weighted)}
                </span>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// View — Kanban (avec drag-and-drop)
// ─────────────────────────────────────────────────────────
function KanbanView({ projects, onClick, draggingId, dropTarget, onCardDragStart, onCardDragEnd, onDragOver, onDrop }) {
  return (
    <div className="resp-kanban" style={{
      display: 'flex', gap: 8, flex: 1,
      overflowX: 'auto', paddingBottom: 12,
    }}>
      {STAGES.map(stage => {
        const stageProjects = projects.filter(p => p.stage === stage.key);
        const total = stageProjects.reduce((s, p) => s + (p.revenue || 0), 0);
        const isDropTarget = dropTarget === stage.key;
        return (
          <div
            key={stage.key}
            onDragOver={(e) => onDragOver(e, stage.key)}
            onDrop={(e) => onDrop(e, stage.key)}
            style={{
              minWidth: 240, width: 240,
              display: 'flex', flexDirection: 'column', gap: 8,
              padding: 6, borderRadius: 'var(--radius-md)',
              background: isDropTarget ? 'var(--surface-2)' : 'transparent',
              border: '1px dashed ' + (isDropTarget ? stage.color : 'transparent'),
              transition: 'all var(--duration) var(--ease)',
            }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 6px', borderBottom: `2px solid ${stage.color}`, marginBottom: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{stage.label}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 999,
                  background: 'var(--surface-2)', color: 'var(--text-2)',
                  fontFamily: 'var(--font-mono)',
                }}>{stageProjects.length}</span>
              </div>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
                {fmt(total)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 60 }}>
              {stageProjects.length === 0 ? (
                <div style={{
                  padding: '20px 12px', textAlign: 'center',
                  fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic',
                  border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)',
                }}>Vide</div>
              ) : stageProjects.map(p => {
                const isDragging = draggingId === p.id;
                const pillarColor = PILLAR_COLOR[p.pillar] || 'var(--text-3)';
                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => onCardDragStart(e, p)}
                    onDragEnd={onCardDragEnd}
                    onClick={() => onClick(p.id)}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderLeft: `3px solid ${pillarColor}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 12px',
                      cursor: 'grab',
                      opacity: isDragging ? 0.4 : 1,
                      transition: 'all var(--duration) var(--ease)',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{p.code}</span>
                      <Badge tone="pillar" pillar={p.pillar} size="sm">{p.pillar}</Badge>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6, lineHeight: 1.35 }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
                      {fmt(p.revenue)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
