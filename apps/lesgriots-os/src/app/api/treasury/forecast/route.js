// GET /api/treasury/forecast — Construit le prévisionnel de trésorerie 30/60/90j
// Source des données :
//   - bank_balances : solde courant (dernier snapshot par compte)
//   - projects (stage = quoted/negotiation/signed/active) : revenue HT attendu en entrée à +30j
//   - expenses (status != paid) : montant TTC en sortie à expense.date
//   - recurring_costs (active) : montant TTC, projeté chaque mois pour les 90j
//   - forecast_items (manuels) : ajouts custom
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

async function _GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const horizonDays = parseInt(searchParams.get('horizon') || '90', 10);
    const minSeuil = parseFloat(searchParams.get('seuil') || '0');

    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const horizonDate = addDays(today, horizonDays);

    // 1. Solde actuel
    const balances = db.prepare(`
      SELECT b.* FROM bank_balances b
      INNER JOIN (
        SELECT account_name, MAX(snapshot_date) AS max_date
        FROM bank_balances GROUP BY account_name
      ) latest ON b.account_name = latest.account_name AND b.snapshot_date = latest.max_date
    `).all();
    const currentBalance = balances.reduce((s, b) => s + (Number(b.balance) || 0), 0);

    // 2. Entrées projetées (projets à facturer/encaisser)
    const projects = db.prepare(`
      SELECT id, code, name, revenue, stage, end_date, start_date
      FROM projects
      WHERE stage IN ('quoted','negotiation','signed','active','delivered')
        AND revenue > 0
    `).all();
    const incomeProjections = projects.map(p => {
      // Estimation date encaissement : end_date ou +30j si pas de date
      let expectedDate = p.end_date || addDays(today, 30);
      if (expectedDate < today) expectedDate = addDays(today, 15);
      // Probabilité de réalisation selon stage
      const probability = {
        quoted: 0.4, negotiation: 0.7, signed: 0.9, active: 0.85, delivered: 0.95,
      }[p.stage] || 0.5;
      return {
        type: 'in',
        source: 'project',
        source_id: p.id,
        label: `${p.code} — ${p.name}`,
        amount: Number(p.revenue) * probability,
        amount_full: Number(p.revenue),
        probability,
        expected_date: expectedDate,
        stage: p.stage,
      };
    }).filter(i => i.expected_date <= horizonDate);

    // 3. Sorties — dépenses non payées
    const expenses = db.prepare(`
      SELECT id, project_id, label, amount_ttc, status, date, category
      FROM expenses
      WHERE status IN ('pending','overdue')
        AND amount_ttc > 0
    `).all();
    const expenseProjections = expenses.map(e => ({
      type: 'out',
      source: 'expense',
      source_id: e.id,
      label: e.label,
      amount: Number(e.amount_ttc),
      expected_date: e.date || addDays(today, 7),
      status: e.status,
      category: e.category,
    })).filter(i => i.expected_date <= horizonDate);

    // 4. Coûts récurrents — projetés sur l'horizon
    const recurring = db.prepare(`
      SELECT * FROM recurring_costs WHERE active = 1
    `).all();
    const recurringProjections = [];
    const horizonMonths = Math.ceil(horizonDays / 30);
    for (const rc of recurring) {
      const monthsCount = rc.frequency === 'monthly' ? horizonMonths
        : rc.frequency === 'quarterly' ? Math.ceil(horizonMonths / 3)
        : Math.ceil(horizonMonths / 12);
      // Bornes optionnelles : start_date et end_date
      const rcStart = rc.start_date || null;
      const rcEnd = rc.end_date || null;
      for (let m = 0; m < monthsCount; m++) {
        const date = addMonths(today.slice(0, 7) + '-01', m);
        // Adjust day_of_month
        const dom = String(rc.day_of_month || 1).padStart(2, '0');
        const targetDate = date.slice(0, 7) + '-' + dom;
        if (targetDate < today || targetDate > horizonDate) continue;
        // Respect bornes du coût récurrent
        if (rcStart && targetDate < rcStart) continue;
        if (rcEnd && targetDate > rcEnd) continue;
        recurringProjections.push({
          type: 'out',
          source: 'recurring',
          source_id: rc.id,
          label: rc.label,
          amount: Number(rc.amount_ttc),
          expected_date: targetDate,
          category: rc.category,
        });
      }
    }

    // 5. Forecast items manuels
    const manual = db.prepare(`
      SELECT * FROM forecast_items
      WHERE status != 'cancelled'
        AND status != 'done'
        AND expected_date >= ?
        AND expected_date <= ?
    `).all(today, horizonDate);
    const manualProjections = manual.map(m => ({
      type: m.direction,
      source: 'manual',
      source_id: m.id,
      label: m.label,
      amount: Number(m.amount),
      expected_date: m.expected_date,
      category: m.category,
      status: m.status,
    }));

    // Tous les items
    const allItems = [
      ...incomeProjections,
      ...expenseProjections,
      ...recurringProjections,
      ...manualProjections,
    ].sort((a, b) => a.expected_date.localeCompare(b.expected_date));

    // Soldes projetés à T+30, T+60, T+90
    const project = (days) => {
      const cutoff = addDays(today, days);
      const totalIn = allItems
        .filter(i => i.type === 'in' && i.expected_date <= cutoff)
        .reduce((s, i) => s + i.amount, 0);
      const totalOut = allItems
        .filter(i => i.type === 'out' && i.expected_date <= cutoff)
        .reduce((s, i) => s + i.amount, 0);
      return currentBalance + totalIn - totalOut;
    };

    const balance30 = project(30);
    const balance60 = project(60);
    const balance90 = project(90);

    // Alerte : à quel moment on passe sous le seuil
    let alert = null;
    if (minSeuil > 0) {
      let runningBalance = currentBalance;
      for (const item of allItems) {
        if (item.type === 'in') runningBalance += item.amount;
        else runningBalance -= item.amount;
        if (runningBalance < minSeuil) {
          alert = {
            date: item.expected_date,
            balance: runningBalance,
            triggered_by: item.label,
          };
          break;
        }
      }
    }

    return NextResponse.json({
      today,
      horizonDays,
      currentBalance,
      balances,
      projections: {
        balance30,
        balance60,
        balance90,
      },
      totals: {
        income30: allItems.filter(i => i.type === 'in' && i.expected_date <= addDays(today, 30)).reduce((s, i) => s + i.amount, 0),
        outflow30: allItems.filter(i => i.type === 'out' && i.expected_date <= addDays(today, 30)).reduce((s, i) => s + i.amount, 0),
        income90: allItems.filter(i => i.type === 'in' && i.expected_date <= addDays(today, 90)).reduce((s, i) => s + i.amount, 0),
        outflow90: allItems.filter(i => i.type === 'out' && i.expected_date <= addDays(today, 90)).reduce((s, i) => s + i.amount, 0),
      },
      items: allItems,
      alert,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('data:read', _GET);
