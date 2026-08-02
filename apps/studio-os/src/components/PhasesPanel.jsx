'use client';
/**
 * PhasesPanel — gestion des production_phases d'un projet.
 * Liste les phases avec couleur, nom, dates, nb tâches associées.
 * CRUD inline + couleur cliquable + drag pour réordonner.
 *
 * Props :
 *   projectId : id du projet
 *   phases : array de production_phases [{id, name, color, startDate, endDate, sortOrder}]
 *   tasks : array des tâches du projet (pour compter par phase via phase_group matching)
 *   onChange : appelé après création/édition/suppression — pour recharger côté parent
 */
import { useState } from 'react';
import { Card, Button, SectionTitle, EmptyState, useToast, useConfirm } from '@/components/ui';

const PHASE_COLORS = [
  '#C46B3D', // terracotta
  '#B07A0E', // or-safran
  '#2670B4', // studio blue
  '#8347A1', // prod purple
  '#1E8449', // success green
  '#C9821C', // warning amber
  '#B83328', // danger red
  '#5C5246', // brown
];

export default function PhasesPanel({ projectId, phases = [], tasks = [], onChange }) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');

  const sortedPhases = [...phases].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const tasksCountFor = (phaseName) =>
    tasks.filter(t => (t.phaseGroup || '') === phaseName).length;

  const taskHoursFor = (phaseName) =>
    tasks.filter(t => (t.phaseGroup || '') === phaseName)
      .reduce((s, t) => s + (Number(t.estimatedHours) || 0), 0);

  const tasksDoneFor = (phaseName) =>
    tasks.filter(t => (t.phaseGroup || '') === phaseName && t.status === 'done').length;

  const createPhase = async () => {
    const name = draftName.trim();
    if (!name) return;
    const color = PHASE_COLORS[sortedPhases.length % PHASE_COLORS.length];
    try {
      const r = await fetch('/api/phases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId, name, color,
          sortOrder: sortedPhases.length,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success(`Phase "${name}" créée`);
      setDraftName('');
      setAdding(false);
      if (onChange) onChange();
    } catch (e) {
      toast.error(`Échec : ${e.message}`);
    }
  };

  const updatePhase = async (phaseId, patch) => {
    try {
      const r = await fetch(`/api/phases/${phaseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (onChange) onChange();
    } catch (e) {
      toast.error(`Échec : ${e.message}`);
    }
  };

  const deletePhase = async (phaseId, name) => {
    if (!(await confirm({ title: `Supprimer la phase "${name}" ?`, message: 'Les tâches associées seront conservées (mais sans phase).', confirmLabel: 'Supprimer' }))) return;
    try {
      const r = await fetch(`/api/phases/${phaseId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success('Phase supprimée');
      if (onChange) onChange();
    } catch (e) {
      toast.error(`Échec : ${e.message}`);
    }
  };

  const totalTasks = tasks.length;
  const tasksInPhases = sortedPhases.reduce((s, p) => s + tasksCountFor(p.name), 0);
  const orphanTasks = totalTasks - tasksInPhases;

  return (
    <Card>
      <SectionTitle
        title="Phases du projet"
        level="h2"
        subtitle={`${sortedPhases.length} phase${sortedPhases.length > 1 ? 's' : ''} · ${tasksInPhases}/${totalTasks} tâches assignées`}
        right={
          adding ? null : (
            <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
              + Phase
            </Button>
          )
        }
      />

      {/* Add new phase form */}
      {adding && (
        <div style={{
          display: 'flex', gap: 6, marginBottom: 12,
          padding: 10, background: 'var(--surface-2)',
          border: '1px solid var(--gold)',
          borderRadius: 'var(--radius-md)',
        }}>
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createPhase();
              if (e.key === 'Escape') { setAdding(false); setDraftName(''); }
            }}
            placeholder="Nom de la phase (ex. Pré-production)"
            autoFocus
            style={{
              flex: 1, padding: '6px 10px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text)',
              fontSize: 13, outline: 'none', fontFamily: 'var(--font-sans)',
            }}
          />
          <Button size="sm" variant="primary" onClick={createPhase} disabled={!draftName.trim()}>
            Créer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setDraftName(''); }}>
            Annuler
          </Button>
        </div>
      )}

      {sortedPhases.length === 0 ? (
        !adding && (
          <EmptyState
            icon="◌"
            title="Aucune phase définie"
            message="Crée des phases pour organiser les tâches du projet (ex. Pré-production / Production / Post-production)."
          />
        )
      ) : (
        sortedPhases.map((phase, i) => {
          const phaseTasks = tasks.filter(t => (t.phaseGroup || '') === phase.name);
          return (
            <PhaseRow
              key={phase.id}
              phase={phase}
              tasksInPhase={phaseTasks}
              tasksCount={tasksCountFor(phase.name)}
              tasksDone={tasksDoneFor(phase.name)}
              estimatedHours={taskHoursFor(phase.name)}
              onUpdate={(patch) => updatePhase(phase.id, patch)}
              onDelete={() => deletePhase(phase.id, phase.name)}
              isFirst={i === 0}
              isLast={i === sortedPhases.length - 1}
              onMoveUp={() => updatePhase(phase.id, { sortOrder: phase.sortOrder - 1 }).then(() => {
                const prev = sortedPhases[i - 1];
                if (prev) updatePhase(prev.id, { sortOrder: prev.sortOrder + 1 });
              })}
              onMoveDown={() => updatePhase(phase.id, { sortOrder: phase.sortOrder + 1 }).then(() => {
                const next = sortedPhases[i + 1];
                if (next) updatePhase(next.id, { sortOrder: next.sortOrder - 1 });
              })}
            />
          );
        })
      )}

      {/* Tâches orphelines (sans phase) */}
      {orphanTasks > 0 && sortedPhases.length > 0 && (
        <div style={{
          marginTop: 12, padding: '8px 12px',
          background: 'var(--surface-2)',
          borderLeft: '3px solid var(--text-3)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 11, color: 'var(--text-2)',
        }}>
          <strong style={{ color: 'var(--text)' }}>{orphanTasks}</strong> tâche{orphanTasks > 1 ? 's' : ''}
          {' '}sans phase assignée — à organiser en éditant le champ "phase" de chaque tâche.
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// PhaseRow — une phase avec édition inline + tâches dépliées dessous
// ─────────────────────────────────────────────────────────
const TASK_STATUS_COLOR = {
  todo:        'var(--text-3)',
  in_progress: 'var(--info)',
  review:      'var(--warning)',
  done:        'var(--success)',
};

function PhaseRow({ phase, tasksInPhase = [], tasksCount, tasksDone, estimatedHours, onUpdate, onDelete, isFirst, isLast, onMoveUp, onMoveDown }) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(phase.name);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [hover, setHover] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const progress = tasksCount > 0 ? Math.round((tasksDone / tasksCount) * 100) : 0;

  const saveName = () => {
    if (nameDraft.trim() && nameDraft !== phase.name) {
      onUpdate({ name: nameDraft.trim() });
    }
    setEditingName(false);
  };

  const setColor = (color) => {
    onUpdate({ color });
    setShowColorPicker(false);
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderBottom: '1px solid var(--border)',
        position: 'relative',
      }}
    >
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 0',
    }}>
      {/* Color stripe + picker */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setShowColorPicker(s => !s)}
          title="Changer la couleur"
          style={{
            width: 4, height: 36, borderRadius: 2,
            background: phase.color || '#C46B3D',
            border: 'none', cursor: 'pointer', padding: 0,
            transition: 'transform var(--duration) var(--ease)',
            transform: hover ? 'scaleX(1.5)' : 'scaleX(1)',
          }}
        />
        {showColorPicker && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)',
            padding: 6, zIndex: 10,
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4,
          }}>
            {PHASE_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: c, border: phase.color === c ? '2px solid var(--text)' : '1px solid var(--border)',
                  cursor: 'pointer', padding: 0,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Name (editable) */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {editingName ? (
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveName();
              if (e.key === 'Escape') { setNameDraft(phase.name); setEditingName(false); }
            }}
            autoFocus
            style={{
              width: '100%', padding: '4px 6px',
              background: 'var(--surface-2)',
              border: '1px solid var(--gold)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)', fontSize: 14, fontWeight: 500,
              outline: 'none', fontFamily: 'var(--font-sans)',
            }}
          />
        ) : (
          <button
            onClick={() => { setNameDraft(phase.name); setEditingName(true); }}
            style={{
              background: 'transparent', border: 'none', padding: 0,
              cursor: 'pointer', textAlign: 'left',
              fontSize: 14, fontWeight: 500, color: 'var(--text)',
              fontFamily: 'var(--font-sans)',
            }}
            title="Cliquer pour renommer"
          >
            {phase.name}
          </button>
        )}

        {/* Stats sous le nom */}
        <div style={{
          display: 'flex', gap: 12, marginTop: 4,
          fontSize: 11, color: 'var(--text-3)',
          fontFamily: 'var(--font-mono)',
        }}>
          <span>
            <strong style={{ color: 'var(--text-2)' }}>{tasksCount}</strong> tâche{tasksCount > 1 ? 's' : ''}
            {tasksDone > 0 && <span> · {tasksDone} done</span>}
          </span>
          {estimatedHours > 0 && (
            <span>{estimatedHours}h estimées</span>
          )}
        </div>

        {/* Barre de progression */}
        {tasksCount > 0 && (
          <div style={{
            marginTop: 6, height: 3, background: 'var(--surface-2)',
            borderRadius: 2, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: phase.color || 'var(--gold)',
              transition: 'width var(--duration-slow) var(--ease-out)',
            }} />
          </div>
        )}
      </div>

      {/* Dates */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
        <input
          type="date"
          value={phase.startDate || ''}
          onChange={(e) => onUpdate({ startDate: e.target.value })}
          title="Date de début"
          style={{
            padding: '2px 4px', fontSize: 10,
            background: 'transparent',
            border: '1px solid transparent',
            color: phase.startDate ? 'var(--text-2)' : 'var(--text-3)',
            fontFamily: 'var(--font-mono)', outline: 'none', borderRadius: 4,
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
        />
        <input
          type="date"
          value={phase.endDate || ''}
          onChange={(e) => onUpdate({ endDate: e.target.value })}
          title="Date de fin"
          style={{
            padding: '2px 4px', fontSize: 10,
            background: 'transparent',
            border: '1px solid transparent',
            color: phase.endDate ? 'var(--text-2)' : 'var(--text-3)',
            fontFamily: 'var(--font-mono)', outline: 'none', borderRadius: 4,
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
        />
      </div>

      {/* Actions (au hover) */}
      <div style={{
        display: 'flex', gap: 2, opacity: hover ? 1 : 0,
        transition: 'opacity var(--duration) var(--ease)',
      }}>
        <IconBtn onClick={onMoveUp} disabled={isFirst} title="Monter">↑</IconBtn>
        <IconBtn onClick={onMoveDown} disabled={isLast} title="Descendre">↓</IconBtn>
        <IconBtn onClick={onDelete} title="Supprimer" danger>×</IconBtn>
      </div>

      {/* Chevron pour déplier/replier les tâches */}
      {tasksInPhase.length > 0 && (
        <button
          onClick={() => setExpanded(e => !e)}
          title={expanded ? 'Replier les tâches' : 'Déplier les tâches'}
          style={{
            width: 22, height: 22, borderRadius: 'var(--radius-sm)',
            background: 'transparent', border: '1px solid transparent',
            cursor: 'pointer', color: 'var(--text-3)',
            fontSize: 11, lineHeight: 1, padding: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform var(--duration) var(--ease)',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >▸</button>
      )}
    </div>

    {/* Tâches dépliées (style modal apply workflow) */}
    {expanded && tasksInPhase.length > 0 && (
      <div style={{
        paddingLeft: 18, paddingBottom: 12,
        marginLeft: 4, borderLeft: `2px solid ${phase.color || 'var(--border)'}`,
        opacity: 0.95,
      }}>
        {tasksInPhase
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
          .map(t => {
            const isComplex = t.complexity === 'complex';
            const statusColor = TASK_STATUS_COLOR[t.status] || 'var(--text-3)';
            const deps = Array.isArray(t.dependsOn) ? t.dependsOn : [];
            return (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 8px', fontSize: 12,
                color: t.status === 'done' ? 'var(--text-3)' : 'var(--text)',
                textDecoration: t.status === 'done' ? 'line-through' : 'none',
              }}>
                <span style={{
                  fontSize: 11,
                  color: isComplex ? 'var(--danger)' : 'var(--success)',
                  flexShrink: 0,
                }}>
                  {isComplex ? '◆' : '●'}
                </span>
                <span style={{
                  flex: 1, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {t.title}
                </span>
                {t.assigneeName && (
                  <span style={{
                    fontSize: 10, color: 'var(--text-3)',
                    fontFamily: 'var(--font-sans)',
                  }}>{t.assigneeName}</span>
                )}
                {t.estimatedHours && (
                  <span style={{
                    fontSize: 10, color: 'var(--text-3)',
                    fontFamily: 'var(--font-mono)',
                  }}>{t.estimatedHours}h</span>
                )}
                {deps.length > 0 && (
                  <span title={`${deps.length} dépendance${deps.length > 1 ? 's' : ''}`} style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 999,
                    background: 'var(--info-soft)', color: 'var(--info)',
                    fontFamily: 'var(--font-mono)',
                  }}>⇠ {deps.length}</span>
                )}
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: statusColor, flexShrink: 0,
                }} title={t.status} />
              </div>
            );
          })}
      </div>
    )}
    </div>
  );
}

function IconBtn({ children, onClick, disabled, title, danger }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 22, height: 22, borderRadius: 'var(--radius-sm)',
        background: 'transparent', border: '1px solid transparent',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'var(--text-3)' : danger ? 'var(--danger)' : 'var(--text-2)',
        fontSize: 12, lineHeight: 1, padding: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.3 : 1,
        transition: 'background var(--duration) var(--ease)',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = danger ? 'var(--danger-soft)' : 'var(--surface-2)'; }}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </button>
  );
}
