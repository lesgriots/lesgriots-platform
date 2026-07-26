'use client';
/**
 * PhasesGantt — vue calendrier inline (Gantt simple) des phases d'un projet.
 *
 * Une barre horizontale par phase, positionnée selon start_date / end_date.
 * Échelle automatique : 7-14j → jours, 14-90j → semaines, >90j → mois.
 * Tâches associées affichées comme petits dots colorés selon status, alignés sur leur due_date.
 *
 * Props :
 *   phases : array of { id, name, color, startDate, endDate, sortOrder }
 *   tasks  : array of { id, title, status, phase_group, due_date, complexity }
 *   project : { startDate, endDate } pour fallback échelle
 */
import { useMemo, useState } from 'react';

const STATUS_COLOR = {
  todo:        'var(--text-3)',
  in_progress: 'var(--info)',
  review:      'var(--warning)',
  done:        'var(--success)',
};

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 28;
const LABEL_WIDTH = 160;
const PADDING = 12;

function parseDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatTickLabel(d, granularity) {
  if (granularity === 'day') {
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  if (granularity === 'week') {
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

export default function PhasesGantt({ phases = [], tasks = [], project = {} }) {
  const sorted = useMemo(
    () => [...phases].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    [phases]
  );

  // Calcul de l'échelle (min start / max end)
  const range = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let min = null, max = null;
    for (const ph of sorted) {
      const s = parseDate(ph.startDate);
      const e = parseDate(ph.endDate);
      if (s && (!min || s < min)) min = s;
      if (e && (!max || e > max)) max = e;
    }
    // Fallback : utiliser les dates du projet
    if (!min) min = parseDate(project.startDate) || today;
    if (!max) max = parseDate(project.endDate) || addDays(today, 30);
    if (max <= min) max = addDays(min, 30);
    // Padding visuel
    min = addDays(min, -3);
    max = addDays(max, 3);
    return { min, max, today };
  }, [sorted, project.startDate, project.endDate]);

  const totalDays = useMemo(() => daysBetween(range.min, range.max), [range]);
  const granularity = totalDays <= 14 ? 'day' : totalDays <= 90 ? 'week' : 'month';

  // Largeur dynamique : on calcule pour fit dans 100% mais on garde un min
  const [containerWidth, setContainerWidth] = useState(900);
  const chartWidth = Math.max(600, containerWidth - LABEL_WIDTH - PADDING * 2);
  const pxPerDay = chartWidth / totalDays;
  const xOf = (d) => daysBetween(range.min, d) * pxPerDay;
  const widthOf = (s, e) => Math.max(2, daysBetween(s, e) * pxPerDay);

  // Ticks pour l'axe temporel
  const ticks = useMemo(() => {
    const result = [];
    let cur = new Date(range.min);
    cur.setHours(0, 0, 0, 0);
    // Aligner sur lundi pour weeks, sur 1er jour du mois pour months
    if (granularity === 'week') {
      const day = cur.getDay() || 7;
      if (day !== 1) cur = addDays(cur, (8 - day) % 7);
    } else if (granularity === 'month') {
      cur = new Date(cur.getFullYear(), cur.getMonth() + (cur.getDate() === 1 ? 0 : 1), 1);
    }
    const step = granularity === 'day' ? 1 : granularity === 'week' ? 7 : 30;
    let safety = 0;
    while (cur < range.max && safety < 60) {
      result.push(new Date(cur));
      if (granularity === 'month') {
        cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      } else {
        cur = addDays(cur, step);
      }
      safety += 1;
    }
    return result;
  }, [range, granularity]);

  const totalHeight = HEADER_HEIGHT + sorted.length * ROW_HEIGHT + 20;
  const hasNoPhases = sorted.length === 0;

  // Resize observer pour le SVG
  const containerRef = (el) => {
    if (!el) return;
    const w = el.getBoundingClientRect().width;
    if (Math.abs(w - containerWidth) > 1) setContainerWidth(w);
  };

  if (hasNoPhases) {
    return (
      <div style={{
        padding: '32px 16px', textAlign: 'center',
        color: 'var(--text-3)', fontSize: 13, fontStyle: 'italic',
        border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)',
      }}>
        Aucune phase pour le moment. Crée des phases pour voir le calendrier.
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: '100%', overflowX: 'auto', position: 'relative' }}>
      <svg
        width={LABEL_WIDTH + chartWidth + PADDING * 2}
        height={totalHeight}
        style={{ display: 'block' }}
      >
        {/* Background subtle stripes for rows */}
        {sorted.map((_, i) => (
          <rect
            key={i}
            x={LABEL_WIDTH}
            y={HEADER_HEIGHT + i * ROW_HEIGHT}
            width={chartWidth + PADDING}
            height={ROW_HEIGHT}
            fill={i % 2 === 0 ? 'transparent' : 'var(--surface-2)'}
            opacity={0.4}
          />
        ))}

        {/* Header : ticks */}
        {ticks.map((t, i) => {
          const x = LABEL_WIDTH + xOf(t);
          return (
            <g key={i}>
              <line
                x1={x} y1={HEADER_HEIGHT - 6}
                x2={x} y2={totalHeight - 10}
                stroke="var(--border)" strokeWidth={0.5}
                strokeDasharray={granularity === 'day' ? '0' : '2,2'}
              />
              <text
                x={x + 4} y={HEADER_HEIGHT - 10}
                fontSize={10} fontFamily="var(--font-mono)"
                fill="var(--text-3)"
              >
                {formatTickLabel(t, granularity)}
              </text>
            </g>
          );
        })}

        {/* Today line */}
        {range.today >= range.min && range.today <= range.max && (
          <g>
            <line
              x1={LABEL_WIDTH + xOf(range.today)}
              y1={HEADER_HEIGHT - 6}
              x2={LABEL_WIDTH + xOf(range.today)}
              y2={totalHeight - 10}
              stroke="var(--gold)" strokeWidth={1.5}
              strokeDasharray="4,3"
            />
            <text
              x={LABEL_WIDTH + xOf(range.today) + 4}
              y={HEADER_HEIGHT - 14}
              fontSize={9} fontFamily="var(--font-mono)"
              fill="var(--gold)"
              fontWeight={600}
            >
              today
            </text>
          </g>
        )}

        {/* Lignes des phases */}
        {sorted.map((phase, i) => {
          const y = HEADER_HEIGHT + i * ROW_HEIGHT + 8;
          const barHeight = ROW_HEIGHT - 16;
          const s = parseDate(phase.startDate);
          const e = parseDate(phase.endDate);
          const hasDates = s && e;
          const phaseTasks = tasks.filter(t => (t.phaseGroup || t.phase_group) === phase.name);

          return (
            <g key={phase.id}>
              {/* Label de la phase à gauche */}
              <foreignObject
                x={0} y={y - 6}
                width={LABEL_WIDTH - PADDING} height={barHeight + 12}
              >
                <div style={{
                  fontSize: 11, color: 'var(--text)',
                  fontWeight: 500, lineHeight: 1.3,
                  fontFamily: 'var(--font-sans)',
                  display: 'flex', alignItems: 'center', gap: 6,
                  height: '100%',
                }}>
                  <span style={{
                    width: 3, height: barHeight, borderRadius: 2,
                    background: phase.color || 'var(--gold)',
                    display: 'inline-block',
                    flexShrink: 0,
                  }} />
                  <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>{phase.name}</span>
                </div>
              </foreignObject>

              {/* Barre Gantt */}
              {hasDates ? (
                <PhaseBar
                  phase={phase}
                  x={LABEL_WIDTH + xOf(s)}
                  y={y}
                  width={widthOf(s, e)}
                  height={barHeight}
                  tasks={phaseTasks}
                />
              ) : (
                <foreignObject
                  x={LABEL_WIDTH + 4} y={y + 2}
                  width={200} height={barHeight - 4}
                >
                  <div style={{
                    fontSize: 10, color: 'var(--text-3)',
                    fontStyle: 'italic', fontFamily: 'var(--font-sans)',
                  }}>
                    (Pas de dates définies)
                  </div>
                </foreignObject>
              )}

              {/* Tâches : petits dots sur la timeline */}
              {hasDates && phaseTasks.map(t => {
                const due = parseDate(t.dueDate || t.due_date);
                if (!due || due < range.min || due > range.max) return null;
                const dotX = LABEL_WIDTH + xOf(due);
                const dotY = y + barHeight + 4;
                return (
                  <circle
                    key={t.id}
                    cx={dotX} cy={dotY}
                    r={3}
                    fill={STATUS_COLOR[t.status] || 'var(--text-3)'}
                    stroke="var(--surface)"
                    strokeWidth={1}
                  >
                    <title>{t.title} · {t.status} · {t.dueDate || t.due_date}</title>
                  </circle>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Légende */}
      <div style={{
        display: 'flex', gap: 16, marginTop: 12, fontSize: 10,
        color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
        textTransform: 'uppercase', letterSpacing: 0.6,
        flexWrap: 'wrap',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 16, height: 4, borderRadius: 2, background: 'var(--gold)' }} /> aujourd'hui
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: STATUS_COLOR.todo, border: '1px solid var(--surface)' }} /> à faire
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: STATUS_COLOR.in_progress }} /> en cours
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: STATUS_COLOR.review }} /> review
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: STATUS_COLOR.done }} /> done
        </span>
        <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>
          {granularity === 'day' ? 'échelle jours' : granularity === 'week' ? 'échelle semaines' : 'échelle mois'}
        </span>
      </div>
    </div>
  );
}

