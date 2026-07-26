'use client';
import { useEffect, useState, use, useMemo } from 'react';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import {
  Card, Badge, Button, Skeleton, EmptyState,
  SectionTitle, SubLabel, useToast,
} from '@/components/ui';

const STAGE_LABEL = {
  lead: 'Lead', need: 'Besoin', qualify: 'Qualif', quoted: 'Devis',
  negotiation: 'Négo', signed: 'Signé', active: 'Actif',
  delivered: 'Livré', paid: 'Payé', lost: 'Perdu',
};
const STAGE_TONE = {
  lead: 'neutral', need: 'neutral', qualify: 'info',
  quoted: 'gold', negotiation: 'warning',
  signed: 'success', active: 'success',
  delivered: 'pillar', paid: 'success', lost: 'danger',
};
const STATUS_LABEL = {
  todo: 'À faire', in_progress: 'En cours', review: 'Review', done: 'Terminé',
};
const STATUS_TONE = {
  todo: 'neutral', in_progress: 'info', review: 'warning', done: 'success',
};
const PILLAR_COLOR = {
  STUDIO: 'var(--pillar-studio)',
  PROD: 'var(--pillar-prod)',
  GRIOTHEQUE: 'var(--pillar-griotheque)',
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

export default function TeamMemberDetailPage({ params }) {
  const { id } = use(params);
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then(d => {
        const member = (d.team || []).find(m => m.id === id);
        if (!member) { setError('NOT_FOUND'); return; }
        // Flatten tasks
        const tasks = [];
        for (const p of (d.projects || [])) {
          for (const t of (p.tasks || [])) {
            if (t.assigneeId === id || t.assigneeName === member.name) {
              tasks.push({
                ...t,
                projectId: p.id,
                projectCode: p.code,
                projectName: p.name,
                projectPillar: p.pillar,
                projectStage: p.stage,
              });
            }
          }
        }
        setData({ member, tasks, projects: d.projects || [] });
      })
      .catch(e => setError(e.message));
  }, [id]);

  if (error === 'NOT_FOUND') {
    return (
      <>
        <TopBar title="Membre introuvable" />
        <div style={pageStyle}>
          <EmptyState
            icon="✕"
            title="Ce membre n'existe pas"
            action={<Button variant="primary" href="/team">← Retour à l'équipe</Button>}
          />
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <TopBar title="Chargement…" />
        <div style={pageStyle}>
          <Card><Skeleton width="40%" height={20} /></Card>
        </div>
      </>
    );
  }

  const { member, tasks } = data;

  // Stats
  const open = tasks.filter(t => t.status !== 'done');
  const inProgress = tasks.filter(t => t.status === 'in_progress');
  const done = tasks.filter(t => t.status === 'done');
  const late = tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10));
  const projectIds = [...new Set(tasks.map(t => t.projectId))];
  const projectsAssigned = projectIds.map(pid => data.projects.find(p => p.id === pid)).filter(Boolean);
  const totalEstimatedHours = tasks.reduce((s, t) => s + (Number(t.estimatedHours) || 0), 0);

  // Group tasks by project
  const tasksByProject = {};
  for (const t of tasks) {
    if (!tasksByProject[t.projectId]) tasksByProject[t.projectId] = [];
    tasksByProject[t.projectId].push(t);
  }

  const initials = (member.name || '?')
    .split(' ').filter(Boolean).slice(0, 2)
    .map(w => w[0]?.toUpperCase()).join('');

  const overload = open.length > 8;

  return (
    <>
      <TopBar title={member.name} subtitle={member.role || (member.type === 'internal' ? 'Membre interne' : 'Externe')} />
      <div style={pageStyle} className="lg-anim-fade">

        {/* Breadcrumb */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }}>
          <Link href="/team" style={breadcrumbLink}>← Équipe</Link>
          <span style={{ color: 'var(--text-3)' }}>/</span>
          <span style={{ color: 'var(--text-2)' }}>{member.name}</span>
        </div>

        {/* Header */}
        <Card>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--gold-soft)', color: 'var(--gold)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 600,
              fontFamily: 'var(--font-title)', flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{
                margin: 0, fontSize: 22, fontWeight: 500, color: 'var(--text)',
                fontFamily: 'var(--font-title)', letterSpacing: -0.01,
              }}>
                {member.name}
              </h2>
              {member.role && (
                <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-2)' }}>
                  {member.role}
                </div>
              )}
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge tone={member.type === 'internal' ? 'gold' : 'neutral'} size="md">
                  {member.type === 'internal' ? 'Membre interne' : 'Externe'}
                </Badge>
                {member.email && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>✉ {member.email}</span>}
                {member.phone && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>☎ {member.phone}</span>}
              </div>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 8,
        }}>
          <StatCard label="Projets" value={projectsAssigned.length} hint="Actifs et historiques" />
          <StatCard label="Tâches ouvertes" value={open.length} tone={overload ? 'danger' : open.length > 4 ? 'warning' : 'neutral'} hint={overload ? 'Surchargé' : open.length > 4 ? 'Chargé' : open.length === 0 ? 'Libre' : 'Normal'} />
          <StatCard label="En retard" value={late.length} tone={late.length > 0 ? 'danger' : 'success'} hint={late.length > 0 ? 'Action requise' : 'À jour'} />
          <StatCard label="Terminées" value={done.length} tone="success" hint="Historique" />
          <StatCard label="Heures estimées" value={totalEstimatedHours + 'h'} hint="Total assigné" />
        </div>

        {/* Projets assignés */}
        <Card>
          <SectionTitle
            title="Projets"
            level="h2"
            subtitle={`${projectsAssigned.length} projet${projectsAssigned.length > 1 ? 's' : ''}`}
          />
          {projectsAssigned.length === 0 ? (
            <EmptyState compact icon="—" message="Aucun projet assigné" />
          ) : (
            projectsAssigned
              .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
              .map(p => {
                const memberTasks = tasksByProject[p.id] || [];
                const openOnProject = memberTasks.filter(t => t.status !== 'done').length;
                const pillarColor = PILLAR_COLOR[p.pillar] || 'var(--text-3)';
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 0',
                      borderBottom: '1px solid var(--border)',
                      textDecoration: 'none',
                    }}
                  >
                    <span style={{
                      width: 4, alignSelf: 'stretch',
                      background: pillarColor, borderRadius: 2,
                    }} />
                    <span style={{
                      fontSize: 11, fontFamily: 'var(--font-mono)',
                      color: 'var(--text-3)', minWidth: 70,
                    }}>{p.code}</span>
                    <span style={{
                      flex: 1, fontSize: 13, color: 'var(--text)', fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.name}
                    </span>
                    <Badge tone={STAGE_TONE[p.stage] || 'neutral'} size="sm">
                      {STAGE_LABEL[p.stage] || p.stage}
                    </Badge>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 999,
                      background: openOnProject > 0 ? 'var(--info-soft)' : 'var(--surface-2)',
                      color: openOnProject > 0 ? 'var(--info)' : 'var(--text-3)',
                      fontFamily: 'var(--font-mono)', fontWeight: 600,
                    }}>
                      {memberTasks.length} tâche{memberTasks.length > 1 ? 's' : ''}
                      {openOnProject > 0 && ` · ${openOnProject} en cours`}
                    </span>
                  </Link>
                );
              })
          )}
        </Card>

        {/* Tâches actives */}
        <Card>
          <SectionTitle
            title="Tâches actives"
            level="h2"
            subtitle={`${open.length} ouverte${open.length > 1 ? 's' : ''}`}
          />
          {open.length === 0 ? (
            <EmptyState
              icon="✓"
              title="Aucune tâche ouverte"
              message="Toutes les tâches assignées sont terminées."
              tone="success"
            />
          ) : (
            <>
              {late.length > 0 && (
                <>
                  <SubLabel color="var(--danger)">En retard ({late.length})</SubLabel>
                  {late.map(t => (
                    <TaskLink key={t.id} task={t} late />
                  ))}
                </>
              )}
              {inProgress.filter(t => !late.includes(t)).length > 0 && (
                <>
                  <SubLabel color="var(--info)" style={{ marginTop: 12 }}>
                    En cours ({inProgress.filter(t => !late.includes(t)).length})
                  </SubLabel>
                  {inProgress.filter(t => !late.includes(t)).map(t => (
                    <TaskLink key={t.id} task={t} />
                  ))}
                </>
              )}
              {open.filter(t => t.status === 'todo').length > 0 && (
                <>
                  <SubLabel style={{ marginTop: 12 }}>
                    À faire ({open.filter(t => t.status === 'todo').length})
                  </SubLabel>
                  {open.filter(t => t.status === 'todo').slice(0, 15).map(t => (
                    <TaskLink key={t.id} task={t} />
                  ))}
                </>
              )}
            </>
          )}
        </Card>
      </div>
    </>
  );
}

