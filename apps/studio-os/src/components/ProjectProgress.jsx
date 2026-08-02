'use client';
/**
 * ProjectProgress — barre de progression globale d'un projet.
 *
 * Segmentée par phase : chaque segment a une largeur proportionnelle au nb de
 * tâches de la phase, avec un remplissage selon % done. Couleur = couleur de
 * la phase.
 *
 * Props :
 *   phases : array { id, name, color, sortOrder }
 *   tasks  : array { phaseGroup, status }
 *   compact : version mini (10px) sans labels
 */

export default function ProjectProgress({ phases = [], tasks = [], compact = false }) {
  const totalTasks = tasks.length;
  const tasksDone = tasks.filter(t => t.status === 'done').length;
  const globalPct = totalTasks > 0 ? Math.round((tasksDone / totalTasks) * 100) : 0;

  const sortedPhases = [...phases].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  // Construire les segments :
  // - 1 segment par phase ayant des tâches
  // - 1 segment "orphelines" si tâches sans phase
  const segments = [];
  let attachedTasks = 0;
  for (const ph of sortedPhases) {
    const phTasks = tasks.filter(t => (t.phaseGroup || '') === ph.name);
    if (phTasks.length === 0) continue;
    const done = phTasks.filter(t => t.status === 'done').length;
    segments.push({
      key: ph.id,
      name: ph.name,
      color: ph.color || 'var(--gold)',
      total: phTasks.length,
      done,
    });
    attachedTasks += phTasks.length;
  }
  const orphanCount = totalTasks - attachedTasks;
  if (orphanCount > 0) {
    const orphanDone = tasks.filter(t => !(t.phaseGroup || '') && t.status === 'done').length;
    segments.push({
      key: '__orphan__',
      name: 'Sans phase',
      color: 'var(--text-3)',
      total: orphanCount,
      done: orphanDone,
    });
  }

  if (totalTasks === 0) {
    return (
      <div style={{
        fontSize: 11, color: 'var(--text-3)',
        fontFamily: 'var(--font-mono)', fontStyle: 'italic',
      }}>
        Aucune tâche · pas de progression à afficher
      </div>
    );
  }

  const barHeight = compact ? 6 : 12;

  return (
    <div>
      {/* Header avec % global */}
      {!compact && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: 6, gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{
              fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6,
              color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
            }}>
              Progression
            </span>
            <span style={{
              fontSize: 18, fontWeight: 600,
              color: globalPct === 100 ? 'var(--success)' : 'var(--text)',
              fontFamily: 'var(--font-mono)', lineHeight: 1,
              letterSpacing: -0.5,
            }}>
              {globalPct}%
            </span>
          </div>
          <span style={{
            fontSize: 11, color: 'var(--text-3)',
            fontFamily: 'var(--font-mono)',
          }}>
            {tasksDone}/{totalTasks} tâche{totalTasks > 1 ? 's' : ''} terminée{tasksDone > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Barre segmentée */}
      <div style={{
        display: 'flex',
        height: barHeight,
        background: 'var(--surface-2)',
        borderRadius: barHeight / 2,
        overflow: 'hidden',
        gap: 2,
      }}>
        {segments.map(seg => {
          const pct = totalTasks > 0 ? (seg.total / totalTasks) * 100 : 0;
          const fillPct = seg.total > 0 ? (seg.done / seg.total) * 100 : 0;
          return (
            <div
              key={seg.key}
              title={`${seg.name} · ${seg.done}/${seg.total} done (${Math.round(fillPct)}%)`}
              style={{
                width: `${pct}%`,
                position: 'relative',
                background: `color-mix(in srgb, ${seg.color} 18%, transparent)`,
                overflow: 'hidden',
                transition: 'all var(--duration-slow) var(--ease-out)',
                minWidth: 4,
              }}
            >
              <div style={{
                width: `${fillPct}%`,
                height: '100%',
                background: seg.color,
                transition: 'width var(--duration-slow) var(--ease-out)',
              }} />
            </div>
          );
        })}
      </div>

      {/* Labels segments (non compact) */}
      {!compact && segments.length > 0 && (
        <div style={{
          display: 'flex', gap: 12, marginTop: 8,
          fontSize: 10, fontFamily: 'var(--font-mono)',
          color: 'var(--text-3)',
          flexWrap: 'wrap',
        }}>
          {segments.map(seg => (
            <span key={seg.key} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              opacity: seg.total > 0 ? 1 : 0.5,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: 2,
                background: seg.color, flexShrink: 0,
              }} />
              <span style={{
                color: seg.done === seg.total ? seg.color : 'var(--text-3)',
                fontWeight: seg.done === seg.total ? 600 : 400,
              }}>
                {seg.name} · {seg.done}/{seg.total}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
