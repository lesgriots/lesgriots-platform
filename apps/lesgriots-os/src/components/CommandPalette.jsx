'use client';
/**
 * CommandPalette — recherche globale + actions rapides via ⌘K.
 *
 * - Ouverture : ⌘K ou Ctrl+K
 * - Navigation : ↑ ↓ Enter Esc
 * - Recherche : entreprises, formations, sessions, apprenants
 * - Actions rapides : les écrans de l'organisme de formation
 *
 * Les projets, les prestataires et le pipeline de l'agence ont quitté cet OS
 * avec le Studio (apps/studio-os). Les entreprises, elles, restent : c'est la
 * même table que les « clients » d'hier, vue depuis la formation, et la fiche
 * s'ouvre désormais sur /entreprises.
 */
import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui';
import { sessionHref } from '@/lib/navigation';

const ENTITY_ICON = {
  client: '🏢',
  formation: '📚',
  session: '📅',
  apprenant: '🎓',
  action: '⚡',
};

const ENTITY_LABEL = {
  client: 'Entreprise',
  formation: 'Formation',
  session: 'Session',
  apprenant: 'Apprenant',
  action: 'Action',
};

// Actions disponibles partout
const ACTIONS = [
  { id: 'act-apercu',      label: "Vue d'ensemble",        href: '/apercu',           icon: '◎' },
  { id: 'act-tunnel',      label: 'Tunnel de vente',       href: '/pipeline-formations', icon: '⊞' },
  { id: 'act-inscriptions', label: 'Inscriptions à suivre', href: '/inscriptions',    icon: '✎' },
  { id: 'act-sessions',    label: 'Voir les sessions',     href: '/sessions-list',    icon: '📅' },
  { id: 'act-agenda',      label: 'Agenda',                href: '/agenda',           icon: '🕑' },
  { id: 'act-apprenants',  label: 'Voir les apprenants',   href: '/apprenants',       icon: '🎓' },
  { id: 'act-entreprises', label: 'Voir les entreprises',  href: '/entreprises',      icon: '🏢' },
  { id: 'act-catalogue',   label: 'Catalogue de formations', href: '/catalogue',      icon: '📚' },
  { id: 'act-qualite',     label: 'Qualiopi',              href: '/qualite',          icon: '✓' },
  { id: 'act-settings',    label: 'Réglages',              href: '/settings',         icon: '⚙' },
];

