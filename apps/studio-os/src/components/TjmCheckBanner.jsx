'use client';
/**
 * TjmCheckBanner — Alerte si un projet est facturé en-dessous du TJM plancher SASU.
 *
 * Calcule le TJM plancher en prenant en compte les charges sociales SASU,
 * la stratégie de rémunération (salaire / mix / dividendes), l'IS et la marge.
 *
 * Affiche :
 *   - rien si TJM effectif >= confort
 *   - alerte ambre si entre plancher et confort
 *   - alerte rouge si < plancher
 *
 * Props :
 *   revenue   : montant HT du projet (€)
 *   hoursSpent: heures réelles passées sur le projet
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui';

let pricingCache = null;
let pricingPromise = null;

function calcCostBreakdown({ netTarget, chargesRatio, isRate, smicNet, strategy }) {
  const pfu = 0.30;
  const isMultiplier = 1 / (1 - isRate / 100);
  const dividendsMultiplier = 1 / (1 - pfu);

  let salaryCost = 0;
  let dividendsCost = 0;

  if (strategy === 'salary') {
    salaryCost = netTarget * chargesRatio;
  } else if (strategy === 'mix') {
    const salaryNet = Math.min(smicNet, netTarget);
    salaryCost = salaryNet * chargesRatio;
    const dividendsNet = Math.max(0, netTarget - salaryNet);
    if (dividendsNet > 0) {
      dividendsCost = dividendsNet * dividendsMultiplier * isMultiplier;
    }
  } else if (strategy === 'dividends') {
    dividendsCost = netTarget * dividendsMultiplier * isMultiplier;
  }

  return { totalCost: salaryCost + dividendsCost };
}

async function loadPricing() {
  if (pricingCache) return pricingCache;
  if (!pricingPromise) {
    pricingPromise = Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/recurring-costs').then(r => r.json()).catch((e) => { console.warn('[TjmCheck] /api/recurring-costs échoué :', e); return []; }),
    ]).then(([d, rcs]) => {
      const netTarget = parseFloat(d.pricing_personal_monthly) || 0;
      const savings = parseFloat(d.pricing_savings_target) || 0;
      const profit = parseFloat(d.pricing_profit_margin) || 0;
      const hoursWeek = parseFloat(d.pricing_billable_hours_per_week) || 0;
      const weeksYear = parseFloat(d.pricing_weeks_per_year) || 0;
      const strategy = d.pricing_strategy || 'salary';
      const chargesRatio = parseFloat(d.pricing_charges_ratio) || 1.85;
      const isRate = parseFloat(d.pricing_is_rate) || 15;
      const smicNet = parseFloat(d.pricing_smic_net) || 1400;

      // Single source of truth : utiliser les recurring_costs si dispo
      const FREQ_MONTHS = { monthly: 1, quarterly: 3, yearly: 12 };
      const activeRcs = Array.isArray(rcs) ? rcs.filter(r => r.active) : [];
      const recurringTotal = activeRcs.reduce((s, r) => {
        const m = FREQ_MONTHS[r.frequency] || 1;
        return s + (Number(r.amount_ttc) || 0) / m;
      }, 0);
      const businessMonthly = activeRcs.length > 0
        ? recurringTotal
        : (parseFloat(d.pricing_business_monthly) || 0);

      const { totalCost } = calcCostBreakdown({ netTarget, chargesRatio, isRate, smicNet, strategy });
      const monthlyTotal = (totalCost + businessMonthly + savings) * (1 + profit / 100);
      const annualTarget = monthlyTotal * 12;
      const billableDaysYear = (hoursWeek * weeksYear) / 8;
      const tjmFloor = billableDaysYear > 0 ? annualTarget / billableDaysYear : 0;

      pricingCache = {
        tjmFloor,
        tjmComfort: tjmFloor * 1.2,
        strategy,
        configured: tjmFloor > 0,
      };
      return pricingCache;
    }).catch((e) => { console.warn('[TjmCheck] Calcul pricing échoué :', e); return { configured: false }; });
  }
  return pricingPromise;
}

const fmt = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);

export default function TjmCheckBanner({ revenue, hoursSpent }) {
  const [pricing, setPricing] = useState(null);

  useEffect(() => {
    loadPricing().then(setPricing);
  }, []);

  if (!pricing || !pricing.configured) return null;
  if (!revenue || !hoursSpent || hoursSpent <= 0) return null;

  const daysSpent = hoursSpent / 8;
  const tjmEffectif = revenue / daysSpent;

  // Ne pas afficher si tout va bien
  if (tjmEffectif >= pricing.tjmComfort) return null;

  const underFloor = tjmEffectif < pricing.tjmFloor;
  const ratio = tjmEffectif / pricing.tjmFloor;
  const shortBy = pricing.tjmFloor - tjmEffectif;
  const totalShort = shortBy * daysSpent;

  const bgVar = underFloor ? 'var(--danger-soft)' : 'var(--warning-soft)';
  const borderVar = underFloor ? 'var(--danger)' : 'var(--warning)';
  const textVar = underFloor ? 'var(--danger)' : 'var(--warning)';

  return (
    <Card style={{
      background: bgVar,
      borderColor: borderVar,
      borderLeftWidth: 4,
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 18 }}>{underFloor ? '⚠️' : '⚡'}</span>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: textVar,
            marginBottom: 4,
          }}>
            {underFloor
              ? `Ce projet est sous ton TJM plancher SASU de ${Math.round((1 - ratio) * 100)}%`
              : `Ce projet est dans la zone "subsistance" (entre plancher et confort)`}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
            <strong style={{ fontFamily: 'var(--font-mono)' }}>
              TJM effectif : {fmt(tjmEffectif)}
            </strong>
            {' '}vs plancher{' '}
            <strong style={{ fontFamily: 'var(--font-mono)' }}>
              {fmt(pricing.tjmFloor)}
            </strong>
            {' '}· confort{' '}
            <strong style={{ fontFamily: 'var(--font-mono)' }}>
              {fmt(pricing.tjmComfort)}
            </strong>
            {underFloor && (
              <span> · manque à gagner : <strong>{fmt(totalShort)}</strong> sur ce projet</span>
            )}
          </div>
          <Link
            href="/pricing"
            style={{
              fontSize: 11,
              color: textVar,
              textDecoration: 'underline',
              marginTop: 6,
              display: 'inline-block',
              fontFamily: 'var(--font-mono)',
            }}
          >
            → Revoir mon TJM plancher SASU
          </Link>
        </div>
      </div>
    </Card>
  );
}