function TaskLink({ task, late }) {
  const pillarColor = PILLAR_COLOR[task.projectPillar] || 'var(--text-3)';
  const isComplex = task.complexity === 'complex';
  return (
    <Link
      href={`/projects/${task.projectId}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 0', borderBottom: '1px solid var(--border)',
        textDecoration: 'none', fontSize: 12,
      }}
    >
      <span style={{
        width: 5, height: 5, borderRadius: 5,
        background: late ? 'var(--danger)' : isComplex ? 'var(--danger)' : 'var(--success)',
        flexShrink: 0,
      }} />
      <span style={{
        fontSize: 10, fontFamily: 'var(--font-mono)',
        color: 'var(--text-3)', minWidth: 70,
      }}>{task.projectCode}</span>
      <span style={{ flex: 1, color: 'var(--text)' }}>{task.title}</span>
      {task.estimatedHours && (
        <span style={{
          fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
        }}>{task.estimatedHours}h</span>
      )}
      <Badge tone={STATUS_TONE[task.status]} size="sm">
        {STATUS_LABEL[task.status]}
      </Badge>
      {task.dueDate && (
        <span style={{
          fontSize: 10, color: late ? 'var(--danger)' : 'var(--text-3)',
          fontFamily: 'var(--font-mono)', minWidth: 60, textAlign: 'right',
        }}>
          {fmtDate(task.dueDate)}
        </span>
      )}
    </Link>
  );
}

function StatCard({ label, value, hint, tone = 'neutral' }) {
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
        <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 6 }}>{hint}</div>
      )}
    </Card>
  );
}

const pageStyle = {
  padding: 'var(--sp-6)',
  display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
  maxWidth: 'var(--content-max)', margin: '0 auto', width: '100%',
};
const breadcrumbLink = { color: 'var(--text-3)', textDecoration: 'none' };
