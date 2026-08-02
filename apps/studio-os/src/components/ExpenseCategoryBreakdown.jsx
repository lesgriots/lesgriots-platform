'use client';
/**
 * ExpenseCategoryBreakdown — Mini-visualisation des dépenses projet par catégorie.
 *
 * Affiche :
 *   - Une barre horizontale segmentée (proportions par catégorie)
 *   - La liste des catégories avec total et % du budget projet
 *
 * Props :
 *   expenses : array { amount_ttc, category, status, ... }
 *   budget   : montant budget projet (optionnel) pour calculer le % consommé
 */
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_COLORS } from '@/lib/constants';

const fmt = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);

export default function ExpenseCategoryBreakdown({ expenses = [], budget = 0 }) {
  if (!expenses.length) return null;

  const total = expenses.reduce((s, e) => s + (Number(e.amount_ttc) || 0), 0);

  // Agrégation par catégorie
  const byCat = {};
  for (const e of expenses) {
    const cat = e.category || 'Autre';
    if (!byCat[cat]) byCat[cat] = { total: 0, count: 0, paid: 0 };
    byCat[cat].total += Number(e.amount_ttc) || 0;
    byCat[cat].count += 1;
    if (e.status === 'paid') byCat[cat].paid += Number(e.amount_ttc) || 0;
  }

  // Trier par montant décroissant
  const cats = Object.entries(byCat)
    .map(([name, data]) => ({
      name,
      ...data,
      pct: total > 0 ? (data.total / total) * 100 : 0,
      color: EXPENSE_CATEGORY_COLORS[name] || 'var(--text-3)',
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div style={{
      padding: 12,
      background: 'var(--surface-2)',
      borderRadius: 'var(--radius-sm)',
      marginBottom: 12,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 8,
      }}>
        <div style={{
          fontSize: 11, fontFamily: 'var(--font-mono)',
          color: 'var(--text-3)', textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}>
          Répartition par catégorie
        </div>
        {budget > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
            {fmt(total)} / {fmt(budget)} ({Math.round((total / budget) * 100)}% du budget)
          </div>
        )}
      </div>

      {/* Barre segmentée */}
      <div style={{
        display: 'flex',
        height: 10,
        borderRadius: 5,
        overflow: 'hidden',
        background: 'var(--border)',
        marginBottom: 12,
      }}>
        {cats.map(c => (
          <div
            key={c.name}
            title={`${c.name} : ${fmt(c.total)} (${c.pct.toFixed(0)}%)`}
            style={{
              width: `${c.pct}%`,
              background: c.color,
              transition: 'all var(--duration) var(--ease)',
            }}
          />
        ))}
      </div>

      {/* Légende détaillée */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 6,
      }}>
        {cats.map(c => (
          <div key={c.name} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: 2,
              background: c.color,
              flexShrink: 0,
            }} />
            <span style={{ flex: 1, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.name}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--text)',
              fontWeight: 500,
            }}>
              {fmt(c.total)}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-3)',
              fontSize: 10,
              minWidth: 32,
              textAlign: 'right',
            }}>
              {c.pct.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
