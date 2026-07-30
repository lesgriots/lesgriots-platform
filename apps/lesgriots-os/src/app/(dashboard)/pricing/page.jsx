'use client';
/**
 * /pricing — TJM plancher SASU (Painless Pricing × spécificités SASU FR).
 *
 * Différence v1 : prend en compte les charges sociales SASU (président assimilé
 * salarié), l'IS sur bénéfice gardé, et 3 stratégies de rémunération.
 *
 * Calcul :
 *   strategy = 'salary' :
 *     coût_salaire = net_target × charges_ratio
 *   strategy = 'mix' :
 *     coût_salaire_base = smic_net × charges_ratio
 *     besoin_dividendes_net = max(0, net_target - smic_net)
 *     dividendes_brut = besoin_dividendes_net / (1 - 0.30)  (PFU 30%)
 *     coût_dividendes = dividendes_brut / (1 - is_rate/100) (passe par IS)
 *     coût_total_rému = coût_salaire_base + coût_dividendes
 *   strategy = 'dividends' :
 *     dividendes_brut = net_target / (1 - 0.30)
 *     coût_total_rému = dividendes_brut / (1 - is_rate/100)
 *
 *   total_mensuel_ht = coût_total_rému + business + savings
 *   target_annuel_ht = total_mensuel_ht × (1 + profit_margin/100) × 12
 *   tjm_floor = target_annuel_ht / (billable_hours_year / 8)
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import {
  Card, Button, Skeleton, SectionTitle, useToast, Badge,
} from '@/components/ui';

const STRATEGIES = [
  {
    key: 'salary',
    label: 'Salaire uniquement',
    icon: '💼',
    short: 'Tout en salaire mensuel',
    pros: ['Protection sociale max', 'Trimestres retraite validés', 'Revenu régulier'],
    cons: ['Charges sociales lourdes (×1.85)', 'Optimisation fiscale faible'],
  },
  {
    key: 'mix',
    label: 'Mix salaire + dividendes',
    icon: '🎛',
    short: 'SMIC + dividendes annuels (le plus optimisé)',
    pros: ['Charges réduites sur la partie dividendes', 'Trimestres retraite OK (via SMIC)', 'Flexibilité'],
    cons: ['Plus complexe à piloter', 'Dépend du bénéfice annuel'],
  },
  {
    key: 'dividends',
    label: 'Dividendes uniquement',
    icon: '🎰',
    short: 'Distribution annuelle, pas de salaire',
    pros: ['Aucune charge sociale', 'Fiscalité PFU 30% simple'],
    cons: ['Pas de protection sociale (assurance maladie via PUMA seulement)', 'Pas de trimestres retraite', 'Pas de revenu mensuel régulier'],
  },
];

const fmt = (n, opts = {}) => new Intl.NumberFormat('fr-FR', {
  style: opts.style || 'currency',
  currency: 'EUR',
  maximumFractionDigits: opts.dec ?? 0,
}).format(n || 0);

const fmtPct = (n) => `${(n || 0).toFixed(1)}%`;

// Calcule le coût total mensuel pour la SASU selon la stratégie
function calcCostBreakdown({ netTarget, chargesRatio, isRate, smicNet, strategy }) {
  const pfu = 0.30; // Prélèvement Forfaitaire Unique sur dividendes
  const isMultiplier = 1 / (1 - isRate / 100); // Pour 1€ net après IS, il faut isMultiplier€ avant IS
  const dividendsMultiplier = 1 / (1 - pfu); // Pour 1€ net en poche, il faut dividendsMultiplier€ bruts

  let salaryCost = 0;
  let dividendsCost = 0;
  let salaryNet = 0;
  let dividendsNet = 0;

  if (strategy === 'salary') {
    salaryNet = netTarget;
    salaryCost = netTarget * chargesRatio;
  } else if (strategy === 'mix') {
    salaryNet = Math.min(smicNet, netTarget);
    salaryCost = salaryNet * chargesRatio;
    dividendsNet = Math.max(0, netTarget - salaryNet);
    if (dividendsNet > 0) {
      const dividendsGross = dividendsNet * dividendsMultiplier;
      dividendsCost = dividendsGross * isMultiplier;
    }
  } else if (strategy === 'dividends') {
    dividendsNet = netTarget;
    const dividendsGross = netTarget * dividendsMultiplier;
    dividendsCost = dividendsGross * isMultiplier;
  }

  return {
    salaryNet,
    salaryCost,
    dividendsNet,
    dividendsCost,
    totalCost: salaryCost + dividendsCost,
    effectiveRatio: netTarget > 0 ? (salaryCost + dividendsCost) / netTarget : 0,
  };
}

export default function PricingPage() {
  const { toast } = useToast();
  const [values, setValues] = useState(null);
  const [recurringTotal, setRecurringTotal] = useState(null); // somme calculée depuis /finances
  const [recurringCount, setRecurringCount] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/recurring-costs').then(r => r.json()),
    ]).then(([d, rcs]) => {
      // Calcul automatique du total mensuel depuis les coûts récurrents
      const FREQ_MONTHS = { monthly: 1, quarterly: 3, yearly: 12 };
      const active = Array.isArray(rcs) ? rcs.filter(r => r.active) : [];
      const total = active.reduce((s, r) => {
        const months = FREQ_MONTHS[r.frequency] || 1;
        return s + (Number(r.amount_ttc) || 0) / months;
      }, 0);
      setRecurringTotal(total);
      setRecurringCount(active.length);

      setValues({
        pricing_personal_monthly: parseFloat(d.pricing_personal_monthly) || 2500,
        pricing_business_monthly: parseFloat(d.pricing_business_monthly) || 800,
        pricing_savings_target: parseFloat(d.pricing_savings_target) || 500,
        pricing_profit_margin: parseFloat(d.pricing_profit_margin) || 20,
        pricing_billable_hours_per_week: parseFloat(d.pricing_billable_hours_per_week) || 20,
        pricing_weeks_per_year: parseFloat(d.pricing_weeks_per_year) || 46,
        pricing_strategy: d.pricing_strategy || 'salary',
        pricing_charges_ratio: parseFloat(d.pricing_charges_ratio) || 1.85,
        pricing_is_rate: parseFloat(d.pricing_is_rate) || 15,
        pricing_smic_net: parseFloat(d.pricing_smic_net) || 1400,
      });
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {};
      Object.entries(values).forEach(([k, v]) => {
        payload[k] = String(v);
      });
      const r = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success('TJM mis à jour');
    } catch (e) {
      toast.error(`Sauvegarde : ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!values) {
    return (
      <>
        <TopBar title="TJM" />
        <div style={pageStyle}>
          <Card><Skeleton width="50%" height={20} /></Card>
        </div>
      </>
    );
  }

  const netTarget = values.pricing_personal_monthly;
  // Single source of truth : si des recurring_costs existent dans /finances, on les utilise.
  // Sinon, fallback sur la valeur saisie dans pricing_business_monthly.
  const businessMonthly = recurringCount > 0
    ? recurringTotal
    : values.pricing_business_monthly;
  const savings = values.pricing_savings_target;
  const profit = values.pricing_profit_margin;
  const hoursWeek = values.pricing_billable_hours_per_week;
  const weeksYear = values.pricing_weeks_per_year;
  const strategy = values.pricing_strategy;
  const chargesRatio = values.pricing_charges_ratio;
  const isRate = values.pricing_is_rate;
  const smicNet = values.pricing_smic_net;

  // Calcul pour la stratégie active
  const cost = calcCostBreakdown({ netTarget, chargesRatio, isRate, smicNet, strategy });

  const monthlyTotalHT = cost.totalCost + businessMonthly + savings;
  const monthlyTargetWithMargin = monthlyTotalHT * (1 + profit / 100);
  const annualTarget = monthlyTargetWithMargin * 12;
  const billableHoursYear = hoursWeek * weeksYear;
  const billableDaysYear = billableHoursYear / 8;
  const tjmFloor = billableDaysYear > 0 ? annualTarget / billableDaysYear : 0;
  const tjmComfort = tjmFloor * 1.2;
  const tjmThrive = tjmFloor * 1.5;
  const tauxHoraireFloor = billableHoursYear > 0 ? annualTarget / billableHoursYear : 0;

  // Comparaison des 3 stratégies pour le même netTarget
  const comparisons = STRATEGIES.map(s => {
    const c = calcCostBreakdown({ netTarget, chargesRatio, isRate, smicNet, strategy: s.key });
    const monthlyHT = (c.totalCost + businessMonthly + savings) * (1 + profit / 100);
    const tjm = billableDaysYear > 0 ? (monthlyHT * 12) / billableDaysYear : 0;
    return { ...s, cost: c, tjm, monthlyHT };
  });

  return (
    <>
      <TopBar
        title="TJM"
        subtitle="Plancher SASU — Painless Pricing × charges sociales FR"
      />
      <div style={pageStyle} className="lg-anim-fade">

        {/* Résultat hero */}
        <Card variant="pillar" pillarColor="var(--gold)">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <ResultStat
              label="TJM plancher"
              value={fmt(tjmFloor)}
              hint={`En-dessous, ${strategy === 'dividends' ? 'pas de marge' : 'tu vends à perte'}`}
              accent="var(--danger)"
              big
            />
            <ResultStat
              label="TJM confort (+20%)"
              value={fmt(tjmComfort)}
              hint="Cible négociation"
              accent="var(--warning)"
            />
            <ResultStat
              label="TJM thrive (+50%)"
              value={fmt(tjmThrive)}
              hint="Pour scaler / réinvestir"
              accent="var(--success)"
            />
            <ResultStat
              label="CA HT mensuel cible"
              value={fmt(monthlyTargetWithMargin)}
              hint={`Pour ${fmt(netTarget)} net en poche`}
            />
          </div>
        </Card>

        {/* Pédagogie SASU */}
        <Card variant="alert">
          <SectionTitle title="🎓 Comprendre la rému SASU" level="h2" />
          <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7, marginTop: 8 }}>
            <p style={{ margin: '0 0 8px' }}>
              En SASU, le président est <strong>assimilé salarié</strong>. Pour 1 € que tu touches sur ton compte perso (NET), la SASU dépense environ <strong>1,85 €</strong> (charges patronales ~42% + cotisations salariales ~22% via cotisations sociales URSSAF / retraite / prévoyance).
            </p>
            <p style={{ margin: '0 0 8px' }}>
              Alternative : se verser des <strong>dividendes</strong> (taxés à 30% PFU, mais qui passent par l&apos;<strong>IS</strong> avant — 15% jusqu&apos;à 42 500 € de bénéfice, puis 25%). Pas de charges sociales sur les dividendes en SASU (différence majeure vs EURL). Mais pas de validation de trimestres retraite ni de protection sociale.
            </p>
            <p style={{ margin: '0 0 8px' }}>
              <strong>Stratégie optimale en général :</strong> SMIC mensuel (~1 400 € net) pour valider trimestres retraite + dividendes annuels pour le reste.
            </p>
            <p style={{ margin: '0', color: 'var(--text-3)', fontStyle: 'italic' }}>
              ⚠ Les ratios sont des approximations. Ton comptable a les chiffres exacts selon ta tranche de salaire, plafond SS, mutuelle, prévoyance. À ajuster ici en fonction de ses recommandations.
            </p>
          </div>
        </Card>

        {/* Stratégie de rémunération */}
        <Card>
          <SectionTitle
            title="Ta stratégie de rémunération"
            level="h2"
            subtitle="Trois manières de te verser ce que tu vises en NET"
          />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 10,
            marginTop: 12,
          }}>
            {STRATEGIES.map(s => {
              const isActive = strategy === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    setValues(v => ({ ...v, pricing_strategy: s.key }));
                    setTimeout(save, 100);
                  }}
                  style={{
                    textAlign: 'left',
                    background: isActive ? 'var(--gold-soft)' : 'var(--surface-2)',
                    border: '1px solid ' + (isActive ? 'var(--gold)' : 'var(--border)'),
                    borderRadius: 'var(--radius-md)',
                    padding: 14,
                    cursor: 'pointer',
                    transition: 'all var(--duration) var(--ease)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>{s.icon}</span>
                    <strong style={{ fontSize: 13, color: 'var(--text)' }}>{s.label}</strong>
                    {isActive && <Badge tone="gold" size="sm">Actif</Badge>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8 }}>{s.short}</div>
                  <div style={{ fontSize: 10, color: 'var(--success)', marginBottom: 2 }}>
                    + {s.pros.join(' · ')}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--danger)' }}>
                    − {s.cons.join(' · ')}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Inputs */}
        <Card>
          <SectionTitle
            title="Tes besoins financiers"
            level="h2"
            subtitle="Ce que tu vises en NET sur ton compte perso + les coûts de ta SASU"
            right={
              <Button variant="primary" size="sm" onClick={save} disabled={saving}>
                {saving ? 'Sauvegarde…' : 'Sauvegarder'}
              </Button>
            }
          />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
            marginTop: 12,
          }}>
            <Field
              label="Net visé / mois"
              unit="€"
              value={values.pricing_personal_monthly}
              onChange={v => setValues(s => ({ ...s, pricing_personal_monthly: v }))}
              onBlur={save}
              help="Le NET que tu veux toucher sur ton compte perso chaque mois (équivalent SMIC = 1 400 €, médiane cadre = 3 000 €)."
            />
            <Field
              label="Ratio charges SASU"
              unit="×"
              dec={2}
              value={values.pricing_charges_ratio}
              onChange={v => setValues(s => ({ ...s, pricing_charges_ratio: v }))}
              onBlur={save}
              help="Multiplicateur NET → COÛT TOTAL pour la SASU. 1.85 = standard SASU président assimilé salarié."
            />
            <Field
              label="Taux IS"
              unit="%"
              value={values.pricing_is_rate}
              onChange={v => setValues(s => ({ ...s, pricing_is_rate: v }))}
              onBlur={save}
              help="15% jusqu'à 42 500 € de bénéfice annuel, puis 25%. Concerne dividendes et bénéfice gardé en réserve."
            />
            <Field
              label="SMIC net (pour stratégie Mix)"
              unit="€/mois"
              value={values.pricing_smic_net}
              onChange={v => setValues(s => ({ ...s, pricing_smic_net: v }))}
              onBlur={save}
              help="Salaire minimum versé en mode Mix (~1 400 € NET = SMIC), pour valider tes trimestres retraite."
            />
            {recurringCount > 0 ? (
              <ReadOnlyField
                label="Coûts fixes pro SASU"
                unit="€/mois"
                value={Math.round(recurringTotal)}
                help={
                  <>
                    Calculé depuis tes <strong>{recurringCount} coûts récurrents</strong> actifs.{' '}
                    <Link href="/finances" style={{ color: 'var(--gold-deep)' }}>→ Ajouter / modifier dans /finances</Link>
                  </>
                }
              />
            ) : (
              <Field
                label="Coûts fixes pro SASU"
                unit="€/mois"
                value={values.pricing_business_monthly}
                onChange={v => setValues(s => ({ ...s, pricing_business_monthly: v }))}
                onBlur={save}
                help={
                  <>
                    Estimation grossière. Pour saisir le détail (URSSAF, comptable, Adobe, etc.),{' '}
                    <Link href="/finances" style={{ color: 'var(--gold-deep)' }}>→ va dans /finances</Link>
                  </>
                }
              />
            )}
            <Field
              label="Réserve trésorerie SASU"
              unit="€/mois"
              value={values.pricing_savings_target}
              onChange={v => setValues(s => ({ ...s, pricing_savings_target: v }))}
              onBlur={save}
              help="Matelas de sécurité (3-6 mois de charges) + budgets investissement (matos, formation, embauche future)."
            />
            <Field
              label="Marge bénéfice (avant IS)"
              unit="%"
              value={values.pricing_profit_margin}
              onChange={v => setValues(s => ({ ...s, pricing_profit_margin: v }))}
              onBlur={save}
              help="Bénéfice cible au-delà des coûts. 20% mini pour une boîte saine — sert à amortir, investir, ou distribuer en dividendes plus tard."
            />
            <Field
              label="Heures facturables / sem"
              unit="h"
              value={values.pricing_billable_hours_per_week}
              onChange={v => setValues(s => ({ ...s, pricing_billable_hours_per_week: v }))}
              onBlur={save}
              help="Sur 35-40h de travail, seules 50-60% sont vraiment facturables (le reste = admin, prospection, formation). Réaliste : 20h."
            />
            <Field
              label="Semaines facturables / an"
              unit="sem"
              value={values.pricing_weeks_per_year}
              onChange={v => setValues(s => ({ ...s, pricing_weeks_per_year: v }))}
              onBlur={save}
              help="52 sem - 5 sem congés - 2 sem jours fériés - 1 sem maladie ≈ 44-46."
            />
          </div>
        </Card>

        {/* Décomposition du calcul stratégie active */}
        <Card>
          <SectionTitle title="Décomposition du calcul" level="h2" subtitle={`Stratégie active : ${STRATEGIES.find(s => s.key === strategy)?.label}`} />
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text)', lineHeight: 1.8 }}>
            {strategy === 'salary' && (
              <BreakRow label="1. Net visé" formula="Ce que tu touches sur ton compte" value={fmt(netTarget)} />
            )}
            {strategy === 'salary' && (
              <BreakRow label="2. Coût total salaire SASU" formula={`${fmt(netTarget)} × ${chargesRatio} (charges sociales)`} value={fmt(cost.totalCost)} accent />
            )}

            {strategy === 'mix' && (
              <>
                <BreakRow label="1a. Salaire NET (SMIC)" formula={`Pour valider tes trimestres retraite`} value={fmt(cost.salaryNet)} />
                <BreakRow label="1b. Coût salaire SASU" formula={`${fmt(cost.salaryNet)} × ${chargesRatio}`} value={fmt(cost.salaryCost)} />
                <BreakRow label="2a. Dividendes NET visés" formula={`${fmt(netTarget)} − ${fmt(cost.salaryNet)}`} value={fmt(cost.dividendsNet)} />
                <BreakRow label="2b. Dividendes bruts avant PFU" formula={`${fmt(cost.dividendsNet)} ÷ 0.7 (PFU 30%)`} value={fmt(cost.dividendsNet / 0.7)} />
                <BreakRow label="2c. Bénéfice avant IS nécessaire" formula={`${fmt(cost.dividendsNet / 0.7)} ÷ ${(1 - isRate / 100).toFixed(2)} (IS ${isRate}%)`} value={fmt(cost.dividendsCost)} />
                <BreakRow label="3. Coût total rémunération" formula={`Salaire + bénéfice pour dividendes`} value={fmt(cost.totalCost)} accent />
              </>
            )}

            {strategy === 'dividends' && (
              <>
                <BreakRow label="1. Dividendes NET visés" formula="Distribution annuelle / 12" value={fmt(netTarget)} />
                <BreakRow label="2. Dividendes bruts avant PFU" formula={`${fmt(netTarget)} ÷ 0.7 (PFU 30%)`} value={fmt(netTarget / 0.7)} />
                <BreakRow label="3. Bénéfice avant IS nécessaire" formula={`${fmt(netTarget / 0.7)} ÷ ${(1 - isRate / 100).toFixed(2)} (IS ${isRate}%)`} value={fmt(cost.totalCost)} accent />
              </>
            )}

            <BreakRow label="+ Coûts fixes pro SASU" formula="URSSAF, comptable, soft, etc." value={fmt(businessMonthly)} />
            <BreakRow label="+ Réserve trésorerie" formula="Matelas SASU" value={fmt(savings)} />
            <BreakRow label="= Total mensuel nécessaire" formula="" value={fmt(monthlyTotalHT)} />
            <BreakRow label="× Marge bénéfice" formula={`× ${(1 + profit / 100).toFixed(2)}`} value={fmt(monthlyTargetWithMargin)} />
            <BreakRow label="× 12 mois → objectif annuel HT" formula="" value={fmt(annualTarget)} />
            <BreakRow label="÷ Jours facturables / an" formula={`${Math.round(billableHoursYear)} h ÷ 8`} value={`${Math.round(billableDaysYear)} jours`} />
            <BreakRow label="= TJM PLANCHER" formula="" value={fmt(tjmFloor)} accent />
          </div>

          <div style={{
            marginTop: 16, padding: 12,
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6,
          }}>
            <strong>📌 Note :</strong> la TVA (20%) s&apos;ajoute au-dessus du TJM HT en facture. Pour la SASU elle est neutre (collectée puis reversée), mais elle impacte ta trésorerie mensuelle. Ce calculateur travaille uniquement en HT.
          </div>
        </Card>

        {/* Comparaison des 3 stratégies */}
        <Card>
          <SectionTitle
            title="Comparatif des 3 stratégies"
            level="h2"
            subtitle={`Pour le même objectif net mensuel de ${fmt(netTarget)}`}
          />
          <div style={{ marginTop: 12, overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Stratégie</th>
                  <th style={thStyle}>Net en poche</th>
                  <th style={thStyle}>Coût total rému</th>
                  <th style={thStyle}>Ratio effectif</th>
                  <th style={thStyle}>CA HT mensuel</th>
                  <th style={thStyle}>TJM plancher</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map(c => (
                  <tr key={c.key} style={{
                    background: c.key === strategy ? 'var(--gold-soft)' : 'transparent',
                    fontWeight: c.key === strategy ? 600 : 400,
                  }}>
                    <td style={tdStyle}>{c.icon} {c.label}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>{fmt(netTarget)}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>{fmt(c.cost.totalCost)}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>× {c.cost.effectiveRatio.toFixed(2)}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>{fmt(c.monthlyHT)}</td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', color: 'var(--gold-deep)', fontWeight: 700 }}>{fmt(c.tjm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-3)', fontStyle: 'italic' }}>
            👉 Le mix est presque toujours plus avantageux qu&apos;un salaire pur, à condition d&apos;avoir un bénéfice annuel suffisant. Discute avec ton comptable pour valider le bon mix selon ta situation.
          </div>
        </Card>

      </div>
    </>
  );
}

