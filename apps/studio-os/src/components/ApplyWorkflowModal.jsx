'use client';
/**
 * ApplyWorkflowModal — modale pour appliquer un workflow template à un projet.
 *
 * Workflow :
 *   1) Charger les workflows disponibles
 *   2) L'utilisateur sélectionne un workflow (filtré par pilier du projet par défaut)
 *   3) Preview de toutes les tâches qui seront créées (groupées par phase)
 *   4) Confirm → POST /api/workflows/[id]/apply { projectId }
 */
import { useEffect, useState } from 'react';
import { Button, Badge, useToast } from '@/components/ui';

const PILLAR_LABEL = {
  STUDIO: 'Studio', PROD: 'Production', GRIOTHEQUE: 'Griothèque',
};

export default function ApplyWorkflowModal({ open, onClose, project, onApplied }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [applying, setApplying] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/workflows')
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : [];
        setWorkflows(list);
        // Pre-select : premier workflow qui matche le pilier du projet
        if (project?.pillar) {
          const match = list.find(w => w.pillar === project.pillar);
          if (match) setSelectedId(match.id);
          else if (list.length > 0) setSelectedId(list[0].id);
        } else if (list.length > 0) {
          setSelectedId(list[0].id);
        }
        setLoading(false);
      })
      .catch((e) => { console.warn('[ApplyWorkflow] Chargement échoué :', e); setLoading(false); });
  }, [open, project]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const selected = workflows.find(w => w.id === selectedId);
  const tasksByGroup = (() => {
    if (!selected) return {};
    const groups = {};
    for (const t of selected.tasks || []) {
      const k = t.phaseGroup || '—';
      if (!groups[k]) groups[k] = [];
      groups[k].push(t);
    }
    return groups;
  })();

  const apply = async () => {
    if (!selectedId || !project?.id) return;
    setApplying(true);
    try {
      const r = await fetch(`/api/workflows/${selectedId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${r.status}`);
      }
      const { created } = await r.json();
      toast.success(`${created} tâche${created > 1 ? 's' : ''} ajoutée${created > 1 ? 's' : ''} au projet`);
      if (onApplied) onApplied();
      onClose();
    } catch (e) {
      toast.error(`Échec : ${e.message}`);
    } finally {
      setApplying(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Appliquer un workflow"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--overlay)',
        zIndex: 900,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '6vh',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        className="lg-anim-rise resp-modal"
        style={{
          width: 'min(860px, calc(100vw - 32px))',
          maxHeight: '88vh',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{
            margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text)',
            fontFamily: 'var(--font-title)',
          }}>
            Appliquer un workflow à <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>{project?.code}</span>
          </h3>
          <kbd style={{
            fontSize: 10, padding: '2px 6px',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 4, color: 'var(--text-3)',
            fontFamily: 'var(--font-mono)',
          }}>Esc</kbd>
        </div>

        {/* Corps : sélecteur + preview */}
        <div className="resp-grid-1col" style={{
          flex: 1, display: 'grid', gridTemplateColumns: '260px 1fr',
          minHeight: 0,
        }}>
          {/* Sélecteur gauche */}
          <div style={{
            borderRight: '1px solid var(--border)',
            overflowY: 'auto', padding: 8,
          }}>
            {loading ? (
              <div style={{ padding: 12, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
                Chargement…
              </div>
            ) : workflows.length === 0 ? (
              <div style={{ padding: 12, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
                Aucun workflow disponible.
              </div>
            ) : (
              workflows.map(w => {
                const isSel = w.id === selectedId;
                const matchPillar = !project?.pillar || w.pillar === project.pillar;
                return (
                  <button
                    key={w.id}
                    onClick={() => setSelectedId(w.id)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 10px', marginBottom: 4,
                      background: isSel ? 'var(--gold-soft)' : 'transparent',
                      border: '1px solid ' + (isSel ? 'var(--gold)' : 'transparent'),
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      transition: 'background var(--duration) var(--ease)',
                    }}
                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--surface-2)'; }}
                    onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3,
                    }}>
                      {w.icon && <span>{w.icon}</span>}
                      <span style={{
                        fontSize: 12, fontWeight: 500, color: 'var(--text)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        flex: 1,
                      }}>{w.name}</span>
                      {matchPillar && project?.pillar && (
                        <span style={{ fontSize: 10, color: 'var(--gold)' }}>★</span>
                      )}
                    </div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 10, color: 'var(--text-3)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      <span>{PILLAR_LABEL[w.pillar] || '—'}</span>
                      <span>{w.taskCount} tâches</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Preview droite */}
          <div style={{ padding: 14, overflowY: 'auto' }}>
            {!selected ? (
              <div style={{ color: 'var(--text-3)', fontSize: 12, textAlign: 'center', padding: 32 }}>
                Sélectionne un workflow à gauche pour voir l'aperçu.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {selected.icon && <span style={{ fontSize: 18 }}>{selected.icon}</span>}
                  <h4 style={{
                    margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text)',
                    fontFamily: 'var(--font-title)',
                  }}>{selected.name}</h4>
                  {selected.pillar && (
                    <Badge tone="pillar" pillar={selected.pillar} size="sm">
                      {PILLAR_LABEL[selected.pillar]}
                    </Badge>
                  )}
                </div>

                {selected.description && (
                  <p style={{
                    fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5,
                    margin: '0 0 14px',
                  }}>{selected.description}</p>
                )}

                <div style={{
                  fontSize: 10, color: 'var(--text-3)',
                  fontFamily: 'var(--font-mono)', marginBottom: 12,
                  display: 'flex', gap: 16,
                }}>
                  <span>{(selected.tasks || []).length} tâches</span>
                  <span>{Object.keys(tasksByGroup).length} phases</span>
                  {(() => {
                    const h = (selected.tasks || []).reduce((s, t) => s + (Number(t.estimatedHours) || 0), 0);
                    return h ? <span>{h}h estimées</span> : null;
                  })()}
                </div>

                {Object.entries(tasksByGroup).map(([groupName, tasks]) => (
                  <div key={groupName} style={{ marginBottom: 14 }}>
                    <div style={{
                      fontSize: 10, fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: 0.6,
                      color: 'var(--text)', fontFamily: 'var(--font-mono)',
                      paddingBottom: 4, borderBottom: '1px solid var(--border)',
                      marginBottom: 6,
                    }}>
                      {groupName === '—' ? 'Sans phase' : groupName}
                      <span style={{ marginLeft: 6, color: 'var(--text-3)' }}>({tasks.length})</span>
                    </div>
                    {tasks.map(t => (
                      <div key={t.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '4px 0', fontSize: 12,
                      }}>
                        <span style={{
                          fontSize: 10,
                          color: t.complexity === 'complex' ? 'var(--danger)' : 'var(--success)',
                        }}>
                          {t.complexity === 'complex' ? '◆' : '●'}
                        </span>
                        <span style={{ flex: 1, color: 'var(--text)' }}>{t.title}</span>
                        {t.estimatedHours && (
                          <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                            {t.estimatedHours}h
                          </span>
                        )}
                        {Array.isArray(t.dependsOn) && t.dependsOn.length > 0 && (
                          <span style={{
                            fontSize: 9, padding: '1px 5px', borderRadius: 999,
                            background: 'var(--info-soft)', color: 'var(--info)',
                            fontFamily: 'var(--font-mono)',
                          }}>⇠ {t.dependsOn.length}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 8, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            Les tâches du workflow seront <strong>ajoutées</strong> au projet (les existantes ne sont pas touchées).
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={apply}
              disabled={!selected || applying || (selected.tasks || []).length === 0}
            >
              {applying
                ? 'Application…'
                : selected
                  ? `Appliquer (${(selected.tasks || []).length} tâches)`
                  : 'Sélectionner un workflow'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