function PhaseBar({ phase, x, y, width, height, tasks }) {
  const tasksDone = tasks.filter(t => t.status === 'done').length;
  const progress = tasks.length > 0 ? tasksDone / tasks.length : 0;

  return (
    <g>
      {/* Barre globale (background) */}
      <rect
        x={x} y={y}
        width={width} height={height}
        rx={4} ry={4}
        fill={phase.color || 'var(--gold)'}
        opacity={0.18}
      />
      {/* Barre de progression */}
      {progress > 0 && (
        <rect
          x={x} y={y}
          width={width * progress} height={height}
          rx={4} ry={4}
          fill={phase.color || 'var(--gold)'}
          opacity={0.85}
        />
      )}
      {/* Bordure */}
      <rect
        x={x + 0.5} y={y + 0.5}
        width={Math.max(0, width - 1)} height={Math.max(0, height - 1)}
        rx={4} ry={4}
        fill="none"
        stroke={phase.color || 'var(--gold)'}
        strokeWidth={1}
      />

      {/* Tooltip natif via <title> */}
      <title>
        {phase.name}
        {phase.startDate && phase.endDate ? `\n${phase.startDate} → ${phase.endDate}` : ''}
        {tasks.length > 0 ? `\n${tasks.length} tâche${tasks.length > 1 ? 's' : ''} · ${tasksDone} done (${Math.round(progress * 100)}%)` : ''}
      </title>

      {/* Label dans la barre si assez large */}
      {width > 80 && (
        <foreignObject x={x + 6} y={y + (height - 14) / 2} width={Math.max(0, width - 12)} height={14}>
          <div style={{
            fontSize: 10, color: phase.color || 'var(--text)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            mixBlendMode: 'multiply',
          }}>
            {tasks.length > 0 ? `${tasksDone}/${tasks.length}` : '·'}
          </div>
        </foreignObject>
      )}
    </g>
  );
}
