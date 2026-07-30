'use client';

/**
 * Bouton — la première primitive.
 *
 * Un seul bouton dans tout l'OS. Onze fichiers en déclaraient un, tous
 * presque identiques, tous légèrement différents. Le jour où l'on change la
 * forme d'un bouton, on la change ici, pas dans quarante écrans.
 *
 * Les états, survol, focus clavier, désactivé, appui, sont dans
 * `styles/primitives.css`. Ils ne peuvent pas s'écrire en style inline :
 * c'est pour ça que l'anneau de focus n'existait nulle part.
 *
 *   <Bouton>Enregistrer</Bouton>                        or plein
 *   <Bouton discret>Annuler</Bouton>                    contour
 *   <Bouton fantome petit>Fermer</Bouton>               texte seul
 *   <Bouton danger>Supprimer</Bouton>
 *   <Bouton href="/sessions/nouvelle">Créer</Bouton>    rendu en lien
 *   <Bouton occupe>Enregistrement…</Bouton>             point qui tourne
 *
 * L'ancienne interface (`variant`, `size`, `iconLeft`) reste acceptée : trente
 * fichiers l'utilisent, il n'était pas question de les casser d'un coup.
 */

import Link from 'next/link';

const VARIANTES = ['primary', 'secondary', 'ghost', 'danger'];
const TAILLES = { sm: 'sm', md: 'md', lg: 'lg' };

export default function Bouton({
  // Interface courte, celle qu'on écrit aujourd'hui.
  discret = false,
  fantome = false,
  danger = false,
  petit = false,
  grand = false,
  pleineLargeur = false,
  occupe = false,

  // Interface historique, conservée pour les écrans déjà écrits.
  variant,
  size,
  iconLeft,
  iconRight,

  href,
  disabled = false,
  type = 'button',
  className = '',
  style = {},
  onClick,
  children,
  ...reste
}) {
  const variante = VARIANTES.includes(variant)
    ? variant
    : danger ? 'danger'
      : fantome ? 'ghost'
        : discret ? 'secondary'
          : 'primary';

  const taille = TAILLES[size] || (petit ? 'sm' : grand ? 'lg' : 'md');

  const inactif = disabled || occupe;

  const classes = [
    'lg-btn',
    `lg-btn--${variante}`,
    `lg-btn--${taille}`,
    pleineLargeur ? 'lg-btn--block' : '',
    className,
  ].filter(Boolean).join(' ');

  const contenu = (
    <>
      {occupe && <span className="lg-btn__travail" aria-hidden="true" />}
      {!occupe && iconLeft && <span style={{ display: 'inline-flex' }}>{iconLeft}</span>}
      <span>{children}</span>
      {iconRight && <span style={{ display: 'inline-flex' }}>{iconRight}</span>}
    </>
  );

  // Un lien désactivé reste un lien : on le neutralise sans le transformer en
  // bouton, pour que la page ne change pas de structure d'un état à l'autre.
  if (href) {
    return (
      <Link
        href={inactif ? '#' : href}
        aria-disabled={inactif || undefined}
        tabIndex={inactif ? -1 : undefined}
        onClick={inactif ? (e) => e.preventDefault() : onClick}
        className={classes}
        style={style}
        {...reste}
      >
        {contenu}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={inactif}
      onClick={onClick}
      className={classes}
      style={style}
      {...reste}
    >
      {contenu}
    </button>
  );
}