function Field({ label, unit, value, onChange, onBlur, help, dec = 0 }) {
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type="number"
          step={dec > 0 ? '0.01' : '1'}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          onBlur={onBlur}
          style={inputStyle}
        />
        <span style={unitStyle}>{unit}</span>
      </div>
      <div style={helpStyle}>{help}</div>
    </div>
  );
}

function ReadOnlyField({ label, unit, value, help }) {
  return (
    <div>
      <label style={fieldLabel}>
        {label}
        <span style={{
          marginLeft: 6,
          fontSize: 9,
          background: 'var(--gold-soft)',
          color: 'var(--gold-deep)',
          padding: '2px 6px',
          borderRadius: 3,
          letterSpacing: 0.4,
        }}>
          AUTO
        </span>
      </label>
      <div style={{ position: 'relative' }}>
        <div style={{
          ...inputStyle,
          background: 'var(--surface-2)',
          color: 'var(--gold-deep)',
          cursor: 'default',
        }}>
          {value}
        </div>
        <span style={unitStyle}>{unit}</span>
      </div>
      <div style={helpStyle}>{help}</div>
    </div>
  );
}

function ResultStat({ label, value, hint, accent = 'var(--text)', big = false }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 12 }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontWeight: big ? 200 : 300,
        fontSize: big ? 'var(--text-6xl)' : 'var(--text-5xl)',
        lineHeight: 0.95,
        letterSpacing: 'var(--tracking-tight)',
        color: accent,
        fontFeatureSettings: '"tnum"',
      }}>
        {value}
      </div>
      {hint && (
        <div style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-2)',
          marginTop: 10,
          fontFamily: 'var(--font-sans)',
          fontWeight: 400,
        }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function BreakRow({ label, formula, value, accent = false }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: '1px solid var(--border)',
      gap: 12,
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flex: 1 }}>
        <span style={{ fontSize: 12, fontWeight: accent ? 600 : 400, color: 'var(--text)' }}>{label}</span>
        {formula && <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{formula}</span>}
      </div>
      <span style={{
        fontSize: 14,
        fontWeight: accent ? 700 : 500,
        color: accent ? 'var(--gold-deep)' : 'var(--text)',
        fontFamily: 'var(--font-mono)',
      }}>
        = {value}
      </span>
    </div>
  );
}

const pageStyle = {
  padding: 'var(--sp-6)',
  display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
  maxWidth: 'var(--content-max)', margin: '0 auto', width: '100%', boxSizing: 'border-box',
};
const fieldLabel = {
  display: 'block',
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  marginBottom: 6,
};
const inputStyle = {
  width: '100%',
  padding: '10px 60px 10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 16,
  fontWeight: 600,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text)',
  background: 'var(--surface)',
};
const unitStyle = {
  position: 'absolute',
  right: 12,
  top: '50%',
  transform: 'translateY(-50%)',
  fontSize: 11,
  color: 'var(--text-3)',
  fontFamily: 'var(--font-mono)',
};
const helpStyle = {
  fontSize: 11,
  color: 'var(--text-3)',
  marginTop: 6,
  lineHeight: 1.5,
};
const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
};
const thStyle = {
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 600,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  padding: '8px 12px',
  borderBottom: '1px solid var(--border)',
};
const tdStyle = {
  fontSize: 13,
  color: 'var(--text)',
  padding: '10px 12px',
  borderBottom: '1px solid var(--border)',
};
