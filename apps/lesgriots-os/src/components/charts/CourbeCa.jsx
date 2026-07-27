'use client';

/**
 * Courbe de chiffre d'affaires — réalisé et prévisionnel.
 *
 * Deux séries, une seule teinte. Le réalisé est un trait plein à l'encre, le
 * prévisionnel un trait pointillé en gris : la distinction ne repose donc pas
 * sur la couleur seule, ce qui la garde lisible en daltonisme, à l'impression
 * et en thème sombre. L'or est réservé au repère « aujourd'hui », le seul
 * point de l'écran qui demande de se situer.
 *
 * Le tableau des chiffres reste accessible sous la courbe : une courbe n'est
 * jamais la seule façon de lire une donnée.
 */

import { useMemo, useRef, useState } from 'react';

const euros = (n) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(n || 0);

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function libelle(cle, pas) {
  if (pas === 'mois') {
    const [a, m] = cle.split('-');
    return `${MOIS[Number(m) - 1]} ${a.slice(2)}`;
  }
  const [, m, j] = cle.split('-');
  return `${j}/${m}`;
}

function Pastille({ x, y, hauteur, fond, trait, taille, titre }) {
  return (
    <span
      title={titre}
      style={{
        position: 'absolute', left: `${x}%`, top: (y / 100) * hauteur,
        width: taille, height: taille, marginLeft: -taille / 2, marginTop: -taille / 2,
        borderRadius: '50%', background: fond, border: `2px solid ${trait}`,
        boxSizing: 'border-box', pointerEvents: 'none',
      }}
    />
  );
}