function fuzzyScore(haystack, needle) {
  if (!needle) return 1;
  const h = (haystack || '').toLowerCase();
  const n = needle.toLowerCase();
  if (h === n) return 1000;
  if (h.startsWith(n)) return 500;
  if (h.includes(n)) return 200;
  // Char-by-char subseq match
  let hi = 0, score = 0;
  for (const c of n) {
    const idx = h.indexOf(c, hi);
    if (idx < 0) return 0;
    score += (idx === hi) ? 5 : 1;
    hi = idx + 1;
  }
  return score;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [data, setData] = useState({ clients: [], formations: [], sessions: [], apprenants: [] });
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const router = useRouter();

  // ⌘K / Ctrl+K global
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape' && open) {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Charger la data à la 1ère ouverture
  useEffect(() => {
    if (!open || (data.formations.length > 0)) return;
    setLoading(true);
    Promise.all([
      fetch('/api/data').then(r => r.json()).catch((e) => { console.warn('[CommandPalette] /api/data échoué :', e); return {}; }),
      fetch('/api/formations').then(r => r.json()).catch((e) => { console.warn('[CommandPalette] /api/formations échoué :', e); return []; }),
      fetch('/api/sessions').then(r => r.json()).catch((e) => { console.warn('[CommandPalette] /api/sessions échoué :', e); return []; }),
      fetch('/api/apprenants').then(r => r.json()).catch((e) => { console.warn('[CommandPalette] /api/apprenants échoué :', e); return []; }),
    ]).then(([all, formations, sessions, apprenants]) => {
      setData({
        clients: all.clients || [],
        formations: Array.isArray(formations) ? formations : [],
        sessions: Array.isArray(sessions) ? sessions : [],
        apprenants: Array.isArray(apprenants) ? apprenants : [],
      });
      setLoading(false);
    }).catch((e) => { console.warn('[CommandPalette] Chargement échoué :', e); setLoading(false); });
  }, [open, data.formations.length]);

  // Focus input à l'ouverture
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Results scoring
  const results = useMemo(() => {
    const q = query.trim();
    const out = [];

    // Clients
    for (const c of data.clients) {
      const name = c.company || `${c.firstName || ''} ${c.lastName || ''}`.trim();
      const s = Math.max(
        fuzzyScore(name, q),
        fuzzyScore(c.email, q) * 0.5,
      );
      if (s > 0) out.push({
        id: 'c_' + c.id,
        type: 'client',
        title: name || '—',
        subtitle: c.email || c.phone || '',
        href: `/entreprises/${c.id}`,
        score: s,
      });
    }
    // Formations
    for (const f of data.formations) {
      const s = Math.max(
        fuzzyScore(f.title || f.name, q),
        fuzzyScore(f.code, q) * 1.2,
      );
      if (s > 0) out.push({
        id: 'f_' + f.id,
        type: 'formation',
        title: f.title || f.name || '—',
        subtitle: f.code || '',
        href: `/formations`,
        score: s,
      });
    }
    // Sessions
    for (const s_ of data.sessions) {
      const ssc = Math.max(
        fuzzyScore(s_.code_interne, q) * 1.5,
        fuzzyScore(s_.session_name, q),
      );
      if (ssc > 0) out.push({
        id: 's_' + s_.id,
        type: 'session',
        title: s_.session_name || s_.code_interne || `Session ${(s_.id || '').slice(0, 8)}`,
        subtitle: `${s_.code_interne || ''} · ${s_.start_date || ''}`,
        href: sessionHref(s_.id),
        score: ssc,
      });
    }
    // Apprenants
    for (const a of data.apprenants) {
      const name = `${a.firstName || a.first_name || ''} ${a.lastName || a.last_name || ''}`.trim();
      const ssc = Math.max(
        fuzzyScore(name, q),
        fuzzyScore(a.email, q) * 0.6,
      );
      if (ssc > 0) out.push({
        id: 'a_' + a.id,
        type: 'apprenant',
        title: name || '—',
        subtitle: a.email || '',
        href: `/apprenants`,
        score: ssc,
      });
    }

    // Actions rapides (si query courte ou matche)
    for (const a of ACTIONS) {
      const s = q ? fuzzyScore(a.label, q) : 0.5;
      if (s > 0) out.push({
        id: a.id, type: 'action',
        title: a.label, subtitle: a.href,
        href: a.href, icon: a.icon, score: s,
      });
    }

    return out.sort((a, b) => b.score - a.score).slice(0, 25);
  }, [query, data]);

  // Reset selection si results change
  useEffect(() => { setSelectedIdx(0); }, [query]);

  // Scroll vers la sélection
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  const navigate = (href) => {
    setOpen(false);
    router.push(href);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const sel = results[selectedIdx];
      if (sel) navigate(sel.href);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Recherche globale"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--overlay)',
        zIndex: 1500,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        className="lg-anim-rise"
        style={{
          width: 'min(620px, calc(100vw - 32px))',
          maxHeight: '70vh',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 16, color: 'var(--text-3)' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Rechercher un projet, client, prestataire, formation, action…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text)', fontSize: 14, fontFamily: 'var(--font-sans)',
            }}
          />
          <kbd style={{
            fontSize: 10, padding: '2px 6px',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 4, color: 'var(--text-3)',
            fontFamily: 'var(--font-mono)',
          }}>Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{
          flex: 1, overflowY: 'auto',
          padding: 4,
        }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
              Chargement…
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
              {query ? `Aucun résultat pour "${query}"` : 'Tape pour rechercher…'}
            </div>
          ) : results.map((r, i) => {
            const isSelected = i === selectedIdx;
            return (
              <div
                key={r.id}
                data-idx={i}
                onClick={() => navigate(r.href)}
                onMouseEnter={() => setSelectedIdx(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: isSelected ? 'var(--gold-soft)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background var(--duration-fast) var(--ease)',
                }}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: 12,
                  background: 'var(--surface-2)', display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, flexShrink: 0,
                }}>
                  {r.icon || ENTITY_ICON[r.type] || '·'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 500,
                    color: isSelected ? 'var(--gold-deep)' : 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {r.title}
                  </div>
                  {r.subtitle && (
                    <div style={{
                      fontSize: 11, color: 'var(--text-3)',
                      fontFamily: r.type === 'action' ? 'var(--font-mono)' : 'var(--font-sans)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.subtitle}
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: 9, padding: '2px 6px', borderRadius: 999,
                  background: 'var(--surface-2)', color: 'var(--text-3)',
                  fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                  letterSpacing: 0.4, flexShrink: 0,
                }}>
                  {ENTITY_LABEL[r.type]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface-2)',
          display: 'flex', justifyContent: 'space-between',
          fontSize: 10, color: 'var(--text-3)',
          fontFamily: 'var(--font-mono)',
        }}>
          <span>↑↓ naviguer · ↵ ouvrir</span>
          <span>{results.length} résultat{results.length > 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}
