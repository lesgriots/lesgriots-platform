'use client';
import { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import {
  Card, Badge, Button, Skeleton, EmptyState,
  SectionTitle, useToast,
} from '@/components/ui';
import PhasesPanel from '@/components/PhasesPanel';
import PhasesGantt from '@/components/PhasesGantt';
import ProjectNav from '@/components/ProjectNav';
import ProjectProgress from '@/components/ProjectProgress';

const PILLAR_LABEL = {
  STUDIO: 'Studio', PROD: 'Production', GRIOTHEQUE: 'Griothèque',
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

export default function ProjectPhasesPage({ params }) {
  const { id } = use(params);
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const reload = useCallback(() => {
    return fetch('/api/data')
      .then(r => r.json())
      .then(d => {
        const project = (d.projects || []).find(p => p.id === id);
        if (!project) { setError('PROJECT_NOT_FOUND'); return; }
        const client = (d.clients || []).find(c => c.id === project.clientId);
        setData({ project, client });
      })
      .catch(e => setError(e.message));
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  const exportPDF = useCallback(async () => {
    setExporting(true);
    try {
      const r = await fetch(`/api/projects/${id}/phases/export`);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || err.error || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Roadmap-${data?.project?.code || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Roadmap exportée');
    } catch (e) {
      toast.error(`Export : ${e.message}`);
    } finally {
      setExporting(false);
    }
  }, [id, data, toast]);

  if (error === 'PROJECT_NOT_FOUND') {
    return (
      <>
        <TopBar title="Projet introuvable" />
        <div style={pageStyle}>
          <EmptyState
            icon="✕"
            title="Ce projet n'existe pas"
            action={<Button variant="primary" href="/projects">← Retour aux projets</Button>}
          />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <TopBar title="Erreur" />
        <div style={pageStyle}>
          <Card variant="alert">
            <strong style={{ color: 'var(--danger)' }}>Erreur :</strong> {error}
          </Card>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <TopBar title="Chargement…" />
        <div style={pageStyle}><Card><Skeleton width="40%" height={20} /></Card></div>
      </>
    );
  }

  const { project, client } = data;
  const pillarColor = PILLAR_COLOR[project.pillar] || 'var(--text-3)';
  const phases = Array.isArray(project.phases) ? project.phases : [];
  const tasks = (project.tasks || []).map(t => ({
    ...t,
    phaseGroup: t.phase_group || t.phaseGroup || '',
    assigneeName: t.assignee_name || t.assigneeName,
    dueDate: t.due_date || t.dueDate,
  }));

  const sortedPhases = [...phases].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const totalTasks = tasks.length;
  const tasksDone = tasks.filter(t => t.status === 'done').length;
  const tasksOpen = totalTasks - tasksDone;
  const totalHours = tasks.reduce((s, t) => s + (Number(t.estimatedHours) || 0), 0);
  const tasksInPhases = sortedPhases.reduce((s, ph) => s + tasks.filter(t => t.phaseGroup === ph.name).length, 0);

  // Chemin critique simple : somme du max d'heures par phase
  const criticalPath = sortedPhases.reduce((s, ph) => {
    const max = tasks
      .filter(t => t.phaseGroup === ph.name)
      .reduce((m, t) => Math.max(m, Number(t.estimatedHours) || 0), 0);
    return s + max;
  }, 0);

  return (
    <>
      <TopBar
        title={`Roadmap — ${project.name}`}
        subtitle={`${project.code} · ${PILLAR_LABEL[project.pillar] || project.pillar}`}
      />
      <div style={pageStyle} className="lg-anim-fade">

        {/* Breadcrumb */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link href="/projects" style={breadcrumbLink}>← Projets</Link>
            <span style={{ color: 'var(--text-3)' }}>/</span>
            <Link href={`/projects/${id}`} style={breadcrumbLink}>{project.code}</Link>
            <span style={{ color: 'var(--text-3)' }}>/</span>
            <span style={{ color: 'var(--text-2)' }}>Roadmap</span>
          </div>
          <Link href={`/projects/${id}`} style={{
            ...breadcrumbLink, color: 'var(--text-3)', fontSize: 11,
            fontFamily: 'var(--font-mono)',
          }}>
            ← Fiche projet
          </Link>
        </div>

        {/* Navigation projet */}
        <ProjectNav projectId={id} active="phases" />

        {/* Header projet condensé */}
        <Card variant="pillar" pillarColor={pillarColor}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <h1 style={{
                margin: 0, fontSize: 22, fontWeight: 500, color: 'var(--text)',
                fontFamily: 'var(--font-title)', letterSpacing: -0.01,
              }}>
                {project.name}
              </h1>
              <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge tone="pillar" pillar={project.pillar} size="sm">{PILLAR_LABEL[project.pillar] || project.pillar}</Badge>
                {client && (
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    Client : {client.company || `${client.firstName} ${client.lastName}`.trim()}
                  </span>
                )}
                {project.startDate && project.endDate && (
                  <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                    {fmtDate(project.startDate)} → {fmtDate(project.endDate)}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={exportPDF}
              disabled={exporting || sortedPhases.length === 0}
            >
              {exporting ? 'Export…' : '🗺 Roadmap PDF'}
            </Button>
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <ProjectProgress phases={phases} tasks={tasks} />
          </div>
        </Card>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 8,
        }}>
          <Stat label="Phases" value={sortedPhases.length} />
          <Stat label="Tâches assignées" value={`${tasksInPhases}/${totalTasks}`} hint={tasksInPhases < totalTasks ? `${totalTasks - tasksInPhases} orpheline${totalTasks - tasksInPhases > 1 ? 's' : ''}` : 'Toutes liées'} />
          <Stat label="Progression" value={`${totalTasks ? Math.round((tasksDone / totalTasks) * 100) : 0}%`} hint={`${tasksDone}/${totalTasks} done`} tone={tasksDone === totalTasks && totalTasks > 0 ? 'success' : 'neutral'} />
          <Stat label="Heures estimées" value={totalHours ? `${totalHours}h` : '—'} />
          <Stat label="Chemin critique" value={criticalPath ? `${criticalPath}h` : '—'} hint="Si parallélisé max" />
        </div>

        {/* Calendrier Gantt inline */}
        <Card>
          <SectionTitle
            title="Calendrier"
            level="h2"
            subtitle="Vue Gantt des phases · dates éditables ci-dessous"
          />
          <PhasesGantt
            phases={phases}
            tasks={tasks}
            project={project}
          />
        </Card>

        {/* Phases avec tâches dépliées (réutilise PhasesPanel) */}
        <PhasesPanel
          projectId={id}
          phases={phases}
          tasks={tasks}
          onChange={reload}
        />
      </div>
    </>
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
        <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 6 }}>{hint}</div>
      )}
    </Card>
  );
}

const pageStyle = {
  padding: 'var(--sp-6)',
  display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
  maxWidth: 'var(--content-max)', margin: '0 auto', width: '100%', boxSizing: 'border-box',
};
const breadcrumbLink = { color: 'var(--text-3)', textDecoration: 'none' };
