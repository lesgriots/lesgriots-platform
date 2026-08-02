'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import {
  Card, Badge, Button, KpiCard, Skeleton, EmptyState,
  SectionTitle, SubLabel, StatusDot, AlertChip, CaHistoryChart,
} from '@/components/ui';

const PILLAR = {
  STUDIO:     { color: 'var(--pillar-studio)',     label: 'Studio',     subtitle: 'Agence · Direction Artistique' },
  PROD:       { color: 'var(--pillar-prod)',       label: 'Production', subtitle: 'Audiovisuel · Originals' },
  GRIOTHEQUE: { color: 'var(--pillar-griotheque)', label: 'Griothèque', subtitle: 'Formations · Masterclasses' },
};

const STAGE_LABEL = {
  lead: 'Lead', need: 'Besoin', qualify: 'Qualif', quoted: 'Devis',
  negotiation: 'Négo', signed: 'Signé', active: 'Actif',
  delivered: 'Livré', paid: 'Payé', lost: 'Perdu',
};

const STAGE_TONE = {
  lead: 'neutral', need: 'neutral', qualify: 'info',
  quoted: 'gold', negotiation: 'warning',
  signed: 'success', active: 'success',
  delivered: 'info', paid: 'success', lost: 'danger',
};

const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};
const relTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)}j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

export default function MissionControlPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/cockpit')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message));
  }, []);

  const today = new Date();
  const dateLabel = today.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const subtitleDate = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

  if (error) {
    return (
      <>
        <TopBar title="Mission Control" subtitle={subtitleDate} />
        <div style={pageStyle}>
          <Card variant="alert">
            <SectionTitle title="Cockpit indisponible" level="h2" bordered={false} />
            <div style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--danger)' }}>Erreur :</strong> {error}
              <div style={{ marginTop: 12, color: 'var(--text-3)', fontSize: 12 }}>
                Vérifie que le serveur tourne et que <code>/api/cockpit</code> répond.
                Tu peux relancer avec <code>npm run dev</code>.
              </div>
            </div>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Mission Control" subtitle={subtitleDate} />
      <div style={pageStyle} className="lg-anim-fade">
        {data ? <CockpitContent data={data} /> : <CockpitLoading />}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Loading state — skeletons fidèles à la structure finale
// ─────────────────────────────────────────────────────────
function CockpitLoading() {
  return (
    <>
      <div style={kpiGrid}>
        {Array.from({ length: 5 }).map((_, i) => <KpiCard key={i} loading />)}
      </div>
      <Card>
        <Skeleton width="40%" height={14} />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} width={180} height={32} radius="var(--radius-md)" />
          ))}
        </div>
      </Card>
      <div style={pillarsGrid}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} style={{ minHeight: 220 }}>
            <Skeleton width="60%" height={16} />
            <Skeleton width="30%" height={11} style={{ marginTop: 6 }} />
            <Skeleton width="100%" height={64} style={{ marginTop: 16 }} />
          </Card>
        ))}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Contenu principal
