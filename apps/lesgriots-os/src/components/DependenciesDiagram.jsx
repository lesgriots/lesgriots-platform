'use client';
/**
 * DependenciesDiagram — visualisation des dépendances de tâches en colonnes par tier.
 * Inspiré de PPM/The Futur "Contingent / Waterfall tasks".
 *
 * Algo :
 *   - Tier 0 : tâches sans dépendance
 *   - Tier N : tâches dont toutes les dépendances sont dans tier < N
 *   - Cycles : détectés et regroupés à part
 *
 * Props :
 *   tasks : array (chaque task a id, title, status, complexity, dependsOn[])
 */

const STATUS_COLOR = {
  todo:        { bg: 'var(--surface-2)', border: 'var(--border-2)', text: 'var(--text-2)' },
  in_progress: { bg: 'var(--info-soft)', border: 'var(--info)',     text: 'var(--info)' },
  review:      { bg: 'var(--warning-soft)', border: 'var(--warning)', text: 'var(--warning)' },
  done:        { bg: 'var(--success-soft)', border: 'var(--success)', text: 'var(--success)' },
};

function computeTiers(tasks) {
  const byId = Object.fromEntries(tasks.map(t => [t.id, t]));
  const tier = {};
  const visited = new Set();
  const visiting = new Set();
  const cycles = [];

  function resolve(id) {
    if (tier[id] !== undefined) return tier[id];
    if (visiting.has(id)) {
      cycles.push(id);
      return 0;
    }
    visiting.add(id);
    const task = byId[id];
    if (!task) { visiting.delete(id); return 0; }
    const deps = Array.isArray(task.dependsOn) ? task.dependsOn : [];
    const validDeps = deps.filter(d => byId[d]);
    if (validDeps.length === 0) {
      tier[id] = 0;
    } else {
      let max = 0;
      for (const d of validDeps) {
        const t = resolve(d);
        if (t + 1 > max) max = t + 1;
      }
      tier[id] = max;
    }
    visiting.delete(id);
    visited.add(id);
    return tier[id];
  }

  for (const t of tasks) resolve(t.id);

  const maxTier = Object.values(tier).reduce((m, v) => Math.max(m, v), 0);
  const columns = [];
  for (let i = 0; i <= maxTier; i++) {
    columns.push(tasks.filter(t => tier[t.id] === i));
  }
  return { columns, cycles: [...new Set(cycles)] };
}

function whatBlocks(taskId, allTasks) {
  // qui dépend de cette tâche (= cette tâche les débloque quand elle finit)
  return allTasks.filter(t =>
    Array.isArray(t.dependsOn) && t.dependsOn.includes(taskId)
  );
}

