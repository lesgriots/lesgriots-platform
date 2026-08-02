'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import {
  Card, Badge, Button, Skeleton, EmptyState, KpiCard,
  SectionTitle, useToast,
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

const todayISO = () => new Date().toISOString().slice(0, 10);

function relTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}j`;
  return `${Math.floor(diff / 2592000)}mo`;
}

function daysUntil(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

// ─────────────────────────────────────────────────────────
// Card kanban — drag-and-drop + meta enrichies
// ─────────────────────────────────────────────────────────
function KanbanCard({ project, isDragging, onDragStart, onDragEnd, onClick }) {
  const [hover, setHover] = useState(false);
  const pillarColor = PILLAR_COLOR[project.pillar] || 'var(--text-3)';

  // Computed signals
  const openTasks = (project.tasks || []).filter(t => t.status !== 'done').length;
  const journal = Array.isArray(project.projectJournal) ? project.projectJournal : [];
  const lastActivity = journal.length ? (journal[0].createdAt || journal[0].date) : project.createdAt;
  const lastActivityRel = relTime(lastActivity);
  const dDays = daysUntil(project.endDate);
  const isUrgent = dDays !== null && dDays <= 7 && !['paid', 'lost'].includes(project.stage);
  const isOverdue = dDays !== null && dDays < 0 && !['paid', 'lost'].includes(project.stage);
  const stage = STAGE_BY_KEY[project.stage] || STAGES[0];
  const weighted = (project.revenue || 0) * stage.prob;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, project)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(project)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(project); }}
      style={{
        background: hover ? 'var(--surface-2)' : 'var(--surface)',
        border: '1px solid ' + (isOverdue ? 'var(--danger)' : (hover ? 'var(--border-2)' : 'var(--border)')),
        borderLeft: `3px solid ${pillarColor}`,
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
        cursor: 'grab',
        transition: 'all var(--duration) var(--ease)',
        opacity: isDragging ? 0.4 : 1,
        transform: hover && !isDragging ? 'translateY(-1px)' : 'none',
        boxShadow: hover ? 'var(--shadow-sm)' : 'none',
        userSelect: 'none',
      }}
    >
      {/* Top row : code + pillar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 6,
      }}>
        <span style={{
          fontSize: 10, fontFamily: 'var(--font-mono)',
          color: 'var(--text-3)', letterSpacing: 0.4,
        }}>
          {project.code}
        </span>
        <Badge tone="pillar" pillar={project.pillar} size="sm">
          {project.pillar}
        </Badge>
      </div>

      {/* Name */}
      <div style={{
        fontSize: 13, fontWeight: 500, color: 'var(--text)',
        marginBottom: 8, lineHeight: 1.35,
      }}>
        {project.name}
      </div>

      {/* Revenue + client */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'baseline', gap: 8, marginBottom: 8,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{
            fontSize: 13, fontWeight: 600,
            fontFamily: 'var(--font-mono)', color: 'var(--text)',
          }}>
            {fmt(project.revenue)}
          </span>
          {stage.prob > 0 && stage.prob < 1 && (
            <span style={{
              fontSize: 10, color: 'var(--text-3)',
              fontFamily: 'var(--font-mono)',
              marginTop: 1,
            }}>
              ↳ {fmt(weighted)} ({Math.round(stage.prob * 100)}%)
            </span>
          )}
        </div>
        {(project.client_company || project.clientFirstName || project.client) && (
          <span style={{
            fontSize: 11, color: 'var(--text-3)',
            maxWidth: 110, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            textAlign: 'right',
          }}>
            {project.client_company
              || `${project.clientFirstName || ''} ${project.clientLastName || ''}`.trim()
              || project.client}
          </span>
        )}
      </div>

      {/* Footer meta */}
      <div style={{
        display: 'flex', gap: 6, alignItems: 'center',
        flexWrap: 'wrap', paddingTop: 6,
        borderTop: '1px solid var(--border)',
        fontSize: 10, fontFamily: 'var(--font-mono)',
      }}>
        {openTasks > 0 && (
          <span style={metaPill}>
            <span style={{ fontFamily: 'var(--font-sans)' }}>✓</span>
            {openTasks} task{openTasks > 1 ? 's' : ''}
          </span>
        )}
        {lastActivityRel && (
          <span style={metaPill} title="Dernière activité">
            <span style={{ fontFamily: 'var(--font-sans)' }}>↻</span>
            {lastActivityRel}
          </span>
        )}
        {isOverdue && (
          <span style={{ ...metaPill, background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            ⚠ retard {Math.abs(dDays)}j
          </span>
        )}
        {!isOverdue && isUrgent && (
          <span style={{ ...metaPill, background: 'var(--warning-soft)', color: 'var(--warning)' }}>
            ⏱ J-{dDays}
          </span>
        )}
      </div>
    </div>
  );
}

const metaPill = {
  display: 'inline-flex', alignItems: 'center', gap: 3,
  padding: '2px 6px', borderRadius: 999,
  background: 'var(--surface-2)', color: 'var(--text-3)',
};

// ─────────────────────────────────────────────────────────
// Column kanban — drop zone
// ─────────────────────────────────────────────────────────
function StageColumn({ stage, projects, isDropTarget, onDragOver, onDragLeave, onDrop, onCardClick, onCardDragStart, onCardDragEnd, draggingId }) {
  const total = projects.reduce((s, p) => s + (p.revenue || 0), 0);
  return (
    <div
      onDragOver={(e) => onDragOver(e, stage.key)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, stage.key)}
      style={{
        minWidth: 240, width: 240,
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: 6,
        borderRadius: 'var(--radius-md)',
        background: isDropTarget ? 'var(--surface-2)' : 'transparent',
        border: '1px dashed ' + (isDropTarget ? stage.color : 'transparent'),
        transition: 'all var(--duration) var(--ease)',
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', padding: '8px 6px',
        borderBottom: `2px solid ${stage.color}`,
        marginBottom: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text)',
          }}>
            {stage.label}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 600,
            padding: '1px 7px', borderRadius: 999,
            background: 'var(--surface-2)', color: 'var(--text-2)',
            fontFamily: 'var(--font-mono)',
          }}>
            {projects.length}
          </span>
        </div>
        <span style={{
          fontSize: 11, fontFamily: 'var(--font-mono)',
          color: 'var(--text-3)',
        }}>
          {fmt(total)}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 60 }}>
        {projects.length === 0 ? (
          <div style={{
            padding: '20px 12px', textAlign: 'center',
            fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-sm)',
          }}>
            Vide
          </div>
        ) : (
          projects.map(p => (
            <KanbanCard
              key={p.id}
              project={p}
              isDragging={draggingId === p.id}
              onDragStart={onCardDragStart}
              onDragEnd={onCardDragEnd}
              onClick={onCardClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Page Pipeline
// ─────────────────────────────────────────────────────────
export default function PipelinePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState('all');
  const [draggingId, setDraggingId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  useEffect(() => {
    setLoadError(false);
    fetch('/api/data')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setProjects(d.projects || []); setLoading(false); })
      .catch((e) => { console.warn('[Pipeline] Chargement échoué :', e); setLoading(false); setLoadError(true); toast.error('Échec du chargement'); });
  }, [toast, reloadKey]);

  const onCardDragStart = useCallback((e, project) => {
    e.dataTransfer.setData('text/plain', project.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(project.id);
  }, []);

  const onCardDragEnd = useCallback(() => {
    setDraggingId(null);
    setDropTarget(null);
  }, []);

  const onDragOver = useCallback((e, stageKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTarget !== stageKey) setDropTarget(stageKey);
  }, [dropTarget]);

  const onDragLeave = useCallback(() => {}, []);

  const onDrop = useCallback(async (e, newStage) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    setDropTarget(null);
    setDraggingId(null);
    const project = projects.find(p => p.id === id);
    if (!project) return;
    if (project.stage === newStage) return;

    const previousStage = project.stage;
    setProjects(prev => prev.map(p => p.id === id ? { ...p, stage: newStage } : p));

    try {
      const r = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...project, stage: newStage }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const stageLabel = STAGE_BY_KEY[newStage]?.label || newStage;
      toast.success(`${project.code} → ${stageLabel}`);
    } catch (err) {
      setProjects(prev => prev.map(p => p.id === id ? { ...p, stage: previousStage } : p));
      toast.error(`Échec : ${err.message}`);
    }
  }, [projects, toast]);

  const onCardClick = useCallback((project) => {
    router.push(`/projects/${project.id}`);
  }, [router]);

  const filtered = useMemo(() => (
    filter === 'all' ? projects : projects.filter(p => p.pillar === filter)
  ), [filter, projects]);

  // ── Stats agrégées ────────────────────────────────────
  const stats = useMemo(() => {
    const active = filtered.filter(p => !['paid', 'lost'].includes(p.stage));
    const totalRaw = active.reduce((s, p) => s + (p.revenue || 0), 0);
    const totalWeighted = active.reduce((s, p) => {
      const stage = STAGE_BY_KEY[p.stage] || STAGES[0];
      return s + (p.revenue || 0) * stage.prob;
    }, 0);
    const inDecision = filtered.filter(p => ['quoted', 'negotiation'].includes(p.stage));
    const cashInDecision = inDecision.reduce((s, p) => s + (p.revenue || 0), 0);
    const signedNotPaid = filtered.filter(p => ['signed', 'active', 'delivered'].includes(p.stage));
    const cashSignedNotPaid = signedNotPaid.reduce((s, p) => s + (p.revenue || 0), 0);

    // Délai moyen depuis création (sur projets actifs)
    const now = Date.now();
    const ages = active
      .map(p => p.createdAt ? Math.floor((now - new Date(p.createdAt).getTime()) / 86400000) : null)
      .filter(n => n !== null);
    const avgAge = ages.length ? Math.round(ages.reduce((s, n) => s + n, 0) / ages.length) : 0;

    // Conversion qualif → signé sur le pipeline visible (pas un taux temporel, juste structurel)
    const qualifiedCount = filtered.filter(p => ['qualify', 'quoted', 'negotiation', 'signed', 'active', 'delivered', 'paid'].includes(p.stage)).length;
    const wonCount = filtered.filter(p => ['signed', 'active', 'delivered', 'paid'].includes(p.stage)).length;
    const conversionRate = qualifiedCount ? Math.round((wonCount / qualifiedCount) * 100) : 0;

    return {
      activeCount: active.length,
      totalRaw, totalWeighted,
      cashInDecision, inDecisionCount: inDecision.length,
      cashSignedNotPaid, signedNotPaidCount: signedNotPaid.length,
      avgAge,
      conversionRate,
    };
  }, [filtered]);

  const filterButtons = [
    { key: 'all',        label: 'Tous',       count: projects.length },
    { key: 'STUDIO',     label: 'Studio',     count: projects.filter(p => p.pillar === 'STUDIO').length },
    { key: 'PROD',       label: 'Production', count: projects.filter(p => p.pillar === 'PROD').length },
    { key: 'GRIOTHEQUE', label: 'Griothèque', count: projects.filter(p => p.pillar === 'GRIOTHEQUE').length },
  ];

  return (
    <>
      <TopBar
        title="Pipeline"
        subtitle={`${stats.activeCount} projet${stats.activeCount > 1 ? 's' : ''} actif${stats.activeCount > 1 ? 's' : ''} · drag pour changer de stage`}
      />
      <div style={{
        padding: 'var(--sp-6)',
        display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
        flex: 1, minWidth: 0,
      }}>

        {/* Stats agrégées */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 8,
        }}>
          <KpiCard
            label="Pipeline brut"
            value={loading ? '—' : fmt(stats.totalRaw)}
            tone="neutral"
            hint={`${stats.activeCount} actif${stats.activeCount > 1 ? 's' : ''}`}
          />
          <KpiCard
            label="Pondéré"
            value={loading ? '—' : fmt(stats.totalWeighted)}
            tone="gold"
            hint={stats.totalRaw ? `${Math.round((stats.totalWeighted / stats.totalRaw) * 100)}% du brut` : '—'}
          />
          <KpiCard
            label="En décision"
            value={loading ? '—' : fmt(stats.cashInDecision)}
            tone="warning"
            hint={`${stats.inDecisionCount} devis + négo`}
          />
          <KpiCard
            label="Signé non payé"
            value={loading ? '—' : fmt(stats.cashSignedNotPaid)}
            tone="success"
            hint={`${stats.signedNotPaidCount} en cours`}
          />
          <KpiCard
            label="Délai moyen"
            value={loading ? '—' : `${stats.avgAge}j`}
            tone="neutral"
            hint={`Conversion qualif→signé ${stats.conversionRate}%`}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {filterButtons.map(f => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: '6px 14px', borderRadius: 999,
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  border: '1px solid ' + (active ? 'var(--gold)' : 'var(--border)'),
                  background: active ? 'var(--gold-soft)' : 'transparent',
                  color: active ? 'var(--gold-deep)' : 'var(--text-2)',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all var(--duration) var(--ease)',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                {f.label}
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 999,
                  background: active ? 'var(--gold)' : 'var(--surface-2)',
                  color: active ? 'var(--surface)' : 'var(--text-3)',
                  fontFamily: 'var(--font-mono)',
                  minWidth: 18, textAlign: 'center',
                }}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Erreur de chargement */}
        {loadError && !loading && (
          <Card variant="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--danger)', fontSize: 13 }}>Impossible de charger le pipeline.</span>
              <Button variant="danger" size="sm" onClick={() => { setLoading(true); setReloadKey(k => k + 1); }}>Réessayer</Button>
            </div>
          </Card>
        )}

        {/* Kanban */}
        {loading ? (
          <div style={{ display: 'flex', gap: 8 }}>
            {STAGES.slice(0, 6).map((_, i) => (
              <div key={i} style={{ minWidth: 240, width: 240 }}>
                <Skeleton width="60%" height={14} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                  <Skeleton height={88} />
                  <Skeleton height={88} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="resp-kanban" style={{
            display: 'flex', gap: 8, flex: 1,
            overflowX: 'auto', paddingBottom: 12,
          }}>
            {STAGES.map(stage => {
              const stageProjects = filtered.filter(p => p.stage === stage.key);
              return (
                <StageColumn
                  key={stage.key}
                  stage={stage}
                  projects={stageProjects}
                  isDropTarget={dropTarget === stage.key}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onCardClick={onCardClick}
                  onCardDragStart={onCardDragStart}
                  onCardDragEnd={onCardDragEnd}
                  draggingId={draggingId}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
