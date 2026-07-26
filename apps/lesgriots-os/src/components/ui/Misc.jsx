'use client';
/**
 * Composants utilitaires divers — HtTtc, MarginBar, CopyBtn, Pagination, Breadcrumbs.
 * Tous légers, dans un même fichier pour limiter le bruit dans /ui/.
 */
import { useState } from 'react';
import Link from 'next/link';

const fmtEur = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 2,
}).format(n || 0);

/**
 * HtTtc — affiche montant HT + TTC calculé à partir du taux TVA.
 * Props: ht (number), tvaRate (string ou number, ex "20" pour 20%), size, color
 */
export function HtTtc({ ht, tvaRate = '20', size = 13, color = 'var(--text)' }) {
  const rate = parseFloat(tvaRate) / 100 || 0;
  const ttc = (Number(ht) || 0) * (1 + rate);
  return (
    <span style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end',
      fontFamily: 'var(--font-mono)', lineHeight: 1.2,
    }}>
      <span style={{ fontSize: size, fontWeight: 600, color }}>
        {fmtEur(ht)}
      </span>
      <span style={{ fontSize: Math.max(10, size - 3), color: 'var(--text-3)' }}>
        {fmtEur(ttc)} TTC
      </span>
    </span>
  );
}

/**
 * MarginBar — barre de progression représentant la marge (Revenue - Spent / Revenue).
 * Props : revenue, spent
 */
export function MarginBar({ revenue, spent }) {
  const r = Number(revenue) || 0;
  const s = Number(spent) || 0;
  if (r === 0) {
    return <span style={{ fontSize: 11, color: 'var(--text-3)' }}>—</span>;
  }
  const marginAbs = r - s;
  const marginPct = (marginAbs / r) * 100;
  const color = marginPct > 30 ? 'var(--success)' : marginPct > 10 ? 'var(--gold)' : marginPct > 0 ? 'var(--warning)' : 'var(--danger)';
  const fillPct = Math.max(0, Math.min(100, marginPct));

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      minWidth: 100,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 11, fontFamily: 'var(--font-mono)',
      }}>
        <span style={{ color: 'var(--text-3)' }}>Marge</span>
        <span style={{ color, fontWeight: 600 }}>
          {Math.round(marginPct)}%
        </span>
      </div>
      <div style={{
        height: 4, background: 'var(--surface-2)',
        borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${fillPct}%`,
          background: color, transition: 'width var(--duration-slow) var(--ease-out)',
        }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
        {fmtEur(marginAbs)}
      </div>
    </div>
  );
}

/**
 * CopyBtn — bouton qui copie un texte dans le presse-papier avec feedback.
 * Props : text, label (default "Copier"), size (sm | md)
 */
export function CopyBtn({ text, label = 'Copier', size = 'sm', style = {} }) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      // fallback : textarea + execCommand
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 1500); }
      catch {}
      document.body.removeChild(ta);
    }
  };

  const sizeStyle = size === 'sm'
    ? { padding: '2px 8px', fontSize: 10 }
    : { padding: '4px 12px', fontSize: 12 };

  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      ...sizeStyle,
      background: copied ? 'var(--success-soft)' : 'var(--surface-2)',
      color: copied ? 'var(--success)' : 'var(--text-2)',
      border: '1px solid ' + (copied ? 'var(--success)' : 'var(--border)'),
      borderRadius: 'var(--radius-sm)',
      cursor: 'pointer',
      fontFamily: 'var(--font-mono)',
      transition: 'all var(--duration) var(--ease)',
      ...style,
    }} title={copied ? 'Copié !' : 'Copier dans le presse-papier'}>
      {copied ? '✓ Copié' : `⎘ ${label}`}
    </button>
  );
}

/**
 * Pagination — composant de navigation pour longues listes.
 * Props : total, page (1-indexed), perPage, onChange(page)
 */
export function Pagination({ total = 0, page = 1, perPage = 20, onChange }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;

  const go = (p) => {
    if (p < 1 || p > pages) return;
    onChange(p);
  };

  // Window de pages affichées (5 max autour de la page courante)
  const window = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) {
    window.push(i);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      fontSize: 12, fontFamily: 'var(--font-sans)',
    }}>
      <span style={{ color: 'var(--text-3)', marginRight: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} / {total}
      </span>
      <PageBtn onClick={() => go(page - 1)} disabled={page === 1}>‹</PageBtn>
      {window[0] > 1 && (
        <>
          <PageBtn onClick={() => go(1)}>1</PageBtn>
          {window[0] > 2 && <span style={{ color: 'var(--text-3)' }}>…</span>}
        </>
      )}
      {window.map(p => (
        <PageBtn key={p} active={p === page} onClick={() => go(p)}>{p}</PageBtn>
      ))}
      {window[window.length - 1] < pages && (
        <>
          {window[window.length - 1] < pages - 1 && <span style={{ color: 'var(--text-3)' }}>…</span>}
          <PageBtn onClick={() => go(pages)}>{pages}</PageBtn>
        </>
      )}
      <PageBtn onClick={() => go(page + 1)} disabled={page === pages}>›</PageBtn>
    </div>
  );
}

function PageBtn({ children, active, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      minWidth: 26, height: 26,
      padding: '0 8px',
      background: active ? 'var(--gold)' : 'transparent',
      color: active ? 'var(--surface)' : disabled ? 'var(--text-3)' : 'var(--text-2)',
      border: '1px solid ' + (active ? 'var(--gold)' : 'var(--border)'),
      borderRadius: 'var(--radius-sm)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      fontSize: 11, fontFamily: 'var(--font-mono)',
      fontWeight: active ? 600 : 400,
    }}>
      {children}
    </button>
  );
}

/**
 * Breadcrumbs — fil d'Ariane.
 * Props : items = [{ label, href? }] — dernier item = page courante (pas de href)
 */
export function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;
  return (
    <nav aria-label="fil d'Ariane" style={{
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 12, color: 'var(--text-3)',
      fontFamily: 'var(--font-sans)',
    }}>
      {items.map((it, i) => {
        const isLast = i === items.length - 1;
        const sep = i > 0 ? <span style={{ color: 'var(--text-3)' }}>/</span> : null;
        const content = it.href && !isLast ? (
          <Link href={it.href} style={{
            color: 'var(--text-3)', textDecoration: 'none',
            transition: 'color var(--duration) var(--ease)',
          }} onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
             onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
            {it.label}
          </Link>
        ) : (
          <span style={{
            color: isLast ? 'var(--text-2)' : 'var(--text-3)',
            fontFamily: isLast && it.mono ? 'var(--font-mono)' : 'var(--font-sans)',
          }}>{it.label}</span>
        );
        return (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {sep}{content}
          </span>
        );
      })}
    </nav>
  );
}