export default function DependenciesDiagram({ tasks = [] }) {
  if (!tasks.length) return null;

  const { columns, cycles } = computeTiers(tasks);
  const hasAnyDependency = tasks.some(t =>
    Array.isArray(t.dependsOn) && t.dependsOn.length > 0
  );

  if (!hasAnyDependency) {
    return (
      <div style={{
        padding: '20px 16px', textAlign: 'center',
        color: 'var(--text-3)', fontSize: 12, fontStyle: 'italic',
        border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)',
      }}>
        Aucune dépendance définie entre les tâches.
        <br />
        Ajoute des dépendances depuis chaque tâche (bouton <code>⇠ N</code>) pour visualiser le flow.
      </div>
    );
  }

  return (
    <div>
      {/* Légende */}
      <div style={{
        display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-3)',
        fontFamily: 'var(--font-mono)', marginBottom: 16,
        flexWrap: 'wrap',
      }}>
        <LegendItem color="var(--success)" label="Done" />
        <LegendItem color="var(--info)" label="En cours" />
        <LegendItem color="var(--warning)" label="Review" />
        <LegendItem color="var(--text-2)" label="À faire" />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <span>◆ complex</span>
          <span>● simple</span>
        </div>
      </div>

      {/* Colonnes par tier */}
      <div style={{
        display: 'flex', gap: 16, alignItems: 'flex-start',
        overflowX: 'auto', paddingBottom: 12,
      }}>
        {columns.map((tasksInTier, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            minWidth: 200,
            position: 'relative',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 10, color: 'var(--text-3)',
              fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
              letterSpacing: 0.6, marginBottom: 4,
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: 9,
                background: 'var(--gold)', color: 'var(--surface)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 600,
              }}>{i + 1}</span>
              {i === 0 ? 'Démarre' : `Après tier ${i}`}
              <span style={{
                padding: '1px 6px', borderRadius: 999,
                background: 'var(--surface-2)', color: 'var(--text-3)',
                fontFamily: 'var(--font-mono)',
              }}>{tasksInTier.length}</span>
            </div>

            {tasksInTier.map(t => {
              const status = STATUS_COLOR[t.status] || STATUS_COLOR.todo;
              const isComplex = t.complexity === 'complex';
              const blocks = whatBlocks(t.id, tasks);
              const deps = Array.isArray(t.dependsOn) ? t.dependsOn.filter(d => tasks.some(x => x.id === d)) : [];

              return (
                <div key={t.id} style={{
                  background: status.bg,
                  border: '1px solid ' + status.border,
                  borderLeft: `3px solid ${isComplex ? 'var(--danger)' : 'var(--success)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 10px',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'flex-start',
                    gap: 6, justifyContent: 'space-between',
                  }}>
                    <span style={{
                      fontSize: 12, fontWeight: 500,
                      color: t.status === 'done' ? 'var(--text-3)' : 'var(--text)',
                      textDecoration: t.status === 'done' ? 'line-through' : 'none',
                      lineHeight: 1.4,
                    }}>
                      {t.title}
                    </span>
                    <span style={{
                      fontSize: 10, color: isComplex ? 'var(--danger)' : 'var(--success)',
                      flexShrink: 0,
                    }}>
                      {isComplex ? '◆' : '●'}
                    </span>
                  </div>

                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 10, fontFamily: 'var(--font-mono)',
                    color: 'var(--text-3)',
                  }}>
                    {deps.length > 0 ? (
                      <span title={`Dépend de ${deps.length} tâche${deps.length > 1 ? 's' : ''}`}>
                        ⇠ {deps.length}
                      </span>
                    ) : <span />}
                    {blocks.length > 0 && (
                      <span
                        title={`Débloque : ${blocks.map(b => b.title).join(', ')}`}
                        style={{ color: 'var(--gold)' }}
                      >
                        {blocks.length} ⇢
                      </span>
                    )}
                    {t.estimatedHours ? (
                      <span style={{ marginLeft: 'auto' }}>
                        {t.estimatedHours}h
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Cycles détectés (rare) */}
      {cycles.length > 0 && (
        <div style={{
          marginTop: 16, padding: '10px 12px',
          background: 'var(--danger-soft)', color: 'var(--danger)',
          border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)',
          fontSize: 11,
        }}>
          ⚠ Cycle de dépendances détecté ({cycles.length} tâche{cycles.length > 1 ? 's' : ''}) — un cycle empêche tout démarrage.
        </div>
      )}

      {/* Stats globales */}
      <div style={{
        marginTop: 16, paddingTop: 12,
        borderTop: '1px solid var(--border)',
        display: 'flex', gap: 24, flexWrap: 'wrap',
        fontSize: 11, color: 'var(--text-2)',
        fontFamily: 'var(--font-mono)',
      }}>
        <Stat label="Tiers" value={columns.length} hint={`${columns.length} étape${columns.length > 1 ? 's' : ''} séquentielle${columns.length > 1 ? 's' : ''}`} />
        <Stat label="Tier max (parallèle)" value={Math.max(...columns.map(c => c.length))} hint="Tâches en parallèle max" />
        <Stat label="Heures estimées" value={(() => {
          const total = tasks.reduce((s, t) => s + (Number(t.estimatedHours) || 0), 0);
          return total ? `${total}h` : '—';
        })()} hint="Somme des estimations" />
        <Stat label="Chemin critique (h)" value={(() => {
          // Le chemin critique : max somme heures par tier
          if (!tasks.some(t => t.estimatedHours)) return '—';
          const totals = columns.map(col =>
            col.reduce((s, t) => Math.max(s, Number(t.estimatedHours) || 0), 0)
          );
          return totals.reduce((s, v) => s + v, 0) + 'h';
        })()} hint="Si tout en parallèle dans chaque tier" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        width: 8, height: 8, borderRadius: 2,
        background: color, display: 'inline-block',
      }} />
      {label}
    </span>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div>
      <div style={{
        fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6,
        color: 'var(--text-3)', marginBottom: 2,
      }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
      {hint && (
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{hint}</div>
      )}
    </div>
  );
}
