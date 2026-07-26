'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import {
  Card, Badge, Button, Skeleton, EmptyState,
  SectionTitle, useToast,
} from '@/components/ui';

const PILLAR_LABEL = {
  STUDIO: 'Studio', PROD: 'Production', GRIOTHEQUE: 'Griothèque',
};

const PILLAR_COLOR = {
  STUDIO: 'var(--pillar-studio)',
  PROD: 'var(--pillar-prod)',
  GRIOTHEQUE: 'var(--pillar-griotheque)',
};

export default function WorkflowsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pillarFilter, setPillarFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    fetch('/api/workflows')
      .then(r => r.json())
      .then(d => { setWorkflows(Array.isArray(d) ? d : []); setLoading(false); })
      .catch((e) => { console.warn('[Workflows] Chargement échoué :', e); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => workflows.filter(w => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || w.name.toLowerCase().includes(q)
      || (w.description || '').toLowerCase().includes(q)
      || w.phaseGroups.some(p => p.toLowerCase().includes(q));
    const matchPillar = pillarFilter === 'all' || w.pillar === pillarFilter;
    return matchSearch && matchPillar;
  }), [workflows, search, pillarFilter]);

  const createWorkflow = async () => {
    setCreating(true);
    try {
      const r = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Nouveau workflow',
          description: 'Décris ici l\'objet de ce workflow',
          pillar: pillarFilter !== 'all' ? pillarFilter : 'STUDIO',
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const { id } = await r.json();
      toast.success('Workflow créé');
      router.push(`/workflows/${id}`);
    } catch (e) {
      toast.error(`Échec : ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const filterBtns = [
    { key: 'all',        label: 'Tous' },
    { key: 'STUDIO',     label: 'Studio' },
    { key: 'PROD',       label: 'Production' },
    { key: 'GRIOTHEQUE', label: 'Griothèque' },
  ];

  return (
    <>
      <TopBar
        title="Workflows"
        subtitle={`${workflows.length} workflow${workflows.length > 1 ? 's' : ''} · réutilisables sur tous tes projets`}
      />
      <div style={{
        padding: 'var(--sp-6)',
        display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
      }}>

        {/* Intro */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{
                fontSize: 14, fontWeight: 500, color: 'var(--text)',
                fontFamily: 'var(--font-title)', marginBottom: 4,
              }}>
                Workflows de tâches réutilisables
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
                Chaque workflow définit une séquence de tâches avec phases, complexité et dépendances.
                Tu peux les appliquer à n'importe quel projet en un clic depuis la fiche projet.
              </div>
            </div>
            <Button variant="primary" size="md" onClick={createWorkflow} disabled={creating}>
              {creating ? 'Création…' : '+ Nouveau workflow'}
            </Button>
          </div>
        </Card>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un workflow…"
            style={{
              flex: 1, maxWidth: 360, padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 13, outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {filterBtns.map(f => {
              const active = pillarFilter === f.key;
              return (
                <button key={f.key} onClick={() => setPillarFilter(f.key)} style={{
                  padding: '5px 12px', borderRadius: 999,
                  fontSize: 11, fontWeight: 500, cursor: 'pointer',
                  border: '1px solid ' + (active ? 'var(--gold)' : 'var(--border)'),
                  background: active ? 'var(--gold-soft)' : 'transparent',
                  color: active ? 'var(--gold-deep)' : 'var(--text-3)',
                  fontFamily: 'var(--font-sans)',
                }}>{f.label}</button>
              );
            })}
          </div>
        </div>

        {/* Grid des workflows */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={180} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="◌"
            title={search || pillarFilter !== 'all' ? 'Aucun résultat' : 'Aucun workflow'}
            message="Crée ton premier workflow pour démarrer."
            action={
              <Button variant="primary" onClick={createWorkflow}>+ Nouveau workflow</Button>
            }
          />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 12,
          }} className="lg-stagger">
            {filtered.map(w => {
              const pillarColor = PILLAR_COLOR[w.pillar] || 'var(--text-3)';
              const complexCount = (w.tasks || []).filter(t => t.complexity === 'complex').length;
              const totalHours = (w.tasks || []).reduce((s, t) => s + (Number(t.estimatedHours) || 0), 0);
              return (
                <Card
                  key={w.id}
                  interactive
                  onClick={() => router.push(`/workflows/${w.id}`)}
                  variant="pillar"
                  pillarColor={pillarColor}
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{
                        display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4,
                      }}>
                        {w.icon && <span style={{ fontSize: 16 }}>{w.icon}</span>}
                        <span style={{
                          fontSize: 15, fontWeight: 500, color: 'var(--text)',
                          fontFamily: 'var(--font-title)',
                        }}>
                          {w.name}
                        </span>
                      </div>
                      {w.pillar && (
                        <Badge tone="pillar" pillar={w.pillar} size="sm">
                          {PILLAR_LABEL[w.pillar] || w.pillar}
                        </Badge>
                      )}
                    </div>
                    <div style={{
                      fontSize: 18, fontWeight: 600, color: 'var(--text)',
                      fontFamily: 'var(--font-mono)', lineHeight: 1,
                    }}>
                      {w.taskCount}
                    </div>
                  </div>

                  {w.description && (
                    <div style={{
                      fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5,
                      marginBottom: 10,
                    }}>
                      {w.description}
                    </div>
                  )}

                  {/* Phase groups */}
                  {w.phaseGroups.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                      {w.phaseGroups.map(p => (
                        <Badge key={p} tone="neutral" size="sm">{p}</Badge>
                      ))}
                    </div>
                  )}

                  {/* Footer stats */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    paddingTop: 8, borderTop: '1px solid var(--border)',
                    fontSize: 11, color: 'var(--text-3)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    <span>
                      {complexCount > 0 && `${complexCount} ◆ complex`}
                      {complexCount > 0 && complexCount < w.taskCount && ' · '}
                      {complexCount < w.taskCount && `${w.taskCount - complexCount} ● simple`}
                    </span>
                    {totalHours > 0 && <span>{totalHours}h estimées</span>}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