export default function CourbeCa({ serie, aujourdhui, hauteur = 260 }) {
  const [survol, setSurvol] = useState(null);
  const [tableau, setTableau] = useState(false);
  const svgRef = useRef(null);

  const points = serie?.points || [];
  const geo = useMemo(() => {
    if (points.length < 2) return null;
    const max = Math.max(...points.map((p) => p.previsionnel), 1);
    const l = 100, h = 100;              // repère normalisé, mis à l'échelle par le viewBox
    const x = (i) => (i / (points.length - 1)) * l;
    const y = (v) => h - (v / max) * h;
    const chemin = (cle) => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(p[cle]).toFixed(2)}`).join(' ');
    const iAuj = points.findIndex((p) => p.cle >= aujourdhui.slice(0, p.cle.length));
    return { max, x, y, realise: chemin('realise'), previsionnel: chemin('previsionnel'), iAuj };
  }, [points, aujourdhui]);

  if (!geo) {
    return (
      <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '28px 0' }}>
        Pas encore assez d’historique pour tracer une courbe sur cette durée.
      </div>
    );
  }

  const dernier = points[points.length - 1];
  const surIndex = survol != null ? survol : null;

  const bougerSouris = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const ratio = (e.clientX - r.left) / r.width;
    setSurvol(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
  };

  return (
    <div>
      {/* Légende — toujours présente dès deux séries. */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
          <svg width="20" height="8" aria-hidden="true"><line x1="0" y1="4" x2="20" y2="4" stroke="var(--text)" strokeWidth="2" /></svg>
          Réalisé
          <b style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{euros(serie.total_realise)}</b>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-2)' }}>
          <svg width="20" height="8" aria-hidden="true"><line x1="0" y1="4" x2="20" y2="4" stroke="var(--text-3)" strokeWidth="2" strokeDasharray="4 3" /></svg>
          Prévisionnel
          <b style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
            {serie.total_previsionnel ? '+ ' + euros(serie.total_previsionnel) : '—'}
          </b>
        </span>
        <button
          onClick={() => setTableau((t) => !t)}
          style={{
            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-3)', fontSize: 11.5, fontFamily: 'inherit', textDecoration: 'underline',
            textUnderlineOffset: 3, padding: 0,
          }}
        >
          {tableau ? 'Masquer les chiffres' : 'Voir les chiffres'}
        </button>
      </div>

      <div style={{ position: 'relative' }}>
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label="Chiffre d’affaires réalisé et prévisionnel"
          style={{ width: '100%', height: hauteur, display: 'block', overflow: 'visible' }}
          onMouseMove={bougerSouris}
          onMouseLeave={() => setSurvol(null)}
        >
          {/* Grille discrète : quatre repères, rien de plus. */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line key={t} x1="0" x2="100" y1={100 - t * 100} y2={100 - t * 100}
                  stroke="var(--border)" strokeWidth="0.3" strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" />
          ))}

          {/* Le prévisionnel passe dessous : c'est l'enveloppe, pas le fait. */}
          <path d={geo.previsionnel} fill="none" stroke="var(--text-3)" strokeWidth="2"
                strokeDasharray="5 4" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          <path d={geo.realise} fill="none" stroke="var(--text)" strokeWidth="2"
                vectorEffect="non-scaling-stroke" strokeLinecap="round" />

          {/* Aujourd'hui : le seul or de la figure. */}
          {geo.iAuj >= 0 && (
            <line x1={geo.x(geo.iAuj)} x2={geo.x(geo.iAuj)} y1="0" y2="100"
                  stroke="var(--gold)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity="0.55" />
          )}

          {/* Croix de lecture au survol. */}
          {surIndex != null && (
            <line x1={geo.x(surIndex)} x2={geo.x(surIndex)} y1="0" y2="100"
                  stroke="var(--text-3)" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.5" />
          )}
        </svg>

        {/* Les pastilles sont posées en HTML : dans un SVG étiré en largeur,
            un cercle deviendrait une ellipse. */}
        {geo.iAuj >= 0 && (
          <Pastille x={geo.x(geo.iAuj)} y={geo.y(points[geo.iAuj].realise)} hauteur={hauteur}
                    fond="var(--gold)" trait="var(--text)" taille={11} titre="Aujourd’hui" />
        )}
        {surIndex != null && (
          <>
            <Pastille x={geo.x(surIndex)} y={geo.y(points[surIndex].previsionnel)} hauteur={hauteur}
                      fond="var(--surface)" trait="var(--text-3)" taille={9} />
            <Pastille x={geo.x(surIndex)} y={geo.y(points[surIndex].realise)} hauteur={hauteur}
                      fond="var(--surface)" trait="var(--text)" taille={9} />
          </>
        )}

        {/* Infobulle */}
        {surIndex != null && (
          <div style={{
            position: 'absolute', top: 0,
            left: `calc(${geo.x(surIndex)}% + ${geo.x(surIndex) > 60 ? -160 : 12}px)`,
            background: 'var(--surface)', border: '1px solid var(--border-2)',
            borderRadius: 8, padding: '9px 11px', pointerEvents: 'none',
            boxShadow: 'var(--shadow-sm)', minWidth: 140,
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5,
            }}>
              {libelle(points[surIndex].cle, serie.pas)}
            </div>
            <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 14 }}>
              <span>Réalisé</span>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{euros(points[surIndex].realise)}</b>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', justifyContent: 'space-between', gap: 14 }}>
              <span>Prévisionnel</span>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{euros(points[surIndex].previsionnel)}</b>
            </div>
          </div>
        )}
      </div>

      {/* Axe des abscisses : quelques repères, jamais tous. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        {[0, Math.floor(points.length / 2), points.length - 1].map((i) => (
          <span key={i} style={{
            fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--text-3)',
          }}>{libelle(points[i].cle, serie.pas)}</span>
        ))}
      </div>

      {tableau && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
          <thead>
            <tr>
              {['Période', 'Réalisé', 'Prévisionnel'].map((h, i) => (
                <th key={h} style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 400,
                  textAlign: i ? 'right' : 'left', padding: '8px 10px',
                  borderBottom: '1px solid var(--border-2)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.cle}>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}>
                  {libelle(p.cle, serie.pas)}
                </td>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', fontSize: 12.5, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {p.realise ? euros(p.realise) : '—'}
                </td>
                <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', fontSize: 12.5, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>
                  {p.previsionnel ? euros(p.previsionnel) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
