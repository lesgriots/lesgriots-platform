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
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {s.icone && <Icone nom={s.icone} taille={15} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
          </div>
          <div style={{
            fontSize: 11.5, opacity: 0.78, marginTop: 2,
            paddingLeft: s.icone ? 23 : 0,
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
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {o.icone && <Icone nom={o.icone} taille={15} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.label}</span>
            </div>
            {o.detail && (
              <div style={{ fontSize: 11.5, opacity: 0.78, marginTop: 2, paddingLeft: o.icone ? 23 : 0 }}>{o.detail}</div>
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

/**
 * Les icônes de la maquette.
 *
 * Tracées à la main dans une grille de 16, trait de 1,5, bouts et jonctions
 * arrondis, jamais remplies. Elles viennent telles quelles du dossier de
 * passation : les redessiner « à peu près » aurait donné un jeu qui ne se
 * tient pas, une épaisseur ici, un rayon là.
 *
 * `currentColor` partout : une icône prend la couleur de son texte, elle n'a
 * pas de couleur propre. C'est ce qui permet de poser la même sur fond encre
 * et sur fond papier sans y toucher.
 */
export const CHEMINS = {
  // Navigation
  tableau:     'M2.6 12a5.4 5.4 0 1 1 10.8 0M8 12l3-4.4',
  tunnel:      'M2 3.2h12l-4.8 5.6v4.6L6.8 12V8.8z',
  sessions:    'M8 13.6A5.6 5.6 0 1 0 8 2.4a5.6 5.6 0 0 0 0 11.2ZM8 10.4A2.4 2.4 0 1 0 8 5.6a2.4 2.4 0 0 0 0 4.8Z',
  bibliotheque:'M8 2.4 14.4 5.6 8 8.8 1.6 5.6 8 2.4ZM4 7.2v3.4c0 1 1.8 2 4 2s4-1 4-2V7.2',
  apprenants:  'M6 7.4a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4ZM1.8 13.4c0-2.3 1.9-3.8 4.2-3.8s4.2 1.5 4.2 3.8M11 3.3a2.2 2.2 0 0 1 0 4.2M11.6 9.8c1.6.4 2.6 1.6 2.6 3.6',
  documents:   'M9.2 1.6H4a1.4 1.4 0 0 0-1.4 1.4v10a1.4 1.4 0 0 0 1.4 1.4h8a1.4 1.4 0 0 0 1.4-1.4V5.8ZM9.2 1.6v4.2h4.2',
  indicateurs: 'M2.4 13.4V8.6M6.1 13.4V3.4M9.9 13.4V6.4M13.6 13.4v-3.2',

  // Les cinq étapes du parcours de session
  avancement:  'M2.6 11.4 6 8l2.4 2.4L13.4 5M10.4 5h3v3',
  configuration:'M5 2.6v2.2M5 7.8v5.6M11 2.6v5.6M11 11v2.4M3.2 6.3h3.6M9.2 9.4h3.6',
  gestion:     'M2.2 4.4a1 1 0 0 1 1-1h2.9l1.2 1.5h5.5a1 1 0 0 1 1 1v5.7a1 1 0 0 1-1 1H3.2a1 1 0 0 1-1-1Z',
  espace:      'M8 2.6 14.5 5.6 8 8.6 1.5 5.6 8 2.6ZM4.2 7.1v3.3c0 1 1.7 1.9 3.8 1.9s3.8-.9 3.8-1.9V7.1',
  suivi:       'M14 7.5V8a6 6 0 1 1-3.6-5.5M5.6 7.7 8 10l5.9-6.3',

  // Gestes
  valide:      'm3.5 6 4.5 4.5L12.5 6',
  alerte:      'M8 5.5v3.2M8 11h.01M6.9 2.6 1.6 11.8a1.2 1.2 0 0 0 1 1.8h10.8a1.2 1.2 0 0 0 1-1.8L9.1 2.6a1.2 1.2 0 0 0-2.2 0Z',
  oeil:        'M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8Z',
  telecharger: 'M8 2v8M4.5 7 8 10.5 11.5 7M2.5 13.5h11',
  corbeille:   'M2.8 4.4h10.4M6.4 4.4V2.9h3.2v1.5M4.2 4.4l.7 9a.7.7 0 0 0 .7.7h4.8a.7.7 0 0 0 .7-.7l.7-9',
  copie:       'M12 9.5v3.2a.8.8 0 0 1-.8.8H3.3a.8.8 0 0 1-.8-.8V4.8a.8.8 0 0 1 .8-.8h3.2M10.5 5.5V4a1.4 1.4 0 0 0-1.4-1.4H3.9A1.4 1.4 0 0 0 2.5 4v5.2a1.4 1.4 0 0 0 1.4 1.4h1.6',
  boite:       'M3.2 6v6.2a1 1 0 0 0 1 1h7.6a1 1 0 0 0 1-1V6M6.5 9h3',
  immeuble:    'M2.5 14V3.2a.7.7 0 0 1 .7-.7h6.1a.7.7 0 0 1 .7.7V14M9.9 6.4h3a.7.7 0 0 1 .7.7V14M1 14h14',
  fichier:     'M2.6 3.6a1 1 0 0 1 1-1h7L13.4 5v7.4a1 1 0 0 1-1 1H3.6a1 1 0 0 1-1-1Z',
  livre:       'M8 4.2C6.8 3.2 4.6 2.8 2.5 3v9c2.1-.2 4.3.2 5.5 1.2 1.2-1 3.4-1.4 5.5-1.2V3c-2.1-.2-4.3.2-5.5 1.2ZM8 4.2v9',
  etoile:      'm8 2 1.8 3.8 4.2.6-3 3 .7 4.2L8 11.6 4.3 13.6l.7-4.2-3-3 4.2-.6L8 2Z',
  retour:      'M9 5.5 6.5 8 9 10.5M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12Z',
};

export function Icone({ nom, taille = 15, style }) {
  const d = CHEMINS[nom];
  if (!d) return null;
  return (
    <svg
      aria-hidden="true" focusable="false"
      width={taille} height={taille} viewBox="0 0 16 16"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: `0 0 ${taille}px`, ...style }}
    >
      <path d={d} />
    </svg>
  );
}
