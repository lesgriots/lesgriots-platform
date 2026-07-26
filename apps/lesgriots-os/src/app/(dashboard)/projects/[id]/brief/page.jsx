'use client';
import { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import {
  Card, Badge, Button, Skeleton, EmptyState,
  SectionTitle, useToast,
} from '@/components/ui';
import BriefSections from '@/components/BriefSections';
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

export default function ProjectBriefPage({ params }) {
  const { id } = use(params);
  const { toast } = useToast();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);

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

  const saveBriefField = useCallback(async (key, value) => {
    const newBrief = { ...(data?.project?.creativeBrief || {}), [key]: value };
    setData(prev => ({ ...prev, project: { ...prev.project, creativeBrief: newBrief } }));
    try {
      const r = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data.project, creativeBrief: newBrief }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      toast.error(`Brief : ${e.message}`);
      reload();
    }
  }, [id, data, toast, reload]);

  const generateBrief = useCallback(async () => {
    setGenerating(true);
    try {
      const r = await fetch(`/api/projects/${id}/brief`);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || err.error || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Brief-${data?.project?.code || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Brief généré');
    } catch (e) {
      toast.error(`Brief : ${e.message}`);
    } finally {
      setGenerating(false);
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
        <div style={pageStyle}>
          <Card><Skeleton width="40%" height={20} /></Card>
          <Card style={{ minHeight: 200 }}>
            <Skeleton width="20%" height={14} />
            <div style={{ marginTop: 16 }}>
              <Skeleton height={80} />
              <Skeleton height={80} style={{ marginTop: 10 }} />
              <Skeleton height={80} style={{ marginTop: 10 }} />
            </div>
          </Card>
        </div>
      </>
    );
  }

  const { project, client } = data;
  const pillarColor = PILLAR_COLOR[project.pillar] || 'var(--text-3)';

  return (
    <>
      <TopBar
        title={`Brief — ${project.name}`}
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
            <span style={{ color: 'var(--text-2)' }}>Creative brief</span>
          </div>
          <Link href={`/projects/${id}`} style={{
            ...breadcrumbLink, color: 'var(--text-3)', fontSize: 11,
            fontFamily: 'var(--font-mono)',
          }}>
            ← Fiche projet
          </Link>
        </div>

        {/* Navigation projet */}
        <ProjectNav projectId={id} active="brief" />

        {/* Header projet condensé */}
        <Card variant="pillar" pillarColor={pillarColor}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
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
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <ProjectProgress
              phases={project.phases || []}
              tasks={(project.tasks || []).map(t => ({ ...t, phaseGroup: t.phase_group || t.phaseGroup }))}
              compact
            />
          </div>
        </Card>

        {/* Brief sections */}
        <Card>
          <BriefSections
            brief={project.creativeBrief || {}}
            onSave={saveBriefField}
            onGenerate={generateBrief}
            generating={generating}
          />
        </Card>
      </div>
    </>
  );
}

const pageStyle = {
  padding: 'var(--sp-6)',
  display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
  maxWidth: 'var(--content-max)', margin: '0 auto', width: '100%',
};
const breadcrumbLink = {
  color: 'var(--text-3)', textDecoration: 'none',
};
