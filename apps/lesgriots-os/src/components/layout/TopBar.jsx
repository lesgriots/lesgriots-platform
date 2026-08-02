'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { estGriotheque } from './ThemeSection';
import { cheminGriotheque } from '@/lib/menu';
import { sessionHref } from '@/lib/navigation';

const CATEGORY_ICONS = {
  project: '📁', client: '🏢', provider: '👤', formation: '📚', session: '📅', apprenant: '🎓',
};
const CATEGORY_LABELS = {
  project: 'Projet', client: 'Client', provider: 'Prestataire', formation: 'Formation', session: 'Session', apprenant: 'Apprenant',
};

/* Bascule thème encre (sombre, défaut) ↔ papier (clair) — persistée en localStorage */
function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.getAttribute('data-theme') === 'light');
  }, []);

  const toggle = () => {
    const next = !light;
    setLight(next);
    if (next) {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    try { localStorage.setItem('os-theme', next ? 'light' : 'dark'); } catch {}
  };

  return (
    <button
      onClick={toggle}
      className="btn-inline"
      title={light ? 'Passer en thème encre (sombre)' : 'Passer en thème papier (clair)'}
      aria-label="Changer de thème"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 32, height: 32, padding: 0,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', color: 'var(--text-3)',
        cursor: 'pointer', transition: `all var(--duration) var(--ease)`,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)'; }}
    >
      {light ? (
        /* lune — retour à l'encre */
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      ) : (
        /* soleil — passer en papier */
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      )}
    </button>
  );
}


/**
 * FilAriane — la position dans l'application, lue au-dessus du titre.
 *
 * Deux formes, comme dans Digiforma :
 *
 *   sur une liste  ·  Rapports d'activité › Amélioration continue
 *   sur une fiche  ·  ‹ Toutes mes sessions › ECOHESENS - Stratégie de…
 *
 * Sur une fiche, la première étape est un lien de retour : le chevron et le
 * libellé ramènent à la liste d'où l'on vient. Le nom de la fiche ferme le
 * chemin, tronqué s'il est long, jamais coupé au milieu d'un mot visible.
 *
 * Une route absente du menu n'affiche que la maison. Un fil inventé
 * désoriente plus qu'il ne guide.
 */
