'use client';

/**
 * Le chrome de la maquette Digiforma, en deux pièces.
 *
 * Le dossier de passation décrit un bandeau encre et une barre segmentée
 * « communs aux cinq écrans ». Communs veut dire : écrits une fois. Copiés
 * d'un écran à l'autre, ils divergeraient au premier ajustement, et on se
 * retrouverait avec cinq bandeaux qui se ressemblent sans être identiques.
 *
 * L'encre reste encre en thème clair. Ce n'est pas un fond de thème, c'est
 * une surface : d'où les couleurs de texte « sur encre », qui ne bougent pas
 * quand on bascule le thème.
 */

export function BandeauEncre({ surTitre, titre, phrase, chiffres = [] }) {
  return (
    <section style={{
      background: 'var(--grad-ink)', color: 'var(--on-ink)',
      borderRadius: 'var(--radius-section)', padding: '26px 28px',
      boxShadow: 'var(--shadow-ink)',
    }}>
      {surTitre && (
        <div style={etiquette}>{surTitre}</div>
      )}
      <h1 style={{
        margin: '8px 0', fontSize: 30, fontWeight: 600,
        letterSpacing: '-0.035em', lineHeight: 1.12,
      }}>{titre}</h1>
      {phrase && (
        <p style={{
          margin: `0 0 ${chiffres.length ? 22 : 0}px`, fontSize: 14,
          color: 'var(--on-ink-3)', maxWidth: '72ch', textWrap: 'pretty',
        }}>{phrase}</p>
      )}
      {chiffres.length > 0 && (
        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
          {chiffres.map(({ label, valeur, couleur }) => (
            <div key={label}>
              <div style={etiquette}>{label}</div>
              <div style={{
                marginTop: 4, fontSize: 20, fontWeight: 700, letterSpacing: '-0.03em',
                fontVariantNumeric: 'tabular-nums', color: couleur || 'var(--on-ink)',
              }}>{valeur}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const etiquette = {
  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 800,
  letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--on-ink-3)',
};

/**
 * La barre segmentée.
 *
 * Un segment par étape, large en proportion de ce qu'il pèse. Elle dit d'un
 * coup d'œil où se trouve la matière, argent ou sessions, sans qu'on ait à
 * changer d'écran pour le savoir.
 *
 * `segments` : [{ cle, label, detail, poids, base, clair, texte, point }]
 * `point` allume une pastille d'alerte dans le coin du segment.
 */
export function BarreSegmentee({ segments = [] }) {
  const total = segments.reduce((t, s) => t + (s.poids || 0), 0) || 1;
  const dernier = segments.length - 1;

  return (
    <div style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 2 }}>
      {segments.map((s, i) => (
        <div key={s.cle} style={{
          flex: `1 1 ${Math.max(14, Math.round(((s.poids || 0) / total) * 100))}%`,
          minWidth: 150, position: 'relative',
          background: `linear-gradient(140deg, ${s.clair} 0%, ${s.base} 100%)`,
          color: s.texte || '#ffffff', padding: '13px 15px',
          borderRadius: i === 0 ? '11px 3px 3px 11px' : i === dernier ? '3px 11px 11px 3px' : 3,
        }}>
          {s.point && (
            <span aria-hidden style={{
              position: 'absolute', top: 9, right: 9, width: 7, height: 7,
              borderRadius: '50%', background: 'var(--danger-on-ink)',
            }} />
          )}
          <div style={{
            fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{s.label}</div>
          <div style={{
            fontSize: 11.5, opacity: 0.78, marginTop: 2,
            fontVariantNumeric: 'tabular-nums',
          }}>{s.detail}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * La barre segmentée cliquable, qui pilote un onglet.
 *
 * Même grammaire que la barre d'information, mais elle décide de ce qu'on
 * regarde. Le segment actif porte le liseré blanc interne décrit par le
 * dossier de passation : c'est ce trait, et non la couleur, qui dit « vous
 * êtes ici », parce que chaque segment a déjà sa propre couleur.
 *
 * `onglets` : [{ cle, label, detail, base, clair, texte }]
 */
export function BarreOnglets({ onglets = [], actif, onChoisir }) {
  const dernier = onglets.length - 1;
  return (
    <div role="tablist" style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 2 }}>
      {onglets.map((o, i) => {
        const ici = o.cle === actif;
        return (
          <button
            key={o.cle} type="button" role="tab" aria-selected={ici}
            onClick={() => onChoisir?.(o.cle)}
            style={{
              flex: '1 1 0', minWidth: 150, border: 0, cursor: 'pointer',
              fontFamily: 'inherit', textAlign: 'left',
              background: `linear-gradient(140deg, ${o.clair} 0%, ${o.base} 100%)`,
              color: o.texte || '#ffffff', padding: '13px 15px',
              borderRadius: i === 0 ? '11px 3px 3px 11px' : i === dernier ? '3px 11px 11px 3px' : 3,
              boxShadow: ici ? 'inset 0 -4px 0 rgba(255,255,255,.85)' : 'none',
              opacity: ici ? 1 : 0.82,
              transition: 'opacity .2s var(--ease-da), box-shadow .2s var(--ease-da)',
            }}
          >
            <div style={{
              fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{o.label}</div>
            {o.detail && (
              <div style={{ fontSize: 11.5, opacity: 0.78, marginTop: 2 }}>{o.detail}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Le bandeau de sous-onglets, teinté par l'onglet actif.
 *
 * Le fond reprend la couleur de l'étape à douze pour cent : la parenté se lit
 * sans qu'on ait à répéter la couleur pleine, qui écraserait le contenu.
 */
export function SousOnglets({ sous = [], actif, onChoisir, couleur = 'var(--ink)' }) {
  return (
    <div style={{
      display: 'flex', gap: 4, borderRadius: 12, padding: 5, overflowX: 'auto',
      background: `color-mix(in srgb, ${couleur} 12%, transparent)`,
    }}>
      {sous.map(([cle, label]) => {
        const ici = cle === actif;
        return (
          <button
            key={cle} type="button" onClick={() => onChoisir?.(cle)}
            style={{
              flex: '1 0 auto', border: 0, cursor: 'pointer', fontFamily: 'inherit',
              borderRadius: 9, padding: '11px 18px', fontSize: 12.5, fontWeight: 800,
              whiteSpace: 'nowrap',
              background: ici ? couleur : 'transparent',
              color: ici ? '#ffffff' : 'var(--text-2)',
              transition: 'background .2s var(--ease-da), color .2s var(--ease-da)',
            }}
          >{label}</button>
        );
      })}
    </div>
  );
}
