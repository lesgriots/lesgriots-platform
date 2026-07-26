'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import {
  Card, Badge, Button, Skeleton, EmptyState,
  ViewSwitcher, useViewMode,
} from '@/components/ui';

const fmt = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);

export default function TeamPage() {
  const router = useRouter();
  const [team, setTeam] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useViewMode('team', 'cards');

  useEffect(() => {
    setLoadError(false);
    fetch('/api/data')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => {
        setTeam(d.team || []);
        setProjects(d.projects || []);
        // Flatten tasks from all projects
        const allTasks = [];
        for (const p of (d.projects || [])) {
          for (const t of (p.tasks || [])) {
            allTasks.push({ ...t, projectId: p.id, projectCode: p.code, projectName: p.name });
          }
        }
        setTasks(allTasks);
        setLoading(false);
      })
      .catch((e) => { console.warn('[Équipe] Chargement échoué :', e); setLoadError(true); setLoading(false); });
  }, [reloadKey]);

  // Enrich each team member with stats
  const enriched = useMemo(() => team.map(m => {
    const memberTasks = tasks.filter(t => t.assigneeId === m.id || t.assigneeName === m.name);
    const open = memberTasks.filter(t => t.status !== 'done');
    const inProgress = memberTasks.filter(t => t.status === 'in_progress');
    const late = memberTasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10));
    const projectIds = new Set(memberTasks.map(t => t.projectId));
    const projectsAssigned = (projects || []).filter(p => projectIds.has(p.id));
    const estimatedHours = memberTasks.reduce((s, t) => s + (Number(t.estimatedHours) || 0), 0);
    return {
      ...m,
      taskCount: memberTasks.length,
      openCount: open.length,
      inProgressCount: inProgress.length,
      lateCount: late.length,
      projectCount: projectsAssigned.length,
      projects: projectsAssigned,
      estimatedHours,
    };
  }), [team, tasks, projects]);

  const totalTasks = tasks.length;
  const totalOpen = tasks.filter(t => t.status !== 'done').length;
  const totalLate = tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10)).length;
  const onClick = (id) => router.push(`/team/${id}`);

  return (
    <>
      <TopBar
        title="Équipe"
        subtitle={`${team.length} membre${team.length > 1 ? 's' : ''} · ${totalOpen} tâche${totalOpen > 1 ? 's' : ''} ouverte${totalOpen > 1 ? 's' : ''}`}
      />
      <div style={{
        padding: 'var(--sp-6)',
        display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
      }}>

        {/* Stats globales équipe */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 8,
        }}>
          <Stat label="Membres" value={team.length} hint={team.length === 0 ? 'Ajouter dans Réglages' : 'Personnes internes'} />
          <Stat label="Tâches assignées" value={totalTasks} hint={`${totalOpen} ouvertes`} />
          <Stat label="En retard" value={totalLate} tone={totalLate > 0 ? 'danger' : 'neutral'} hint={totalLate > 0 ? 'Action requise' : 'À jour'} />
          <Stat label="Heures estimées" value={tasks.reduce((s, t) => s + (Number(t.estimatedHours) || 0), 0) + 'h'} hint="Total assigné équipe" />
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }} />
          <ViewSwitcher value={view} onChange={setView} options={['cards', 'list']} />
        </div>

        {/* Erreur de chargement */}
        {loadError && !loading && (
          <Card variant="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--danger)', fontSize: 13 }}>Impossible de charger l'équipe.</span>
              <Button variant="danger" size="sm" onClick={() => { setLoading(true); setReloadKey(k => k + 1); }}>Réessayer</Button>
            </div>
          </Card>
        )}

        {/* Content */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={140} />)}
          </div>
        ) : enriched.length === 0 ? (
          <EmptyState
            icon="◌"
            title="Aucun membre d'équipe"
            message="Tu peux ajouter des membres internes dans Réglages > Équipe."
          />
        ) : view === 'cards' ? (
          <CardsView members={enriched} onClick={onClick} />
        ) : (
          <ListView members={enriched} onClick={onClick} />
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Views
// ─────────────────────────────────────────────────────────
function CardsView({ members, onClick }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: 12,
    }} className="lg-stagger">
      {members.map(m => {
        const initials = (m.name || '?')
          .split(' ').filter(Boolean).slice(0, 2)
          .map(w => w[0]?.toUpperCase()).join('');
        const charge = m.openCount;
        const overload = charge > 8;
        return (
          <Card key={m.id} interactive onClick={() => onClick(m.id)} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'var(--gold-soft)', color: 'var(--gold)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 600,
                fontFamily: 'var(--font-title)', flexShrink: 0,
              }}>
                {initials || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 500, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {m.name || '—'}
                </div>
                {m.role && (
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    {m.role}
                  </div>
                )}
                <div style={{ marginTop: 4 }}>
                  <Badge tone={m.type === 'internal' ? 'gold' : 'neutral'} size="sm">
                    {m.type === 'internal' ? 'Interne' : 'Externe'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8, padding: '8px 0',
              borderTop: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
            }}>
              <MiniStat label="Projets" value={m.projectCount} />
              <MiniStat label="Ouvertes" value={charge} tone={overload ? 'danger' : charge > 0 ? 'info' : 'neutral'} />
              <MiniStat label="En retard" value={m.lateCount} tone={m.lateCount > 0 ? 'danger' : 'neutral'} />
            </div>

            {/* Charge indicator */}
            <div style={{ marginTop: 10 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 10, marginBottom: 4,
                fontFamily: 'var(--font-mono)', color: 'var(--text-3)',
              }}>
                <span>Charge</span>
                <span style={{ color: overload ? 'var(--danger)' : charge > 4 ? 'var(--warning)' : 'var(--text-2)' }}>
                  {charge === 0 ? 'libre' : overload ? 'surchargé' : charge > 4 ? 'chargé' : 'normal'}
                </span>
              </div>
              <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(charge * 12, 100)}%`,
                  background: overload ? 'var(--danger)' : charge > 4 ? 'var(--warning)' : 'var(--success)',
                  transition: 'width var(--duration-slow) var(--ease-out)',
                }} />
              </div>
            </div>

            {(m.email || m.phone) && (
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-3)' }}>
                {m.email && <div>✉ {m.email}</div>}
                {m.phone && <div>☎ {m.phone}</div>}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function ListView({ members, onClick }) {
  return (
    <Card padding="none">
      <div className="resp-table-head" style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1.4fr 90px 90px 90px',
        padding: '10px 18px',
        borderBottom: '1px solid var(--border)',
        fontSize: 10, fontWeight: 600, color: 'var(--text-3)',
        letterSpacing: 0.5, textTransform: 'uppercase',
        fontFamily: 'var(--font-mono)',
      }}>
        <span>Membre</span>
        <span>Rôle</span>
        <span style={{ textAlign: 'right' }}>Projets</span>
        <span style={{ textAlign: 'right' }}>Ouvertes</span>
        <span style={{ textAlign: 'right' }}>Retard</span>
      </div>
      {members.map((m, i) => (
        <div
          key={m.id}
          className="resp-table-row"
          onClick={() => onClick(m.id)}
          tabIndex={0}
          role="button"
          onKeyDown={(e) => { if (e.key === 'Enter') onClick(m.id); }}
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.4fr 90px 90px 90px',
            padding: '12px 18px',
            borderBottom: i < members.length - 1 ? '1px solid var(--border)' : 'none',
            alignItems: 'center', fontSize: 13, cursor: 'pointer',
            transition: 'background var(--duration) var(--ease)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontWeight: 500, color: 'var(--text)' }}>{m.name || '—'}</span>
          <span style={{ color: 'var(--text-2)', fontSize: 12 }}>{m.role || '—'}</span>
          <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{m.projectCount}</span>
          <span style={{
            textAlign: 'right', fontFamily: 'var(--font-mono)',
            color: m.openCount > 8 ? 'var(--danger)' : m.openCount > 4 ? 'var(--warning)' : 'var(--text)',
          }}>
            {m.openCount}
          </span>
          <span style={{
            textAlign: 'right', fontFamily: 'var(--font-mono)',
            color: m.lateCount > 0 ? 'var(--danger)' : 'var(--text-3)',
          }}>
            {m.lateCount || '—'}
          </span>
        </div>
      ))}
    </Card>
  );
}

function Stat({ label, value, hint, tone = 'neutral' }) {
  const color = {
    danger: 'var(--danger)', warning: 'var(--warning)',
    success: 'var(--success)', info: 'var(--info)',
    neutral: 'var(--text)',
  }[tone] || 'var(--text)';

  return (
    <Card>
      <div style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6,
        color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
        marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 600, color,
        fontFamily: 'var(--font-title)', lineHeight: 1, letterSpacing: -0.5,
      }}>{value}</div>
      {hint && (
        <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 6 }}>
          {hint}
        </div>
      )}
    </Card>
  );
}

function MiniStat({ label, value, tone = 'neutral' }) {
  const color = {
    danger: 'var(--danger)', warning: 'var(--warning)',
    success: 'var(--success)', info: 'var(--info)',
    neutral: 'var(--text)',
  }[tone] || 'var(--text)';
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: 16, fontWeight: 600, color,
        fontFamily: 'var(--font-mono)', lineHeight: 1,
      }}>{value}</div>
      <div style={{
        fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6,
        color: 'var(--text-3)', marginTop: 3,
        fontFamily: 'var(--font-mono)',
      }}>{label}</div>
    </div>
  );
}
