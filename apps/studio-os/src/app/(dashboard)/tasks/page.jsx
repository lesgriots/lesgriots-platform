'use client';
import { useState, useEffect } from 'react';
import TopBar from '@/components/layout/TopBar';
import { Card, Button, EmptyState, useToast } from '@/components/ui';

const STATUS_COLS = [
  { key: 'todo', label: 'À faire', color: 'var(--text-3)' },
  { key: 'in_progress', label: 'En cours', color: 'var(--info)' },
  { key: 'review', label: 'Review', color: 'var(--gold-deep)' },
  { key: 'done', label: 'Terminé', color: 'var(--success)' },
];

const PHASE_COLORS = {
  'pre-prod': 'var(--info)', 'tournage': 'var(--warning)', 'post-prod': 'var(--pillar-prod)',
  'livraison': 'var(--success)', 'admin': 'var(--text-3)', 'créa': 'var(--danger)',
};

export default function TasksPage() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [projectFilter, setProjectFilter] = useState('all');
  const [view, setView] = useState('board'); // board | list

  useEffect(() => {
    setLoadError(false);
    fetch('/api/data')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => {
        setTasks(d.tasks || []);
        setProjects(d.projects || []);
        setLoading(false);
      })
      .catch((e) => { console.warn('[Tâches] Chargement échoué :', e); setLoadError(true); setLoading(false); });
  }, [reloadKey]);

  const moveTask = async (taskId, newStatus) => {
    try {
      const r = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(j.error || `Erreur ${r.status}`);
        return;
      }
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (e) {
      console.warn('[Tâches] Déplacement échoué :', e);
      toast.error('Erreur réseau — tâche non déplacée');
    }
  };

  const filtered = projectFilter === 'all' ? tasks : tasks.filter(t => t.project_id === projectFilter);
  const projectsWithTasks = [...new Set(tasks.map(t => t.project_id))].map(id => projects.find(p => p.id === id)).filter(Boolean);

  return (
    <>
      <TopBar title="Tâches" subtitle={`${tasks.length} tâches`} />
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} style={{
            padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12,
            background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)',
            cursor: 'pointer', outline: 'none', maxWidth: 280,
          }}>
            <option value="all">Tous les projets</option>
            {projectsWithTasks.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ key: 'board', label: 'Board' }, { key: 'list', label: 'Liste' }].map(v => (
              <button key={v.key} onClick={() => setView(v.key)} style={{
                padding: '5px 12px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 500,
                cursor: 'pointer', border: '1px solid var(--border)',
                background: view === v.key ? 'var(--gold-soft)' : 'transparent',
                color: view === v.key ? 'var(--gold)' : 'var(--text-3)',
              }}>{v.label}</button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {filtered.filter(t => t.status === 'done').length}/{filtered.length} terminées
          </span>
        </div>

        {loadError && !loading && (
          <Card variant="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--danger)', fontSize: 13 }}>Impossible de charger les tâches.</span>
              <Button variant="danger" size="sm" onClick={() => { setLoading(true); setReloadKey(k => k + 1); }}>Réessayer</Button>
            </div>
          </Card>
        )}

        {loading ? (
          <div style={{ color: 'var(--text-3)', padding: 32 }}>Chargement...</div>
        ) : !loadError && filtered.length === 0 ? (
          <EmptyState
            icon="✓"
            tone="success"
            title="Aucune tâche"
            message={projectFilter === 'all'
              ? 'Rien à faire pour le moment. Les tâches se créent depuis la fiche d’un projet.'
              : 'Aucune tâche pour ce projet. Change de filtre ou ajoute des tâches depuis la fiche projet.'}
          />
        ) : view === 'board' ? (
          /* Kanban board */
          <div className="resp-kanban" style={{ display: 'flex', gap: 12, flex: 1, overflowX: 'auto', paddingBottom: 12 }}>
            {STATUS_COLS.map(col => {
              const colTasks = filtered.filter(t => t.status === col.key);
              return (
                <div key={col.key} style={{ minWidth: 260, width: 260, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 4px', borderBottom: `2px solid ${col.color}`, marginBottom: 4,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{col.label}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 10,
                        background: 'var(--surface-2)', color: 'var(--text-3)',
                      }}>{colTasks.length}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {colTasks.map(t => {
                      const proj = projects.find(p => p.id === t.project_id);
                      return (
                        <TaskCard key={t.id} task={t} project={proj} onMove={moveTask} columns={STATUS_COLS} />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List view */
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', overflow: 'hidden',
          }}>
            <div className="resp-table-head" style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 100px 100px 90px',
              padding: '10px 20px', borderBottom: '1px solid var(--border)',
              fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.04em',
            }}>
              <span>TÂCHE</span><span>PROJET</span><span>PHASE</span><span>ASSIGNÉ</span><span>STATUT</span>
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Aucune tâche</div>
            ) : filtered.map((t, i) => {
              const proj = projects.find(p => p.id === t.project_id);
              return (
                <div key={t.id} className="resp-table-row" style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 100px 100px 90px',
                  padding: '10px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                  alignItems: 'center', fontSize: 13,
                  transition: 'background var(--duration) var(--ease)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontWeight: 500, color: 'var(--text)', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{proj?.code || '—'}</span>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 10,
                    background: t.phase ? `color-mix(in srgb, ${PHASE_COLORS[t.phase] || 'var(--text-3)'} 14%, transparent)` : 'transparent',
                    color: PHASE_COLORS[t.phase] || 'var(--text-3)', fontWeight: 500,
                  }}>{t.phase || '—'}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{t.assignee_name || '—'}</span>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 10,
                    background: `color-mix(in srgb, ${STATUS_COLS.find(c => c.key === t.status)?.color || 'var(--text-3)'} 14%, transparent)`,
                    color: STATUS_COLS.find(c => c.key === t.status)?.color || 'var(--text-3)', fontWeight: 500,
                  }}>{STATUS_COLS.find(c => c.key === t.status)?.label || t.status}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function TaskCard({ task, project, onMove, columns }) {
  const [hover, setHover] = useState(false);
  const idx = columns.findIndex(c => c.key === task.status);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'var(--surface-2)' : 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
        padding: '12px 14px', cursor: 'default',
        transition: 'all var(--duration) var(--ease)',
        borderLeft: task.phase ? `3px solid ${PHASE_COLORS[task.phase] || 'var(--text-3)'}` : '3px solid var(--border)',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6, lineHeight: 1.3 }}>
        {task.title}
      </div>
      {project && (
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginBottom: 6 }}>
          {project.code}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {task.phase && (
            <span style={{
              fontSize: 10, padding: '1px 6px', borderRadius: 10,
              background: `color-mix(in srgb, ${PHASE_COLORS[task.phase] || 'var(--text-3)'} 14%, transparent)`,
              color: PHASE_COLORS[task.phase] || 'var(--text-3)', fontWeight: 500,
            }}>{task.phase}</span>
          )}
        </div>
        {task.assignee_name && (
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{task.assignee_name}</span>
        )}
      </div>
      {hover && (
        <div style={{ display: 'flex', gap: 4, marginTop: 8, justifyContent: 'flex-end' }}>
          {idx > 0 && <button onClick={() => onMove(task.id, columns[idx - 1].key)} style={arrowBtnStyle}>←</button>}
          {idx < columns.length - 1 && <button onClick={() => onMove(task.id, columns[idx + 1].key)} style={arrowBtnStyle}>→</button>}
        </div>
      )}
    </div>
  );
}

const arrowBtnStyle = {
  background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 4,
  color: 'var(--text-2)', fontSize: 11, padding: '2px 8px', cursor: 'pointer',
  fontFamily: 'var(--font-mono)',
};