// ─────────────────────────────────────────────────────────
function CockpitContent({ data }) {
  const { kpis, pillars, alerts, today_focus, activity, caHistory, resources } = data;

  const hasAlerts = alerts.overdueInvoicesCount > 0
    || alerts.lateTasksCount > 0
    || alerts.quotedStaleCount > 0
    || alerts.emargementMissing > 0
    || alerts.sessionsToCloseCount > 0;

  // Calcul du trend M-1 vs M
  const monthTrend = (() => {
    if (!caHistory || caHistory.length < 2) return null;
    const curr = caHistory[caHistory.length - 1].total;
    const prev = caHistory[caHistory.length - 2].total;
    if (!prev) return null;
    const pct = Math.round(((curr - prev) / prev) * 100);
    return { pct, direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
  })();

  return (
    <>
      {/* ── HERO KPIs ────────────────────────── */}
      <div style={kpiGrid} className="lg-stagger">
        <KpiCard
          label="CA encaissé · ce mois"
          value={fmt(kpis.caMonth)}
          tone="success"
          hint={kpis.cashPending > 0 ? `+ ${fmt(kpis.cashPending)} en attente` : 'Aucun en attente'}
        />
        <KpiCard
          label="Pipeline pondéré"
          value={fmt(kpis.pipelineWeighted)}
          tone="gold"
          hint={`Brut ${fmt(kpis.pipelineRaw)}`}
        />
        <KpiCard
          label="Cash à risque"
          value={fmt(kpis.cashOverdue)}
          tone={kpis.cashOverdue > 0 ? 'danger' : 'neutral'}
          hint={alerts.overdueInvoicesCount > 0
            ? `${alerts.overdueInvoicesCount} facture${alerts.overdueInvoicesCount > 1 ? 's' : ''} en retard`
            : 'Tout est à jour'}
        />
        <KpiCard
          label="Tâches du jour"
          value={kpis.tasksToday}
          tone={kpis.tasksLate > 0 ? 'warning' : 'neutral'}
          hint={kpis.tasksLate > 0
            ? `${kpis.tasksLate} en retard`
            : kpis.tasksToday === 0 ? 'Rien de prévu' : 'À traiter'}
          href="/tasks"
        />
        <KpiCard
          label="Sessions actives"
          value={kpis.sessionsActive}
          tone="info"
          hint={kpis.sessionsToday > 0
            ? `${kpis.sessionsToday} aujourd'hui`
            : `${kpis.apprenantsActifs} apprenants`}
          href="/sessions-list"
        />
      </div>

      {/* ── CA HISTORY (6 mois) ──────────────── */}
      {caHistory && caHistory.length > 0 && (
        <Card>
          <SectionTitle
            title="CA — 6 derniers mois"
            level="h2"
            subtitle={monthTrend
              ? `${monthTrend.direction === 'up' ? '↑' : monthTrend.direction === 'down' ? '↓' : '·'} ${Math.abs(monthTrend.pct)}% vs M-1`
              : null}
            right={
              <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-3)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, background: 'var(--gold)', borderRadius: 2 }} />
                  Encaissé
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, background: 'var(--saffron)', borderRadius: 2 }} />
                  Griothèque
                </span>
              </div>
            }
          />
          <CaHistoryChart data={caHistory} />
        </Card>
      )}

      {/* ── ALERTES ──────────────────────────── */}
      {hasAlerts && (
        <Card variant="alert" className="lg-anim-rise">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6,
            color: 'var(--warning)', marginBottom: 12,
            fontFamily: 'var(--font-mono)',
          }}>
            <StatusDot tone="warning" pulse size={8} />
            <span>À traiter en priorité</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {alerts.overdueInvoicesCount > 0 && (
              <AlertChip
                tone="danger"
                label={`${alerts.overdueInvoicesCount} facture${alerts.overdueInvoicesCount > 1 ? 's' : ''} en retard`}
                detail={fmt(alerts.overdueAmount)}
              />
            )}
            {alerts.lateTasksCount > 0 && (
              <AlertChip
                tone="warning"
                label={`${alerts.lateTasksCount} tâche${alerts.lateTasksCount > 1 ? 's' : ''} en retard`}
                href="/tasks"
              />
            )}
            {alerts.quotedStaleCount > 0 && (
              <AlertChip
                tone="warning"
                label={`${alerts.quotedStaleCount} devis sans réponse +7j`}
                href="/pipeline"
              />
            )}
            {alerts.emargementMissing > 0 && (
              <AlertChip
                tone="danger"
                label={`${alerts.emargementMissing} émargement${alerts.emargementMissing > 1 ? 's' : ''} manquant${alerts.emargementMissing > 1 ? 's' : ''}`}
                detail="Qualiopi"
                href="/sessions-list"
              />
            )}
            {alerts.sessionsToCloseCount > 0 && (
              <AlertChip
                tone="info"
                label={`${alerts.sessionsToCloseCount} session${alerts.sessionsToCloseCount > 1 ? 's' : ''} à clôturer`}
                href="/sessions-list"
              />
            )}
          </div>
        </Card>
      )}

      {/* ── 3 PILIERS ────────────────────────── */}
      <div style={pillarsGrid} className="lg-stagger">
        {Object.entries(pillars).map(([key, p]) => (
          <PillarCard key={key} pillarKey={key} stats={p} />
        ))}
      </div>

      {/* ── 2 colonnes : focus du jour + activité ─── */}
      <div className="resp-grid-1col" style={twoCol}>
        <FocusPanel today={data.today_focus} />
        <ActivityPanel activity={activity} />
      </div>

      {/* ── Ressources humaines : équipe + prestataires ─── */}
      {resources && (
        <ResourcesPanel resources={resources} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Resources Panel — équipe + top prestataires
// ─────────────────────────────────────────────────────────
function ResourcesPanel({ resources }) {
  const { team = [], topProviders = [] } = resources;
  return (
    <div className="resp-grid-1col" style={twoCol}>
      {/* Charge équipe */}
      <Card>
        <SectionTitle
          title="Équipe"
          level="h2"
          subtitle={`${team.length} membre${team.length > 1 ? 's' : ''}`}
          right={<Link href="/team" style={panelLink}>Voir tout →</Link>}
        />
        {team.length === 0 ? (
          <EmptyState compact icon="—" message="Aucun membre. Ajoute dans Réglages." />
        ) : (
          team.map(m => {
            const overload = m.tasksOpen > 8;
            const initials = (m.name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
            return (
              <Link
                key={m.id}
                href={`/team/${m.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 0', borderBottom: '1px solid var(--border)',
                  textDecoration: 'none',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'var(--gold-soft)', color: 'var(--gold)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-title)',
                  flexShrink: 0,
                }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, color: 'var(--text)', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {m.name}
                  </div>
                  {m.role && (
                    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{m.role}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  {m.tasksLate > 0 && (
                    <Badge tone="danger" size="sm">{m.tasksLate} retard</Badge>
                  )}
                  <Badge tone={overload ? 'danger' : m.tasksOpen > 4 ? 'warning' : m.tasksOpen === 0 ? 'neutral' : 'info'} size="sm" mono>
                    {m.tasksOpen} tâche{m.tasksOpen > 1 ? 's' : ''}
                  </Badge>
                </div>
              </Link>
            );
          })
        )}
      </Card>

      {/* Top prestataires */}
      <Card>
        <SectionTitle
          title="Top prestataires"
          level="h2"
          subtitle="90 derniers jours"
          right={<Link href="/providers" style={panelLink}>Voir tout →</Link>}
        />
        {topProviders.length === 0 ? (
          <EmptyState compact icon="—" message="Aucune dépense prestataire récente" />
        ) : (
          topProviders.map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 0', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, color: 'var(--text)', fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {p.name}
                </div>
                {p.category && (
                  <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{p.category}</div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600,
                  color: 'var(--text)',
                }}>
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(p.totalAmount)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  {p.expenseCount} dépense{p.expenseCount > 1 ? 's' : ''}
                </div>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Pillar card
// ─────────────────────────────────────────────────────────
function PillarCard({ pillarKey, stats }) {
  const cfg = PILLAR[pillarKey] || { color: 'var(--text-2)', label: pillarKey, subtitle: '' };
  return (
    <Card variant="pillar" pillarColor={cfg.color}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 14,
      }}>
        <div>
          <div style={{
            fontSize: 14, fontWeight: 600, color: cfg.color,
            fontFamily: 'var(--font-title)', letterSpacing: 0.3,
          }}>
            {cfg.label}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
            {cfg.subtitle}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 22, fontWeight: 600, color: 'var(--text)',
            fontFamily: 'var(--font-title)', lineHeight: 1,
          }}>
            {stats.active}
          </div>
          <div style={{
            fontSize: 9, color: 'var(--text-3)',
            textTransform: 'uppercase', letterSpacing: 0.6,
            fontFamily: 'var(--font-mono)', marginTop: 2,
          }}>
            actifs
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 16, paddingBottom: 12,
        borderBottom: '1px solid var(--border)', marginBottom: 12,
      }}>
        <PillarStat label="Pipeline" value={fmt(stats.revenue)} />
        <PillarStat label="Pondéré" value={fmt(stats.weighted)} color={cfg.color} />
      </div>

      {stats.projects.length === 0 ? (
        <EmptyState compact icon="—" message="Aucun projet en cours" />
      ) : (
        stats.projects.map(p => (
          <Link key={p.id} href={`/projects?focus=${p.id}`} style={projectRow}>
            <span style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)',
              minWidth: 64, flexShrink: 0,
            }}>{p.code}</span>
            <span style={{
              flex: 1, fontSize: 12, color: 'var(--text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{p.name}</span>
            <Badge tone={STAGE_TONE[p.stage] || 'neutral'} size="sm">
              {STAGE_LABEL[p.stage] || p.stage}
            </Badge>
          </Link>
        ))
      )}
    </Card>
  );
}

function PillarStat({ label, value, color = 'var(--text)' }) {
  return (
    <div>
      <div style={{
        fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase',
        letterSpacing: 0.6, marginBottom: 3, fontFamily: 'var(--font-mono)',
      }}>{label}</div>
      <div style={{
        fontSize: 13, fontWeight: 600, color,
        fontFamily: 'var(--font-mono)',
      }}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Focus du jour
// ─────────────────────────────────────────────────────────
function FocusPanel({ today }) {
  const isQuiet = today.tasksToday.length === 0
    && today.tasksLate.length === 0
    && today.sessionsToday.length === 0;

  return (
    <Card>
      <SectionTitle
        title="Aujourd'hui"
        level="h2"
        right={<Link href="/tasks" style={panelLink}>Voir tout →</Link>}
      />

      {today.sessionsToday.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SubLabel>Sessions du jour</SubLabel>
          {today.sessionsToday.map(s => (
            <div key={s.id} style={listRow}>
              <Badge tone="gold" mono>{s.type_session || 'INTER'}</Badge>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>
                Session {String(s.id).slice(0, 8)} · {fmtDate(s.start_date)} → {fmtDate(s.end_date)}
              </span>
            </div>
          ))}
        </div>
      )}

      <SubLabel>Tâches du jour ({today.tasksToday.length})</SubLabel>
      {today.tasksToday.length === 0 ? (
        <EmptyState
          compact
          icon="✓"
          tone="success"
          message="Rien de prévu aujourd'hui"
        />
      ) : (
        today.tasksToday.map(t => (
          <div key={t.id} style={listRow}>
            <StatusDot tone="info" />
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{t.title}</span>
            {t.assignee_name && (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t.assignee_name}</span>
            )}
          </div>
        ))
      )}

      {today.tasksLate.length > 0 && (
        <>
          <SubLabel color="var(--danger)" style={{ marginTop: 16 }}>
            En retard ({today.tasksLate.length})
          </SubLabel>
          {today.tasksLate.map(t => (
            <div key={t.id} style={listRow}>
              <StatusDot tone="danger" pulse />
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{t.title}</span>
              <span style={{
                fontSize: 11, color: 'var(--danger)',
                fontFamily: 'var(--font-mono)',
              }}>
                {fmtDate(t.due_date)}
              </span>
            </div>
          ))}
        </>
      )}

      {today.sessionsNext30.length > 0 && (
        <>
          <SubLabel style={{ marginTop: 16 }}>Prochaines sessions (30j)</SubLabel>
          {today.sessionsNext30.map(s => (
            <div key={s.id} style={listRow}>
              <span style={{
                fontSize: 11, color: 'var(--text-3)',
                fontFamily: 'var(--font-mono)', minWidth: 56,
              }}>{fmtDate(s.start_date)}</span>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>
                {s.type_session || 'INTER'}
              </span>
              <span style={{
                fontSize: 12, color: 'var(--text-2)',
                fontFamily: 'var(--font-mono)',
              }}>{fmt(s.tarif)}</span>
            </div>
          ))}
        </>
      )}

      {isQuiet && today.sessionsNext30.length === 0 && (
        <EmptyState
          icon="◯"
          title="Journée calme"
          message="Aucune urgence sur le radar. Bon moment pour avancer un sujet de fond."
          tone="success"
          style={{ paddingTop: 16, paddingBottom: 8 }}
        />
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// Activité récente
// ─────────────────────────────────────────────────────────
function ActivityPanel({ activity }) {
  return (
    <Card>
      <SectionTitle title="Activité" level="h2" />
      {activity.length === 0 ? (
        <EmptyState
          icon="◌"
          title="Pas encore d'activité"
          message="Le journal projet et les logs PPM apparaîtront ici."
        />
      ) : (
        <div className="lg-stagger">
          {activity.map(a => (
            <div key={a.id} style={activityRow}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'baseline', marginBottom: 4,
              }}>
                <span style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)',
                }}>
                  {a.projectCode || '—'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {relTime(a.loggedAt)}
                </span>
              </div>
              {a.projectName && (
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
                  {a.projectName}
                </div>
              )}
              <div style={{
                fontSize: 13, color: 'var(--text)',
                lineHeight: 1.5, marginBottom: a.phase ? 6 : 0,
              }}>
                {a.note}
              </div>
              {a.phase && (
                <Badge tone="neutral" mono>{a.phase}</Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// Styles layout
// ─────────────────────────────────────────────────────────
const pageStyle = {
  padding: 'var(--sp-6)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--sp-5)',
  maxWidth: 'var(--content-max)',
  margin: '0 auto',
  width: '100%',
};

const kpiGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 'var(--sp-3)',
};

const pillarsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 'var(--sp-3)',
};

const twoCol = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
  gap: 'var(--sp-3)',
};

const panelLink = {
  fontSize: 12,
  color: 'var(--text-2)',
  textDecoration: 'none',
  transition: 'color var(--duration) var(--ease)',
};

const listRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 0',
  borderBottom: '1px solid var(--border)',
};

const projectRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 0',
  textDecoration: 'none',
  borderBottom: '1px solid var(--border)',
  transition: 'background var(--duration) var(--ease)',
};

const activityRow = {
  padding: '12px 0',
  borderBottom: '1px solid var(--border)',
};