function FilAriane({ pathname, title }) {
  const griotheque = estGriotheque(pathname || '');
  const chemin = griotheque ? cheminGriotheque(pathname) : null;
  const racine = griotheque ? 'LA GRIOTHÈQUE' : 'LES GRIOTS · OS';

  const separateur = (
    <span aria-hidden="true" style={{ opacity: 0.45, margin: '0 7px' }}>›</span>
  );
  const lien = { color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap' };
  const enveloppe = {
    marginBottom: 2, display: 'flex', alignItems: 'center',
    minWidth: 0, maxWidth: '100%',
  };

  if (!chemin) {
    return (
      <div className="eyebrow" style={enveloppe}>
        <Link href={griotheque ? '/apercu' : '/'} style={lien}>{racine}</Link>
      </div>
    );
  }

  // Sur une liste, le titre de la page redit déjà la dernière étape.
  // L'apostrophe courbe et la droite disent le même mot : « Vue d’ensemble »
  // au menu et « Vue d'ensemble » en titre ne doivent pas s'afficher deux fois.
  const nu = (t) => String(t || '').trim().toLowerCase().replace(/[’']/g, "'");
  const memeMot = (a, b) => nu(a) === nu(b);

  if (!chemin.fiche) {
    return (
      <div className="eyebrow" style={enveloppe}>
        <Link href="/apercu" style={lien}>{racine}</Link>
        {separateur}
        <span style={{ whiteSpace: 'nowrap' }}>{chemin.section}</span>
        {!memeMot(chemin.page, title) && (
          <>
            {separateur}
            <span style={{ whiteSpace: 'nowrap' }}>{chemin.page}</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="eyebrow" style={enveloppe}>
      <Link href={chemin.href} style={{ ...lien, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span aria-hidden="true" style={{ opacity: 0.6 }}>‹</span>
        {chemin.page}
      </Link>
      {separateur}
      <span
        title={title}
        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
      >
        {title}
      </span>
    </div>
  );
}

// `right` : ce qu'une page veut poser à côté de la recherche (sélecteur de
// vue, filtre…). Absent, la barre est exactement celle d'avant.
export default function TopBar({ title, subtitle, right = null }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchData, setSearchData] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const searchRef = useRef(null);
  const router = useRouter();
  // Le fil d ariane annonce le monde dans lequel on se trouve.
  const pathname = usePathname();

  // Load search data once on first open
  useEffect(() => {
    if (searchOpen && !searchData) {
      Promise.all([
        fetch('/api/data').then(r => r.json()),
        fetch('/api/formations').then(r => r.json()),
        fetch('/api/sessions').then(r => r.json()),
        fetch('/api/apprenants').then(r => r.json()),
      ]).then(([data, formations, sessions, apprenants]) => {
        setSearchData({
          clients: data.clients || [],
          formations: Array.isArray(formations) ? formations : [],
          sessions: Array.isArray(sessions) ? sessions : [],
          apprenants: Array.isArray(apprenants) ? apprenants : [],
        });
      }).catch(() => {});
    }
  }, [searchOpen, searchData]);

  // Search logic
  useEffect(() => {
    if (!searchQuery || !searchData) { setResults([]); return; }
    const q = searchQuery.toLowerCase();
    const r = [];

    for (const c of searchData.clients) {
      const name = c.company || `${c.first_name} ${c.last_name}`;
      if (name.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)) {
        r.push({ type: 'client', id: c.id, title: name, sub: c.email, href: `/entreprises/${c.id}` });
      }
    }
    for (const f of searchData.formations) {
      if ((f.title || '').toLowerCase().includes(q) || (f.code || '').toLowerCase().includes(q)) {
        r.push({ type: 'formation', id: f.id, title: f.title, sub: f.code, href: '/formations' });
      }
    }
    for (const s of searchData.sessions) {
      if ((s.code || '').toLowerCase().includes(q) || (s.formateur_name || '').toLowerCase().includes(q)) {
        r.push({ type: 'session', id: s.id, title: s.code, sub: s.formateur_name, href: sessionHref(s.id) });
      }
    }
    for (const a of searchData.apprenants) {
      const name = `${a.first_name || ''} ${a.last_name || ''}`.trim();
      if (name.toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q)) {
        r.push({ type: 'apprenant', id: a.id, title: name, sub: a.email, href: '/apprenants' });
      }
    }

    setResults(r.slice(0, 12));
    setSelectedIdx(0);
  }, [searchQuery, searchData]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
  }, [searchOpen]);

  const navigate = (result) => {
    setSearchOpen(false);
    setSearchQuery('');
    router.push(result.href);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[selectedIdx]) { navigate(results[selectedIdx]); }
  };

  return (
    <>
      <header className="resp-topbar" style={{
        minHeight: 88,
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        padding: '20px 32px 18px',
        background: 'var(--bg)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
          {/* Le fil d'Ariane : d'où l'on vient, avant de dire où l'on est. */}
          <FilAriane pathname={pathname} title={title} />
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 'var(--text-3xl)',
            lineHeight: 1.05,
            letterSpacing: 'var(--tracking-snug)',
            color: 'var(--text)',
            margin: 0,
          }}>
            {title}
          </h1>
          {subtitle && (
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 400,
              fontSize: 'var(--text-md)',
              color: 'var(--text-2)',
              marginTop: 4,
              letterSpacing: 'var(--tracking-snug)',
            }}>
              {subtitle}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {right}
        <ThemeToggle />
        <button
          onClick={() => setSearchOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
            color: 'var(--text-3)', fontSize: 13, cursor: 'pointer',
            transition: `all var(--duration) var(--ease)`,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-2)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span className="resp-hide-mobile">Rechercher</span>
          <kbd className="resp-hide-mobile" style={{
            fontSize: 10, padding: '2px 5px', background: 'var(--surface-2)',
            borderRadius: 4, border: '1px solid var(--border)',
            color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
          }}>⌘K</kbd>
        </button>
        </div>
      </header>

      {/* Search Modal */}
      {searchOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'var(--overlay)',
            zIndex: 999, display: 'flex', alignItems: 'flex-start',
            justifyContent: 'center', paddingTop: '15vh',
          }}
          onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
        >
          <div
            className="resp-modal"
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(560px, calc(100vw - 32px))', background: 'var(--surface)',
              border: '1px solid var(--border-2)', borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 18px', borderBottom: '1px solid var(--border)',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Chercher un projet, client, formation..."
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: 'var(--text)', fontSize: 15, fontFamily: 'var(--font-sans)',
                }}
              />
              <kbd style={{
                fontSize: 10, padding: '2px 6px', background: 'var(--surface-2)',
                borderRadius: 4, border: '1px solid var(--border)',
                color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
              }}>ESC</kbd>
            </div>

            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {results.length > 0 ? (
                results.map((r, i) => (
                  <div
                    key={`${r.type}-${r.id}`}
                    onClick={() => navigate(r)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 18px', cursor: 'pointer',
                      background: i === selectedIdx ? 'var(--surface-2)' : 'transparent',
                      transition: 'background 100ms ease',
                    }}
                    onMouseEnter={() => setSelectedIdx(i)}
                  >
                    <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{CATEGORY_ICONS[r.type]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.title}
                      </div>
                      {r.sub && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.sub}</div>}
                    </div>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 10,
                      background: 'var(--surface-3)', color: 'var(--text-3)', fontWeight: 500,
                    }}>{CATEGORY_LABELS[r.type]}</span>
                  </div>
                ))
              ) : (
                <div style={{ padding: '24px 18px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                  {searchQuery
                    ? 'Aucun résultat'
                    : 'Tape pour chercher dans projets, clients, formations, prestataires...'
                  }
                </div>
              )}
            </div>

            {results.length > 0 && (
              <div style={{
                padding: '8px 18px', borderTop: '1px solid var(--border)',
                display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-3)',
              }}>
                <span><kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 4px', background: 'var(--surface-2)', borderRadius: 3, border: '1px solid var(--border)' }}>↑↓</kbd> naviguer</span>
                <span><kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 4px', background: 'var(--surface-2)', borderRadius: 3, border: '1px solid var(--border)' }}>↵</kbd> ouvrir</span>
                <span><kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 4px', background: 'var(--surface-2)', borderRadius: 3, border: '1px solid var(--border)' }}>esc</kbd> fermer</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
