// GET /api/cockpit — Mission Control payload
// Agrège KPIs + alertes + activité récente en une seule requête.
// Optimisé pour la home page : pas de N+1, pré-indexation des collections.
import { getDb } from '@/lib/db.mjs';
import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

const STAGE_PROBABILITY = {
  lead: 0.05,
  need: 0.10,
  qualify: 0.25,
  quoted: 0.40,
  negotiation: 0.60,
  signed: 0.90,
  active: 0.95,
  delivered: 0.98,
  paid: 1.00,
  lost: 0.00,
};

const PILLARS = ['STUDIO', 'PROD', 'GRIOTHEQUE'];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function _GET() {
  const db = getDb();
  const today = todayISO();
  const monthStart = monthStartISO();
  const sevenDaysAgo = daysAgoISO(7);
  const inSevenDays = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })();

  // ── Projects + revenue par pilier ─────────────────────────────
  const projects = db.prepare(`
    SELECT id, code, name, pillar, stage, revenue, budget, start_date, end_date, client_id
    FROM projects
    WHERE stage != 'lost'
  `).all();

  const byPillar = {};
  for (const pl of PILLARS) byPillar[pl] = { active: 0, signed: 0, revenue: 0, weighted: 0, projects: [] };

  let pipelineWeighted = 0;
  let pipelineRaw = 0;

  for (const p of projects) {
    const stage = p.stage || 'lead';
    const prob = STAGE_PROBABILITY[stage] ?? 0;
    const rev = Number(p.revenue) || 0;
    const weighted = rev * prob;
    pipelineRaw += rev;
    if (stage !== 'paid') pipelineWeighted += weighted;

    const bucket = byPillar[p.pillar] || byPillar.STUDIO;
    if (!['paid', 'lost'].includes(stage)) {
      bucket.active += 1;
      bucket.revenue += rev;
      bucket.weighted += weighted;
      bucket.projects.push({ id: p.id, code: p.code, name: p.name, stage, revenue: rev });
    }
    if (['signed', 'active', 'delivered', 'paid'].includes(stage)) bucket.signed += 1;
  }

  // Top 3 projets par pilier (par revenue)
  for (const pl of PILLARS) {
    byPillar[pl].projects = byPillar[pl].projects
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3);
  }

  // ── Cash : payé ce mois, en attente, en retard ────────────────
  const cashRow = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status='paid' AND date >= ? THEN amount_ttc ELSE 0 END), 0) as paidThisMonth,
      COALESCE(SUM(CASE WHEN status='pending' THEN amount_ttc ELSE 0 END), 0) as pending,
      COALESCE(SUM(CASE WHEN status='overdue' THEN amount_ttc ELSE 0 END), 0) as overdue,
      COUNT(CASE WHEN status='overdue' THEN 1 END) as overdueCount
    FROM expenses
  `).get(monthStart);

  // ── Tâches : aujourd'hui, en retard, à venir 7j ────────────────
  const taskRows = db.prepare(`
    SELECT id, project_id, title, status, due_date, assignee_name
    FROM tasks
    WHERE status != 'done'
  `).all();
  const tasksToday = [];
  const tasksLate = [];
  const tasksWeek = [];
  for (const t of taskRows) {
    if (!t.due_date) continue;
    if (t.due_date < today) tasksLate.push(t);
    else if (t.due_date === today) tasksToday.push(t);
    else if (t.due_date <= inSevenDays) tasksWeek.push(t);
  }

  // ── Devis envoyés sans réponse > 7j ───────────────────────────
  const quotedStale = db.prepare(`
    SELECT id, code, name, revenue, created_at
    FROM projects
    WHERE stage = 'quoted' AND date(created_at) < date(?)
    ORDER BY created_at ASC
  `).all(sevenDaysAgo);

  // ── Sessions : actives, prochaines (30j), aujourd'hui ─────────
  const sessActive = db.prepare(`
    SELECT id, formation_id, start_date, end_date, status, type_session, tarif
    FROM sessions
    WHERE status IN ('planned','ongoing')
    ORDER BY start_date ASC
  `).all();

  const sessionsToday = sessActive.filter(s => s.start_date <= today && (s.end_date || s.start_date) >= today);
  const sessionsNext30 = (() => {
    const limit = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();
    return sessActive.filter(s => s.start_date >= today && s.start_date <= limit);
  })();

  // ── Émargements manquants pour sessions en cours ──────────────
  // (session ongoing dont la date d'aujourd'hui n'a pas d'émargement complet)
  const ongoingSessions = db.prepare(`
    SELECT id, start_date, end_date FROM sessions WHERE status = 'ongoing'
  `).all();
  let emargementMissing = 0;
  if (ongoingSessions.length) {
    for (const s of ongoingSessions) {
      const start = s.start_date || today;
      const end = s.end_date || today;
      if (today < start || today > end) continue;
      const inscritsCount = db.prepare(`
        SELECT COUNT(*) as cnt FROM inscriptions WHERE session_id = ? AND status != 'annule'
      `).get(s.id)?.cnt || 0;
      if (!inscritsCount) continue;
      const emargsToday = db.prepare(`
        SELECT COUNT(*) as cnt FROM emargements WHERE session_id = ? AND date = ?
      `).get(s.id, today)?.cnt || 0;
      if (emargsToday < inscritsCount) emargementMissing += (inscritsCount - emargsToday);
    }
  }

  // ── Griothèque : CA confirmé / en attente (réutilise la logique de /api/data) ──
  const caIntraConfirmed = db.prepare(`
    SELECT COALESCE(SUM(tarif),0) as t FROM sessions WHERE type_session='INTRA' AND status IN ('ongoing','completed')
  `).get()?.t || 0;
  const caInterConfirmed = db.prepare(`
    SELECT COALESCE(SUM(i.price_ht),0) as t
    FROM inscriptions i JOIN sessions s ON s.id=i.session_id
    WHERE (s.type_session='INTER' OR s.type_session IS NULL) AND i.status='confirme'
  `).get()?.t || 0;
  const caGriotheque = caIntraConfirmed + caInterConfirmed;

  const apprenantsActifs = db.prepare(`
    SELECT COUNT(DISTINCT i.apprenant_id) as c
    FROM inscriptions i JOIN sessions s ON s.id=i.session_id
    WHERE s.status IN ('planned','ongoing') AND i.status != 'annule'
  `).get()?.c || 0;

  // ── Activité récente (derniers ppm_logs + project_journal entries) ──
  const recentLogs = db.prepare(`
    SELECT pl.id, pl.project_id, pl.phase_key, pl.note, pl.logged_at, p.code as project_code, p.name as project_name
    FROM ppm_logs pl LEFT JOIN projects p ON p.id = pl.project_id
    ORDER BY pl.logged_at DESC LIMIT 8
  `).all();

  // ── Sessions à clôturer (ongoing dont end_date passée) ────────
  const sessionsToClose = db.prepare(`
    SELECT id, formation_id, start_date, end_date FROM sessions
    WHERE status = 'ongoing' AND end_date < ?
  `).all(today);

  // ── CA mensuel sur 6 derniers mois (encaissé via expenses paid + Griothèque par session) ──
  const months = (() => {
    const out = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 5; i >= 0; i--) {
      const m = new Date(d);
      m.setMonth(m.getMonth() - i);
      out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
    }
    return out;
  })();

  const caExpenses = db.prepare(`
    SELECT strftime('%Y-%m', date) as m, COALESCE(SUM(amount_ttc), 0) as ca
    FROM expenses WHERE status = 'paid' GROUP BY m
  `).all();
  const caExpensesByMonth = Object.fromEntries(caExpenses.map(r => [r.m, Number(r.ca) || 0]));

  // Griothèque INTRA confirmé par mois de session
  const caIntraByMonth = db.prepare(`
    SELECT strftime('%Y-%m', start_date) as m, COALESCE(SUM(tarif), 0) as ca
    FROM sessions
    WHERE type_session = 'INTRA' AND status IN ('ongoing','completed')
    GROUP BY m
  `).all();
  const caIntraMap = Object.fromEntries(caIntraByMonth.map(r => [r.m, Number(r.ca) || 0]));

  // Griothèque INTER confirmé par mois de session
  const caInterByMonth = db.prepare(`
    SELECT strftime('%Y-%m', s.start_date) as m, COALESCE(SUM(i.price_ht), 0) as ca
    FROM inscriptions i JOIN sessions s ON s.id = i.session_id
    WHERE (s.type_session = 'INTER' OR s.type_session IS NULL) AND i.status = 'confirme'
    GROUP BY m
  `).all();
  const caInterMap = Object.fromEntries(caInterByMonth.map(r => [r.m, Number(r.ca) || 0]));

  const caHistory = months.map(m => ({
    month: m,
    label: new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'short' }),
    encaissé: caExpensesByMonth[m] || 0,
    griothèque: (caIntraMap[m] || 0) + (caInterMap[m] || 0),
    total: (caExpensesByMonth[m] || 0) + (caIntraMap[m] || 0) + (caInterMap[m] || 0),
  }));

  // ── Ressources humaines : charge équipe + top prestataires ──
  const teamMembers = db.prepare('SELECT id, name, role, type FROM team_members').all();
  const teamCharge = teamMembers.map(m => {
    const tasksOpen = db.prepare(`
      SELECT COUNT(*) as c FROM tasks
      WHERE status != 'done' AND (assignee_id = ? OR assignee_name = ?)
    `).get(m.id, m.name)?.c || 0;
    const tasksLate = db.prepare(`
      SELECT COUNT(*) as c FROM tasks
      WHERE status != 'done' AND due_date < ?
      AND (assignee_id = ? OR assignee_name = ?)
    `).get(today, m.id, m.name)?.c || 0;
    const projectsCount = db.prepare(`
      SELECT COUNT(DISTINCT project_id) as c FROM tasks
      WHERE status != 'done' AND (assignee_id = ? OR assignee_name = ?)
    `).get(m.id, m.name)?.c || 0;
    return {
      id: m.id, name: m.name, role: m.role, type: m.type,
      tasksOpen, tasksLate, projectsCount,
    };
  });

  // Top prestataires : par fréquence sur dépenses des 90 derniers jours
  const ninetyDaysAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().slice(0, 10); })();
  const topProviders = db.prepare(`
    SELECT
      p.id, p.name, p.first_name, p.last_name, p.category, p.rating,
      COUNT(e.id) as expense_count,
      COALESCE(SUM(e.amount_ttc), 0) as total_amount
    FROM providers p
    LEFT JOIN expenses e ON e.provider_id = p.id AND e.date >= ?
    GROUP BY p.id
    HAVING expense_count > 0
    ORDER BY total_amount DESC
    LIMIT 5
  `).all(ninetyDaysAgo);

  return NextResponse.json({
    today,
    kpis: {
      caMonth: Number(cashRow.paidThisMonth) || 0,
      pipelineWeighted,
      pipelineRaw,
      cashPending: Number(cashRow.pending) || 0,
      cashOverdue: Number(cashRow.overdue) || 0,
      tasksToday: tasksToday.length,
      tasksLate: tasksLate.length,
      sessionsActive: sessActive.length,
      sessionsToday: sessionsToday.length,
      caGriotheque,
      apprenantsActifs,
    },
    pillars: byPillar,
    alerts: {
      overdueInvoicesCount: cashRow.overdueCount || 0,
      overdueAmount: Number(cashRow.overdue) || 0,
      lateTasksCount: tasksLate.length,
      quotedStaleCount: quotedStale.length,
      quotedStale: quotedStale.slice(0, 5),
      emargementMissing,
      sessionsToCloseCount: sessionsToClose.length,
    },
    today_focus: {
      tasksToday: tasksToday.slice(0, 10),
      tasksLate: tasksLate.slice(0, 5),
      sessionsToday: sessionsToday.slice(0, 5),
      sessionsNext30: sessionsNext30.slice(0, 5),
    },
    activity: recentLogs.map(l => ({
      id: l.id,
      projectId: l.project_id,
      projectCode: l.project_code,
      projectName: l.project_name,
      phase: l.phase_key,
      note: l.note,
      loggedAt: l.logged_at,
    })),
    caHistory,
    resources: {
      team: teamCharge,
      topProviders: topProviders.map(p => ({
        id: p.id,
        name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.name,
        category: p.category,
        rating: p.rating,
        expenseCount: p.expense_count,
        totalAmount: Number(p.total_amount) || 0,
      })),
    },
  });
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('data:read', _GET);
