'use client';
/**
 * CaHistoryChart — bar chart compact 6 mois pour Mission Control.
 * Stacked bars : encaissé (terracotta) + Griothèque (or-safran).
 * Hover tooltip avec total + ventilation.
 */
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fmt = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '8px 12px',
      fontSize: 11,
      fontFamily: 'var(--font-sans)',
      boxShadow: 'var(--shadow-md)',
      minWidth: 140,
    }}>
      <div style={{
        fontSize: 10, color: 'var(--text-3)',
        textTransform: 'uppercase', letterSpacing: 0.6,
        fontFamily: 'var(--font-mono)', marginBottom: 6,
      }}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 3 }}>
        <span style={{ color: 'var(--text-2)' }}>Encaissé</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--gold)', fontWeight: 500 }}>
          {fmt(data.encaissé)}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <span style={{ color: 'var(--text-2)' }}>Griothèque</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--saffron)', fontWeight: 500 }}>
          {fmt(data.griothèque)}
        </span>
      </div>
      <div style={{
        borderTop: '1px solid var(--border)',
        paddingTop: 4,
        display: 'flex', justifyContent: 'space-between', gap: 12,
      }}>
        <span style={{ color: 'var(--text)', fontWeight: 500 }}>Total</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 600 }}>
          {fmt(data.total)}
        </span>
      </div>
    </div>
  );
}

export default function CaHistoryChart({ data = [] }) {
  if (!data.length) return null;

  const maxTotal = Math.max(...data.map(d => d.total), 1);
  const isCurrentMonth = (label, idx) => idx === data.length - 1;

  return (
    <div style={{ width: '100%', height: 140 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--text-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide domain={[0, maxTotal * 1.15]} />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'var(--surface-2)' }}
          />
          <Bar dataKey="encaissé" stackId="a" radius={[0, 0, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={`enc-${i}`}
                fill={isCurrentMonth(entry.label, i) ? 'var(--gold)' : 'var(--gold-soft)'}
                stroke={isCurrentMonth(entry.label, i) ? 'none' : 'var(--gold)'}
                strokeWidth={isCurrentMonth(entry.label, i) ? 0 : 1}
              />
            ))}
          </Bar>
          <Bar dataKey="griothèque" stackId="a" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={`grio-${i}`}
                fill={isCurrentMonth(entry.label, i) ? 'var(--saffron)' : 'var(--saffron-soft)'}
                stroke={isCurrentMonth(entry.label, i) ? 'none' : 'var(--saffron)'}
                strokeWidth={isCurrentMonth(entry.label, i) ? 0 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
