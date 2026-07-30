'use client';

/**
 * Bloc — une carte qui porte un titre et une phrase.
 *
 * C'est le motif le plus répété de l'OS : une carte, un `<h2>`, un paragraphe
 * gris qui dit à quoi sert la section, puis le contenu. Il était réécrit à la
 * main sur chaque écran, avec à chaque fois une marge différente entre le
 * titre et le chapeau.
 *
 *   <Bloc titre="Formation professionnelle"
 *         chapeau="Ces trois lignes partent telles quelles dans le BPF.">
 *     …
 *   </Bloc>
 *
 * `actions` se pose à droite du titre : c'est là qu'on attend le bouton qui
 * concerne la section, et nulle part ailleurs.
 */

import Card from './Card';

export default function Bloc({
  titre,
  chapeau,
  actions,
  padding = 'md',
  gap = 16,
  children,
  style = {},
  ...reste
}) {
  return (
    <Card padding={padding} style={style} {...reste}>
      {(titre || actions) && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 14, flexWrap: 'wrap', marginBottom: children ? gap : 0,
        }}
        >
          <div style={{ minWidth: 0 }}>
            {titre && <h2 className="lg-bloc__titre">{titre}</h2>}
            {chapeau && <p className="lg-bloc__chapeau">{chapeau}</p>}
          </div>
          {actions && (
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', flexShrink: 0 }}>{actions}</div>
          )}
        </div>
      )}
      {children}
    </Card>
  );
}

/**
 * Pile — l'empilement vertical régulier d'une page.
 *
 * Chaque écran ouvrait un `<div style={{ display: 'flex', flexDirection:
 * 'column', gap: 16 }}>` en tête de page. Autant le nommer.
 */
export function Pile({ gap = 16, children, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
      {children}
    </div>
  );
}

/**
 * Page — la marge de contenu, identique partout, sous la barre de titre.
 */
export function Page({ children, large = false, style = {} }) {
  return (
    <div style={{
      padding: '0 24px 48px',
      maxWidth: large ? 'none' : 'var(--content-max)',
      width: '100%',
      boxSizing: 'border-box',
      ...style,
    }}
    >
      {children}
    </div>
  );
}
