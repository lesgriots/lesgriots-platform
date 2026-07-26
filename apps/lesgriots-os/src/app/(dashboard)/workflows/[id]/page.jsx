'use client';
import { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import {
  Card, Badge, Button, Skeleton, EmptyState,
  SectionTitle, SubLabel, EditableField, useToast, useConfirm,
} from '@/components/ui';

const PILLAR_OPTIONS = [
  { value: '',           label: '— Aucun —' },
  { value: 'STUDIO',     label: 'Studio' },
  { value: 'PROD',       label: 'Production' },
  { value: 'GRIOTHEQUE', label: 'Griothèque' },
];

const COMPLEX_TONE = { complex: 'danger', simple: 'success' };

const PILLAR_COLOR = {
  STUDIO: 'var(--pillar-studio)',
  PROD: 'var(--pillar-prod)',
  GRIOTHEQUE: 'var(--pillar-griotheque)',
};

export default function WorkflowDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [wf, setWf] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/workflows/${id}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setWf)
      .catch(e => setError(e.message === 'HTTP 404' ? 'NOT_FOUND' : e.message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const saveMeta = useCallback(async (field, value) => {
    setWf(prev => prev ? { ...prev, [field]: value } : prev);
    try {
      const r = await fetch(`/api/workflows/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      toast.error(`Échec : ${e.message}`);
      load();
    }
  }, [id, toast, load]);

  const updateTask = useCallback(async (taskId, patch) => {
    setWf(prev => prev ? {
      ...prev,
      tasks: prev.tasks.map(t => t.id === taskId ? { ...t, ...patch } : t),
    } : prev);
    try {
      const r = await fetch(`/api/workflows/${id}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      toast.error(`Tâche : ${e.message}`);
      load();
    }
  }, [id, toast, load]);

  const deleteTask = useCallback(async (taskId) => {
    setWf(prev => prev ? { ...prev, tasks: prev.tasks.filter(t => t.id !== taskId) } : prev);
    try {
      await fetch(`/api/workflows/${id}/tasks/${taskId}`, { method: 'DELETE' });
    } catch (e) {
      toast.error('Suppression échouée');
      load();
    }
  }, [id, toast, load]);

  const addTask = useCallback(async (phaseGroup = '') => {
    setAdding(true);
    try {
      const r = await fetch(`/api/workflows/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Nouvelle tâche', phaseGroup, complexity: 'simple' }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await load();
    } catch (e) {
      toast.error(`Ajout : ${e.message}`);
    } finally {
      setAdding(false);
    }
  }, [id, toast, load]);

  const deleteWorkflow = async () => {
    if (!(await confirm({ title: `Supprimer le workflow "${wf.name}" ?`, message: "Cela n'affecte pas les projets où il a déjà été appliqué.", confirmLabel: 'Supprimer' }))) return;
    try {
      const r = await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success('Workflow supprimé');
      router.push('/workflows');
    } catch (e) {
      toast.error(`Échec : ${e.message}`);
    }
  };

  if (error === 'NOT_FOUND') {
    return (
      <>
        <TopBar title="Workflow introuvable" />
        <div style={pageStyle}>
          <EmptyState
            icon="✕"
            title="Ce workflow n'existe pas"
            action={<Button variant="primary" href="/workflows">← Retour aux workflows</Button>}
          />
        </div>
      </>
    );
  }

  if (!wf) {
    return (
      <>
        <TopBar title="Chargement…" />
        <div style={pageStyle}><Card><Skeleton width="40%" height={20} /></Card></div>
      </>
    );
  }

  const pillarColor = PILLAR_COLOR[wf.pillar] || 'var(--text-3)';
  // Group tasks by phase
  const groupedTasks = (() => {
    const groups = {};
    for (const t of wf.tasks) {
      const key = t.phaseGroup || '__autres__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return groups;
  })();
  const groupOrder = [...new Set(wf.tasks.map(t => t.phaseGroup || '__autres__'))];

  const totalHours = wf.tasks.reduce((s, t) => s + (Number(t.estimatedHours) || 0), 0);
  const complexCount = wf.tasks.filter(t => t.complexity === 'complex').length;

  return (
    <>
      <TopBar title={wf.name} subtitle={`Workflow · ${wf.tasks.length} tâches`} />
      <div style={pageStyle} className="lg-anim-fade">

        {/* Breadcrumb + actions */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link href="/workflows" style={breadcrumbLink}>← Workflows</Link>
            <span style={{ color: 'var(--text-3)' }}>/</span>
            <span style={{ color: 'var(--text-2)' }}>{wf.name}</span>
          </div>
          <Button variant="danger" size="sm" onClick={deleteWorkflow}>Supprimer</Button>
        </div>

        {/* Header editable */}
        <Card variant="pillar" pillarColor={pillarColor}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ width: 50, flexShrink: 0 }}>
              <EditableField
                value={wf.icon || ''}
                onSave={(v) => saveMeta('icon', v)}
                placeholder="✨"
                inputStyle={{ fontSize: 32, textAlign: 'center', padding: '6px' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <EditableField
                value={wf.name}
                onSave={(v) => saveMeta('name', v)}
                placeholder="Nom du workflow"
                inputStyle={{
                  fontSize: 20, fontWeight: 500,
                  fontFamily: 'var(--font-title)',
                }}
              />
              <div style={{ marginTop: 10 }}>
                <SubLabel>Pilier</SubLabel>
                <select
                  value={wf.pillar || ''}
                  onChange={(e) => saveMeta('pillar', e.target.value)}
                  style={{
                    padding: '6px 10px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text)', fontSize: 12,
                    fontFamily: 'var(--font-sans)', outline: 'none',
                  }}
                >
                  {PILLAR_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <EditableField
              label="Description"
              value={wf.description || ''}
              type="textarea"
              rows={2}
              onSave={(v) => saveMeta('description', v)}
              placeholder="À quoi sert ce workflow ?"
            />
          </div>
        </Card>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 8,
        }}>
          <Stat label="Tâches" value={wf.tasks.length} />
          <Stat label="Phases" value={groupOrder.filter(g => g !== '__autres__').length} />
          <Stat label="Complex" value={complexCount} tone="danger" hint={`${wf.tasks.length - complexCount} simples`} />
          <Stat label="Heures estimées" value={totalHours ? `${totalHours}h` : '—'} />
        </div>

        {/* Tâches par phase */}
        <Card>
          <SectionTitle
            title="Tâches du workflow"
            level="h2"
            subtitle="Glisser un titre · clic sur badge pour toggle"
            right={
              <Button size="sm" variant="primary" onClick={() => addTask('')} disabled={adding}>
                + Tâche
              </Button>
            }
          />

          {wf.tasks.length === 0 ? (
            <EmptyState
              icon="◌"
              title="Aucune tâche"
              message="Ajoute des tâches pour construire ce workflow."
              action={<Button variant="primary" onClick={() => addTask('')}>+ Ajouter une tâche</Button>}
            />
          ) : (
            groupOrder.map(groupKey => {
              const label = groupKey === '__autres__' ? 'Sans phase' : groupKey;
              const tasksInGroup = groupedTasks[groupKey] || [];
              return (
                <div key={groupKey} style={{ marginBottom: 16 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                    paddingBottom: 6, borderBottom: '2px solid var(--gold)',
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--text)',
                      textTransform: 'uppercase', letterSpacing: 0.6,
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {label}
                    </span>
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 999,
                      background: 'var(--surface-2)', color: 'var(--text-3)',
                      fontFamily: 'var(--font-mono)',
                    }}>{tasksInGroup.length}</span>
                  </div>

                  {tasksInGroup.map(t => (
                    <WorkflowTaskRow
                      key={t.id}
                      task={t}
                      allTasks={wf.tasks}
                      onUpdate={(patch) => updateTask(t.id, patch)}
                      onDelete={() => deleteTask(t.id)}
                    />
                  ))}

                  <button
                    onClick={() => addTask(groupKey === '__autres__' ? '' : groupKey)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 0', background: 'transparent',
                      border: 'none', cursor: 'pointer',
                      color: 'var(--text-3)', fontSize: 11,
                      fontFamily: 'var(--font-sans)',
                    }}
                  >+ Ajouter une tâche dans {label}</button>
                </div>
              );
            })
          )}
        </Card>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// WorkflowTaskRow
// ─────────────────────────────────────────────────────────
function WorkflowTaskRow({ task, allTasks, onUpdate, onDelete }) {
  const [hover, setHover] = useState(false);
  const [depsOpen, setDepsOpen] = useState(false);
  const deps = Array.isArray(task.dependsOn) ? task.dependsOn : [];
  const isComplex = task.complexity === 'complex';

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 0', borderBottom: '1px solid var(--border)',
        fontSize: 12,
      }}
    >
      <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 11, minWidth: 24, textAlign: 'right' }}>
        {task.sortOrder + 1}.
      </span>
      <input
        type="text"
        value={task.title || ''}
        onChange={(e) => onUpdate({ title: e.target.value })}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-sans)',
          padding: '2px 0',
        }}
      />

      <input
        type="text"
        value={task.phaseGroup || ''}
        onChange={(e) => onUpdate({ phaseGroup: e.target.value })}
        placeholder="Phase"
        style={{
          width: 120, padding: '3px 8px',
          background: 'transparent',
          border: '1px solid transparent',
          color: 'var(--text-2)',
          fontSize: 11, fontFamily: 'var(--font-mono)',
          outline: 'none', borderRadius: 4,
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
      />

      <button
        onClick={() => onUpdate({ complexity: isComplex ? 'simple' : 'complex' })}
        style={{
          fontSize: 10, padding: '2px 7px', borderRadius: 999,
          background: isComplex ? 'var(--danger-soft)' : 'var(--success-soft)',
          color: isComplex ? 'var(--danger)' : 'var(--success)',
          border: '1px solid ' + (isComplex ? 'var(--danger)' : 'var(--success)'),
          cursor: 'pointer', fontFamily: 'var(--font-sans)',
          fontWeight: 500, whiteSpace: 'nowrap',
        }}
      >
        {isComplex ? '◆ Complex' : '● Simple'}
      </button>

      <input
        type="number"
        step="0.5"
        min="0"
        value={task.estimatedHours ?? ''}
        onChange={(e) => onUpdate({ estimatedHours: e.target.value })}
        placeholder="h"
        title="Heures estimées"
        style={{
          width: 44, padding: '2px 4px',
          background: 'transparent',
          border: '1px solid transparent',
          color: 'var(--text-2)',
          fontSize: 10, fontFamily: 'var(--font-mono)',
          outline: 'none', borderRadius: 4, textAlign: 'right',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
      />

      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setDepsOpen(o => !o)}
          title={deps.length ? `${deps.length} dépendance(s)` : 'Ajouter dépendance'}
          style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 999,
            background: deps.length ? 'var(--info-soft)' : 'transparent',
            color: deps.length ? 'var(--info)' : 'var(--text-3)',
            border: '1px solid ' + (deps.length ? 'var(--info)' : 'var(--border)'),
            cursor: 'pointer', fontFamily: 'var(--font-mono)',
          }}
        >
          ⇠ {deps.length || '0'}
        </button>
        {depsOpen && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
            zIndex: 10, minWidth: 260, maxHeight: 280, overflowY: 'auto',
            padding: 4,
          }}>
            <div style={{
              padding: '6px 12px 2px', fontSize: 10,
              color: 'var(--text-3)', textTransform: 'uppercase',
              letterSpacing: 0.6, fontFamily: 'var(--font-mono)',
            }}>
              Doit finir avant
            </div>
            {allTasks.filter(t => t.id !== task.id).length === 0 ? (
              <div style={{ padding: 8, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
                Aucune autre tâche
              </div>
            ) : (
              allTasks.filter(t => t.id !== task.id).map(t => {
                const selected = deps.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      const newDeps = selected ? deps.filter(d => d !== t.id) : [...deps, t.id];
                      onUpdate({ dependsOn: newDeps });
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 8px', background: selected ? 'var(--info-soft)' : 'transparent',
                      border: 'none', borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer', textAlign: 'left',
                      fontSize: 11, color: 'var(--text)',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    <span style={{
                      width: 10, height: 10, borderRadius: 2,
                      border: '1.5px solid ' + (selected ? 'var(--info)' : 'var(--border-2)'),
                      background: selected ? 'var(--info)' : 'transparent',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--on-solid)', fontSize: 8, flexShrink: 0,
                    }}>{selected ? '✓' : ''}</span>
                    <span style={{
                      flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{t.title}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {hover && (
        <button
          onClick={onDelete}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-3)', fontSize: 14, padding: 2, lineHeight: 1,
          }}
          title="Supprimer"
        >×</button>
      )}
    </div>
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
  maxWidth: 'var(--content-max)', margin: '0 auto', width: '100%',
};
const breadcrumbLink = { color: 'var(--text-3)', textDecoration: 'none' };
