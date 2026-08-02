'use client';
/**
 * ProjectNav — onglets de navigation contextuelle au sein d'un projet.
 *
 * Routes réelles : Vue d'ensemble (/projects/[id]) · Brief (/projects/[id]/brief).
 * Onglets ancres : Tâches · Dépenses · Journal — scroll sur la fiche projet.
 *
 * Props :
 *   projectId : id du projet
 *   active : 'overview' | 'brief' | 'tasks' | 'expenses' | 'journal'
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';

const TABS = [
  { key: 'overview', label: 'Vue d\'ensemble', href: (id) => `/projects/${id}`,         icon: '◰' },
  { key: 'brief',    label: 'Brief',           href: (id) => `/projects/${id}/brief`,   icon: '📋' },
  { key: 'phases',   label: 'Roadmap',         href: (id) => `/projects/${id}/phases`,  icon: '🗺' },
  { key: 'tasks',    label: 'Tâches',          anchor: '#tasks',                         icon: '✓' },
  { key: 'expenses', label: 'Dépenses',        anchor: '#expenses',                      icon: '€' },
  { key: 'journal',  label: 'Journal',         anchor: '#journal',                       icon: '✎' },
];

export default function ProjectNav({ projectId, active = 'overview' }) {
  const isOnOverview = active === 'overview';

  // Détection scroll pour highlight de l'ancre courante (seulement sur vue d'ensemble)
  const [scrollTab, setScrollTab] = useState(null);
  useEffect(() => {
    if (!isOnOverview) return;
    const onScroll = () => {
      const targets = ['tasks', 'expenses', 'journal'];
      let current = null;
      for (const t of targets) {
        const el = document.getElementById(t);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top < 120 && rect.bottom > 120) { current = t; break; }
      }
      setScrollTab(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isOnOverview]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: 3,
      overflowX: 'auto',
      width: 'fit-content',
      maxWidth: '100%',
    }}>
      {TABS.map(tab => {
        const isPageTab = !!tab.href;
        // Active si on est sur la page correspondante,
        // OU si on est sur Vue d'ensemble et le tab scrollé matche
        const isActive = isPageTab
          ? (tab.key === active)
          : (isOnOverview && scrollTab === tab.key);

        const baseStyle = {
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 'var(--radius-sm)',
          fontSize: 12, fontWeight: isActive ? 500 : 400,
          fontFamily: 'var(--font-sans)',
          color: isActive ? 'var(--gold-deep)' : 'var(--text-2)',
          background: isActive ? 'var(--gold-soft)' : 'transparent',
          border: '1px solid ' + (isActive ? 'var(--gold)' : 'transparent'),
          textDecoration: 'none',
          cursor: 'pointer',
          transition: 'all var(--duration) var(--ease)',
          whiteSpace: 'nowrap',
        };

        const inner = (
          <>
            <span style={{ fontSize: 11, opacity: 0.85 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </>
        );

        if (isPageTab) {
          return (
            <Link
              key={tab.key}
              href={tab.href(projectId)}
              style={baseStyle}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--surface-2)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              {inner}
            </Link>
          );
        }

        // Ancre — visible et fonctionne seulement sur Vue d'ensemble.
        // Sur Brief (par ex), un clic doit naviguer vers /projects/[id] + ancre.
        const href = isOnOverview ? tab.anchor : `/projects/${projectId}${tab.anchor}`;
        return (
          <Link
            key={tab.key}
            href={href}
            scroll={!isOnOverview}
            style={{
              ...baseStyle,
              opacity: isOnOverview ? 1 : 0.7,
            }}
            onClick={(e) => {
              if (isOnOverview) {
                // Scroll smooth vers la section
                e.preventDefault();
                const el = document.getElementById(tab.key);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--surface-2)'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
          >
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
