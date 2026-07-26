'use client';
/**
 * EmptyState — état vide, jamais "il n'y a rien" mais toujours
 * un message avec un peu de personnalité + une action si possible.
 *
 * Props :
 *   icon    : élément React (emoji, SVG, lucide icon)
 *   title   : titre (court, ex. "Aucun projet en négo")
 *   message : sous-texte explicatif
 *   action  : élément React (typiquement <Button />)
 *   tone    : 'neutral' (def) | 'success' (rien à faire = bonne nouvelle)
 *   compact : version condensée pour intra-card
 */
export default function EmptyState({
  icon = '✦',
  title,
  message,
  action,
  tone = 'neutral',
  compact = false,
  style = {},
}) {
  const accentColor = tone === 'success' ? 'var(--success)' : 'var(--text-3)';

  if (compact) {
    return (
      <div style={{
        textAlign: 'center',
        padding: 'var(--sp-4) var(--sp-3)',
        color: 'var(--text-3)',
        fontSize: 12,
        fontStyle: 'italic',
        ...style,
      }}>
        <span style={{ marginRight: 6, fontStyle: 'normal', color: accentColor }}>{icon}</span>
        {title || message}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: 'var(--sp-8) var(--sp-5)',
      textAlign: 'center',
      ...style,
    }}>
      <div style={{
        fontSize: 32,
        opacity: 0.5,
        color: accentColor,
        lineHeight: 1,
      }}>{icon}</div>
      {title && (
        <div style={{
          fontSize: 15,
          fontWeight: 500,
          color: 'var(--text-2)',
          fontFamily: 'var(--font-title)',
          letterSpacing: 0.2,
        }}>{title}</div>
      )}
      {message && (
        <div style={{
          fontSize: 12,
          color: 'var(--text-3)',
          maxWidth: 320,
          lineHeight: 1.5,
        }}>{message}</div>
      )}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}
