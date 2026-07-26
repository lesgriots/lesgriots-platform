'use client';
/**
 * SectionTitle — header de section/panel cohérent.
 *
 * Props :
 *   title    : titre principal
 *   subtitle : sous-texte optionnel à droite
 *   level    : 'h1' | 'h2' (def) | 'h3'
 *   right    : élément à aligner à droite (lien "Voir tout", filtre, etc.)
 *   bordered : ligne de séparation en bas (true par défaut)
 *   accent   : couleur d'accent (point coloré devant le titre)
 */
export default function SectionTitle({
  title,
  subtitle,
  level = 'h2',
  right,
  bordered = true,
  accent,
  style = {},
}) {
  const Tag = level;

  const titleStyle = {
    h1: { fontSize: 22, fontWeight: 600 },
    h2: { fontSize: 14, fontWeight: 600 },
    h3: { fontSize: 12, fontWeight: 600 },
  }[level] || { fontSize: 14, fontWeight: 600 };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      paddingBottom: bordered ? 12 : 0,
      marginBottom: bordered ? 16 : 8,
      borderBottom: bordered ? '1px solid var(--border)' : 'none',
      ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
        {accent && (
          <span style={{
            width: 6, height: 6, borderRadius: 3,
            background: accent, flexShrink: 0,
            transform: 'translateY(-2px)',
          }} />
        )}
        <Tag style={{
          margin: 0,
          color: 'var(--text)',
          fontFamily: 'var(--font-title)',
          letterSpacing: 0.3,
          ...titleStyle,
        }}>
          {title}
        </Tag>
        {subtitle && (
          <span style={{
            fontSize: 12,
            color: 'var(--text-3)',
            fontFamily: 'var(--font-mono)',
          }}>
            {subtitle}
          </span>
        )}
      </div>
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div>}
    </div>
  );
}

/**
 * SubLabel — petit label uppercase pour sous-sections d'un panel.
 */
export function SubLabel({ children, color = 'var(--text-3)', style = {} }) {
  return (
    <div style={{
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      color,
      fontFamily: 'var(--font-mono)',
      marginBottom: 8,
      marginTop: 4,
      ...style,
    }}>
      {children}
    </div>
  );
}
