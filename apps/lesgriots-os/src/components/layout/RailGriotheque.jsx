'use client';

import { Fragment, useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { RAIL_SECTIONS } from '@/lib/menu';
import { useMediaQuery } from '@/components/ui';
import { IconeRail } from '@/components/da/BandeauDa';

/**
 * Le rail de La Griothèque, d'après la maquette du menu.
 *
 * Quatre-vingt-huit pixels d'encre, sept sections, et un panneau qui sort au
 * survol. Trois choix de la maquette méritent d'être expliqués, parce qu'ils
 * ne sautent pas aux yeux.
 *
 * Le corail. L'or dit partout dans l'application « ici, une décision à
 * prendre » : un bouton d'action, une échéance, une relance. S'il disait
 * aussi « vous êtes ici » dans le menu, il ne dirait plus rien nulle part.
 * Le corail ne sert qu'au rail, et le rail ne sert qu'à lui.
 *
 * La forme. La section active devient un cercle de 48, les autres restent des
 * carrés arrondis de 42. Ce n'est pas décoratif : à distance de lecture, la
 * forme se distingue avant la couleur, et quelqu'un qui distingue mal les
 * couleurs voit quand même où il se trouve.
 *
 * Le panneau au survol. Il s'ouvre sans clic et se ferme après deux cent
 * vingt millisecondes, le temps de traverser l'espace entre le rail et lui
 * sans qu'il se dérobe. Chaque entrée porte un sous-titre : un menu qui se
 * contente de répéter le nom de l'écran ne renseigne personne.
 */
export default function RailGriotheque() {
  const pathname = usePathname() || '/apercu';
  const [ouvert, setOuvert] = useState(null);
  const [ancre, setAncre] = useState(94);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const largeur = isMobile ? 64 : 88;
  const fermeture = useRef(null);
  const [compteurs, setCompteurs] = useState({});

  const isActiveLink = (href) => {
    const [cible] = href.split('?');
    return pathname === cible || pathname.startsWith(`${cible}/`);
  };
  const sectionActive = RAIL_SECTIONS.find((s) => s.links.some((l) => l.href && isActiveLink(l.href)));

  useEffect(() => {
    let vivant = true;
    fetch('/api/griotheque/compteurs')
      .then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
      .then((c) => { if (vivant) setCompteurs(c || {}); });
    const surTouche = (e) => { if (e.key === 'Escape') setOuvert(null); };
    window.addEventListener('keydown', surTouche);
    const t = fermeture;
    return () => {
      vivant = false;
      window.removeEventListener('keydown', surTouche);
      clearTimeout(t.current);
    };
  }, []);

  const survoler = (id) => (e) => {
    clearTimeout(fermeture.current);
    if (ouvert === id) return;
    const bouton = e.currentTarget;
    const nav = bouton.closest('aside');
    if (nav) {
      const haut = bouton.getBoundingClientRect().top - nav.getBoundingClientRect().top;
      setAncre(Math.max(haut - 10, 12));
    }
    setOuvert(id);
  };
  const quitter = () => {
    clearTimeout(fermeture.current);
    fermeture.current = setTimeout(() => setOuvert(null), 220);
  };
  const retenir = () => clearTimeout(fermeture.current);

  const section = RAIL_SECTIONS.find((s) => s.id === ouvert);

  /* Un filet fin sépare les grands moments du parcours : ce qui précède la
     session, la session, ce qui la suit. Il évite que sept icônes se lisent
     comme une seule liste indifférenciée. */
  const FILET = { sessions: true, rapports: true };

  return (
    <aside
      aria-label="Navigation principale de La Griothèque"
      onMouseLeave={quitter}
      style={{
        position: 'sticky', top: 0, zIndex: 80,
        width: largeur, minWidth: largeur, height: '100vh',
        background: 'var(--grad-rail)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '14px 0',
      }}
    >
      <Link
        href="/apercu" aria-label="La Griothèque — vue d'ensemble"
        onClick={() => setOuvert(null)}
        style={{
          width: 40, height: 40, flex: 'none', marginBottom: 14, borderRadius: 12,
          background: 'linear-gradient(140deg, #FFD84D 0%, #ffca00 100%)',
          color: '#171407', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 800, letterSpacing: '-.04em', textDecoration: 'none',
        }}
      >LG</Link>

      <nav aria-label="Rubriques" style={{
        flex: 1, width: '100%', minHeight: 0, paddingTop: 4,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        {RAIL_SECTIONS.map((item) => {
          const ici = sectionActive?.id === item.id;
          const vise = ouvert === item.id;
          const badge = item.compteur ? compteurs[item.compteur] : 0;
          return (
            <Fragment key={item.id}>
              {FILET[item.id] && (
                <span aria-hidden style={{ width: 26, height: 1, flex: 'none', margin: '5px 0', background: 'rgba(244,241,234,.14)' }} />
              )}
              <button
                type="button"
                title={item.label}
                aria-label={item.label}
                aria-expanded={vise}
                aria-current={ici ? 'page' : undefined}
                onMouseEnter={survoler(item.id)}
                onFocus={survoler(item.id)}
                onClick={() => { const p = item.links.find((l) => l.href); if (p) window.location.assign(p.href); }}
                style={{
                  position: 'relative', flex: 'none', border: 0, cursor: 'pointer',
                  width: ici ? 48 : 42, height: ici ? 48 : 42,
                  borderRadius: ici ? '50%' : 15,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: ici ? 'linear-gradient(140deg, var(--rail-actif-clair) 0%, var(--rail-actif) 100%)'
                    : vise ? 'var(--rail-survol-fond)' : 'transparent',
                  color: ici ? '#ffffff' : vise ? 'var(--rail-survol)' : 'var(--on-ink-3)',
                  boxShadow: ici ? 'var(--rail-lueur)' : 'none',
                  transform: vise && !ici ? 'scale(1.08)' : 'none',
                  transition: 'background .22s var(--ease-da), color .22s var(--ease-da), box-shadow .22s var(--ease-da), transform .22s var(--ease-da)',
                }}
              >
                <IconeRail nom={item.id} taille={ici ? 29 : 26} trait={ici ? 1.25 : 1.1} />
                {badge > 0 && (
                  <span style={{
                    position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18,
                    borderRadius: 999, padding: '0 4px', lineHeight: 1,
                    background: ici ? 'var(--ink)' : 'var(--info)',
                    color: ici ? '#FFD1C2' : '#ffffff',
                    boxShadow: '0 0 0 2.5px var(--rail-fond)',
                    fontSize: 9.5, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{badge}</span>
                )}
              </button>
            </Fragment>
          );
        })}
      </nav>

      <Link
        href="/appareil" title="Aide, accès et appareils" aria-label="Aide, accès et appareils"
        style={{
          width: 42, height: 42, flex: 'none', marginTop: 6, borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-3)', textDecoration: 'none',
        }}
      ><IconeRail nom="aide" taille={20} trait={1.4} /></Link>

      {section && (
        <div
          role="dialog"
          aria-label={section.label}
          onMouseEnter={retenir}
          style={{
            position: 'absolute', left: 'calc(100% + 14px)', top: ancre,
            width: 340, maxWidth: `calc(100vw - ${largeur + 30}px)`,
            maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', zIndex: 50,
            background: 'rgba(255,255,255,.96)',
            backdropFilter: 'blur(18px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(18px) saturate(1.4)',
            borderRadius: 16, boxShadow: '0 26px 60px rgba(15,14,12,.30)',
            animation: 'lg-rise .2s var(--ease-da) both',
          }}
        >
          <div style={{
            background: 'linear-gradient(140deg, #232019 0%, #141310 60%, #0F0E0C 100%)',
            borderRadius: '16px 16px 0 0', padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{
              flex: 'none', width: 30, height: 30, borderRadius: 10,
              background: 'var(--rail-survol-fond)', color: 'var(--rail-survol)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><IconeRail nom={section.id} taille={16} trait={1.5} /></span>
            <span style={{
              flex: 1, fontSize: 12, fontWeight: 800, letterSpacing: '.07em',
              textTransform: 'uppercase', color: 'var(--rail-survol)',
            }}>{section.label}</span>
          </div>

          <div style={{ padding: '8px 0 12px' }}>
            {section.links.map((lien, i) => {
              if (lien.divider) {
                return <div key={`filet-${i}`} style={{ borderTop: '1px solid rgba(0,0,0,.12)', margin: '14px 20px 6px' }} />;
              }
              const ici = isActiveLink(lien.href);
              return (
                <Link
                  key={lien.href}
                  href={lien.href}
                  onClick={() => setOuvert(null)}
                  style={{
                    width: '100%', textDecoration: 'none', cursor: 'pointer',
                    padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 13,
                    background: ici ? 'var(--gold-tint-soft)' : 'transparent',
                  }}
                >
                  <span aria-hidden style={{
                    flex: 'none', width: 7, height: 7, borderRadius: '50%',
                    background: ici ? 'var(--gold-hover)' : '#d8d4cb',
                  }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      display: 'block', fontSize: 14.5, fontWeight: 700,
                      letterSpacing: '-.012em', lineHeight: 1.3,
                      color: ici ? 'var(--gold-text)' : 'var(--ink)',
                    }}>{lien.label}</span>
                    {lien.indice && (
                      <span style={{
                        display: 'block', fontSize: 11.5, marginTop: 1,
                        color: ici ? 'var(--gold-text)' : 'var(--text-3)',
                      }}>{lien.indice}</span>
                    )}
                  </span>
                  <span aria-hidden style={{ flex: 'none', color: ici ? 'var(--gold-text)' : '#b6b1a6', display: 'flex' }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
                  </span>
                </Link>
              );
            })}
            {section.footer && (
              <p style={{ margin: '12px 20px 4px', color: 'var(--text-3)', fontSize: 12.5, lineHeight: 1.5 }}>{section.footer}</p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
