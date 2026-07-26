'use client';
/**
 * TreasuryDashboard — Pilotage trésorerie LES GRIOTS.
 *
 * Affiche :
 *   - Soldes actuels par compte (avec saisie manuelle hebdo)
 *   - Solde projeté à T+30, T+60, T+90
 *   - Timeline d'entrées/sorties (factures à recevoir, dépenses à payer, charges récurrentes)
 *   - Alerte si le solde projeté passe sous un seuil minimum
 */
import { useEffect, useState, useCallback } from 'react';
import { Card, Button, Badge, SectionTitle, useToast, EmptyState } from '@/components/ui';
import ForecastItemModal from './ForecastItemModal';

const fmt = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

export default function TreasuryDashboard({ monthlyRecurringCosts = 0 }) {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(false);
  const [forecastModalOpen, setForecastModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [seuil, setSeuil] = useState(() => {
    if (typeof window === 'undefined') return 5000;
    return parseFloat(localStorage.getItem('treasury_seuil') || '5000');
  });
  const [draft, setDraft] = useState({
    account_name: '', balance: 0,
    snapshot_date: new Date().toISOString().slice(0, 10),
  });

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/treasury/forecast?seuil=${seuil}`);
      const d = await r.json();
      setData(d);
    } catch (e) {
      toast.error(`Trésorerie : ${e.message}`);
    }
  }, [seuil, toast]);

  useEffect(() => { load(); }, [load]);

  const saveSeuil = (val) => {
    setSeuil(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('treasury_seuil', String(val));
    }
  };

  const createBalance = async () => {
    if (!draft.account_name.trim()) return;
    try {
      const r = await fetch('/api/bank-balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!r.ok) throw new Error('Échec création');
      setDraft({ account_name: '', balance: 0, snapshot_date: new Date().toISOString().slice(0, 10) });
      setAdding(false);
      await load();
      toast.success('Solde enregistré');
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!data) {
    return (
      <Card>
        <SectionTitle title="Pilotage trésorerie" level="h2" />
        <div style={{ padding: 20, color: 'var(--text-3)', fontSize: 13 }}>Calcul en cours…</div>
      </Card>
    );
  }

  const noBalance = !data.balances.length;
  const proj30 = data.projections.balance30;
  const proj60 = data.projections.balance60;
  const proj90 = data.projections.balance90;

  // Couleurs selon ratio au seuil
  const colorFor = (b) => b < 0 ? 'var(--danger)'
                       : b < seuil ? 'var(--warning)'
                       : 'var(--success)';

  return (
    <Card>
      <SectionTitle
        title="Pilotage trésorerie"
        level="h2"
        subtitle="Solde actuel · Prévisionnel 30/60/90 jours"
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => { setEditingItem(null); setForecastModalOpen(true); }}
            >
              + Mouvement ponctuel
            </Button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>SEUIL</span>
              <input
                type="number"
                value={seuil}
                onChange={e => saveSeuil(Number(e.target.value) || 0)}
                style={{
                  width: 80, padding: '4px 6px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  textAlign: 'right',
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>€</span>
            </div>
          </div>
        }
      />

      {/* Modale mouvement ponctuel */}
      <ForecastItemModal
        open={forecastModalOpen}
        onClose={() => { setForecastModalOpen(false); setEditingItem(null); }}
        onSaved={load}
        item={editingItem}
      />

      {/* Alerte si seuil atteint */}
      {data.alert && (
        <div style={{
          marginTop: 12,
          padding: 12,
          background: 'var(--danger-soft)',
          border: '1px solid var(--danger)',
          borderLeftWidth: 4,
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 18 }}>🚨</span>
          <div style={{ flex: 1, fontSize: 13 }}>
            <strong style={{ color: 'var(--danger)' }}>
              Trésorerie sous seuil ({fmt(seuil)}) à partir du {fmtDate(data.alert.date)}
            </strong>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
              Solde projeté : <strong style={{ fontFamily: 'var(--font-mono)' }}>{fmt(data.alert.balance)}</strong>
              {' · '}déclenché par : {data.alert.triggered_by}
            </div>
          </div>
        </div>
      )}

      {/* Soldes actuels + projections */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 8,
        marginTop: 12,
      }}>
        <Projection
          label="Solde aujourd'hui"
          value={data.currentBalance}
          color={colorFor(data.currentBalance)}
          hint={noBalance ? '⚠ Pas de solde saisi' : `${data.balances.length} compte${data.balances.length > 1 ? 's' : ''}`}
          highlight
        />
        <Projection
          label="J+30"
          value={proj30}
          color={colorFor(proj30)}
          hint={`+${fmt(data.totals.income30)} / −${fmt(data.totals.outflow30)}`}
        />
        <Projection
          label="J+60"
          value={proj60}
          color={colorFor(proj60)}
          hint={proj60 < proj30 ? '↘ en baisse' : '↗ en hausse'}
        />
        <Projection
          label="J+90"
          value={proj90}
          color={colorFor(proj90)}
          hint={`+${fmt(data.totals.income90)} / −${fmt(data.totals.outflow90)}`}
        />
      </div>

      {/* Saisie solde */}
      <div style={{
        marginTop: 14,
        padding: 12,
        background: 'var(--surface-2)',
        borderRadius: 'var(--radius-sm)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 8,
        }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)', textTransform: 'uppercase' }}>
            Soldes par compte
          </div>
          {!adding && (
            <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
              + Mettre à jour
            </Button>
          )}
        </div>

        {adding && (
          <div className="resp-grid-1col" style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 1fr 130px 100px',
            gap: 8,
            marginBottom: 10,
          }}>
            <input
              type="text"
              autoFocus
              value={draft.account_name}
              onChange={e => setDraft(d => ({ ...d, account_name: e.target.value }))}
              placeholder="Nom du compte (Qonto pro, Livret, etc.)"
              style={inp}
            />
            <input
              type="number"
              step="0.01"
              value={draft.balance}
              onChange={e => setDraft(d => ({ ...d, balance: Number(e.target.value) || 0 }))}
              placeholder="Solde €"
              style={{ ...inp, textAlign: 'right', fontFamily: 'var(--font-mono)' }}
            />
            <input
              type="date"
              value={draft.snapshot_date}
              onChange={e => setDraft(d => ({ ...d, snapshot_date: e.target.value }))}
              style={inp}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              <Button size="sm" variant="primary" onClick={createBalance}>OK</Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>✕</Button>
            </div>
          </div>
        )}

        {noBalance ? (
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>
            Aucun solde saisi. Clique sur « Mettre à jour » pour entrer ton solde Qonto / banque principale.
            Le mieux : actualiser 1× / semaine.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {data.balances.map(b => (
              <div key={b.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                padding: '4px 0',
              }}>
                <span style={{ color: 'var(--text-2)' }}>
                  {b.account_name}{' '}
                  <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                    · maj {fmtDate(b.snapshot_date)}
                  </span>
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text)' }}>
                  {fmt(b.balance)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline événements */}
      {data.items.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary style={{
            cursor: 'pointer',
            fontSize: 12, fontFamily: 'var(--font-mono)',
            color: 'var(--text-3)',
            textTransform: 'uppercase',
            padding: '6px 0',
          }}>
            Voir les {data.items.length} entrées/sorties projetées
          </summary>
          <div style={{ marginTop: 8, maxHeight: 320, overflowY: 'auto' }}>
            {data.items.map((item, i) => {
              const isManual = item.source === 'manual';
              return (
                <div
                  key={i}
                  onClick={isManual ? () => {
                    setEditingItem({
                      id: item.source_id,
                      label: item.label,
                      direction: item.type,
                      amount: item.amount,
                      expected_date: item.expected_date,
                      category: item.category,
                      status: item.status,
                    });
                    setForecastModalOpen(true);
                  } : undefined}
                  className="resp-table-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '70px 1fr 120px 90px',
                    gap: 8,
                    padding: '6px 0',
                    fontSize: 12,
                    borderBottom: '1px solid var(--border)',
                    alignItems: 'center',
                    cursor: isManual ? 'pointer' : 'default',
                  }}
                  title={isManual ? 'Cliquer pour modifier ce mouvement ponctuel' : undefined}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-3)', fontSize: 11 }}>
                    {fmtDate(item.expected_date)}
                  </span>
                  <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                    {isManual && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-3)' }}>✏️</span>}
                  </span>
                  <span>
                    <Badge tone={item.source === 'project' ? 'gold' : item.source === 'recurring' ? 'neutral' : isManual ? 'warning' : 'info'} size="sm">
                      {item.source === 'project' ? 'Projet' : item.source === 'recurring' ? 'Récurrent' : item.source === 'expense' ? 'Dépense' : 'Ponctuel'}
                    </Badge>
                  </span>
                  <span style={{
                    textAlign: 'right',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: item.type === 'in' ? 'var(--success)' : 'var(--danger)',
                  }}>
                    {item.type === 'in' ? '+' : '−'}{fmt(item.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      )}

      {monthlyRecurringCosts > 0 && (
        <div style={{
          marginTop: 12,
          padding: 10,
          background: 'var(--surface-2)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 11,
          color: 'var(--text-2)',
          fontStyle: 'italic',
        }}>
          📌 <strong>Burn rate mensuel</strong> : {fmt(monthlyRecurringCosts)} de charges fixes / mois.
          Au seuil actuel ({fmt(seuil)}), tu as <strong>{(data.currentBalance / monthlyRecurringCosts).toFixed(1)}</strong> mois d&apos;autonomie sans aucune nouvelle rentrée.
        </div>
      )}
    </Card>
  );
}

function Projection({ label, value, color, hint, highlight = false }) {
  return (
    <div style={{
      padding: highlight ? 18 : 14,
      background: highlight ? 'var(--gold-soft)' : 'var(--surface-2)',
      border: '1px solid ' + (highlight ? 'var(--gold)' : 'var(--border)'),
      borderRadius: 'var(--radius-md)',
    }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontWeight: highlight ? 300 : 400,
        fontSize: highlight ? 'var(--text-4xl)' : 'var(--text-3xl)',
        lineHeight: 0.95,
        letterSpacing: 'var(--tracking-tight)',
        color,
        fontFeatureSettings: '"tnum"',
      }}>
        {fmt(value)}
      </div>
      {hint && (
        <div style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-2)',
          marginTop: 8,
          fontFamily: 'var(--font-sans)',
          fontWeight: 400,
        }}>
          {hint}
        </div>
      )}
    </div>
  );
}

const inp = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 12,
  color: 'var(--text)',
  background: 'var(--surface)',
};
