'use client';
/**
 * Button — bouton cohérent toutes pages.
 * variant : 'primary' (or) | 'secondary' (surface-3) | 'ghost' (texte seul) | 'danger'
 * size    : 'sm' | 'md' (def) | 'lg'
 * Props additionnelles : onClick, type, disabled, href (rend en <a>)
 */
import Link from 'next/link';

const VARIANT = {
  primary: {
    background: 'var(--gold)', color: 'var(--bg)',
    border: '1px solid var(--gold)', fontWeight: 600,
    hoverBg: 'var(--saffron-deep)', hoverBorder: 'var(--saffron-deep)',
  },
  secondary: {
    background: 'var(--surface-3)', color: 'var(--text)',
    border: '1px solid var(--border-2)', fontWeight: 500,
    hoverBg: 'var(--surface-2)', hoverBorder: 'var(--border-2)',
  },
  ghost: {
    background: 'transparent', color: 'var(--text-2)',
    border: '1px solid transparent', fontWeight: 500,
    hoverBg: 'var(--surface-2)', hoverBorder: 'transparent',
  },
  danger: {
    background: 'var(--danger-soft)', color: 'var(--danger)',
    border: '1px solid var(--danger)', fontWeight: 500,
    hoverBg: 'var(--danger)', hoverBorder: 'var(--danger)', hoverColor: 'var(--on-solid)',
  },
};

const SIZE = {
  sm: { padding: '4px 10px', fontSize: 12, height: 28 },
  md: { padding: '6px 14px', fontSize: 13, height: 34 },
  lg: { padding: '8px 18px', fontSize: 14, height: 40 },
};

export default function Button({
  variant = 'secondary',
  size = 'md',
  href,
  disabled = false,
  type = 'button',
  iconLeft,
  iconRight,
  style = {},
  onClick,
  children,
  ...rest
}) {
  const v = VARIANT[variant] || VARIANT.secondary;
  const s = SIZE[size] || SIZE.md;

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 'var(--radius-md)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontFamily: 'var(--font-sans)',
    transition: 'background var(--duration) var(--ease), border-color var(--duration) var(--ease), color var(--duration) var(--ease), transform var(--duration-fast) var(--ease)',
    textDecoration: 'none',
    background: v.background,
    color: v.color,
    border: v.border,
    fontWeight: v.fontWeight,
    ...s,
    ...style,
  };

  const onMouseEnter = (e) => {
    if (disabled) return;
    e.currentTarget.style.background = v.hoverBg;
    e.currentTarget.style.borderColor = v.hoverBorder;
    if (v.hoverColor) e.currentTarget.style.color = v.hoverColor;
  };
  const onMouseLeave = (e) => {
    if (disabled) return;
    e.currentTarget.style.background = v.background;
    e.currentTarget.style.borderColor = v.border.split(' ').slice(-1)[0];
    e.currentTarget.style.color = v.color;
  };
  const onMouseDown = (e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)'; };
  const onMouseUp   = (e) => { if (!disabled) e.currentTarget.style.transform = 'scale(1)'; };

  const inner = (
    <>
      {iconLeft && <span style={{ display: 'inline-flex' }}>{iconLeft}</span>}
      <span>{children}</span>
      {iconRight && <span style={{ display: 'inline-flex' }}>{iconRight}</span>}
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} style={base}
            onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
            onMouseDown={onMouseDown} onMouseUp={onMouseUp} {...rest}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={base}
            onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
            onMouseDown={onMouseDown} onMouseUp={onMouseUp} {...rest}>
      {inner}
    </button>
  );
}
