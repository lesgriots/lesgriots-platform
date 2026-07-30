'use client';

/**
 * Champ — la deuxième primitive, celle qui manquait vraiment.
 *
 * Un champ, ce n'est pas un `<input>`. C'est une étiquette, un contrôle, une
 * ligne d'aide et, le cas échéant, une erreur. Ces quatre morceaux étaient
 * réécrits à la main sur chaque écran, avec à chaque fois une taille de
 * police et un espacement légèrement différents.
 *
 *   <Champ label="Objet" aide="Une phrase suffit.">
 *     <Saisie value={x} onChange={…} />
 *   </Champ>
 *
 *   <Champ label="Gravité"><Choix options={GRAVITES} …/></Champ>
 *   <Champ label="Description"><Zone rows={3} …/></Champ>
 *   <Case titre="Formation à distance" aide="Aucune adresse imprimée." …/>
 *
 * L'aide n'est pas décorative. Un champ dont personne ne sait à quoi il sert
 * finit vide, et un champ vide dans un BPF coûte une journée en fin d'année.
 */

import { useId } from 'react';

/* ── L'enveloppe : étiquette, contrôle, aide, erreur ───────────────────── */

export function Champ({ label, aide, erreur, requis = false, children, style = {} }) {
  return (
    <div className="lg-champ" style={style}>
      {label && (
        <span className="lg-champ__label">
          {label}
          {requis && <span style={{ color: 'var(--gold)', marginLeft: 3 }} aria-hidden="true">*</span>}
        </span>
      )}
      {children}
      {erreur
        ? <p className="lg-champ__erreur">{erreur}</p>
        : aide ? <p className="lg-champ__aide">{aide}</p> : null}
    </div>
  );
}

/* ── Les contrôles ─────────────────────────────────────────────────────── */

const classes = (base, { faux, compact, className }) => [
  base,
  faux ? 'lg-saisie--faux' : '',
  compact ? 'lg-saisie--compact' : '',
  className || '',
].filter(Boolean).join(' ');

export function Saisie({ faux = false, compact = false, className, ...reste }) {
  return <input className={classes('lg-saisie', { faux, compact, className })} {...reste} />;
}

export function Zone({ faux = false, className, rows = 3, ...reste }) {
  return (
    <textarea
      rows={rows}
      className={classes('lg-saisie lg-saisie--zone', { faux, className })}
      {...reste}
    />
  );
}

/**
 * Choix — un menu déroulant.
 *
 * `options` accepte les deux écritures qu'on trouve dans l'OS : une liste de
 * paires [valeur, libellé], ou une liste de chaînes quand les deux coïncident.
 */
export function Choix({ options = [], vide, faux = false, compact = false, className, children, ...reste }) {
  return (
    <select className={classes('lg-saisie', { faux, compact, className })} {...reste}>
      {vide !== undefined && <option value="">{vide}</option>}
      {options.map((o) => {
        const [valeur, libelle] = Array.isArray(o) ? o : [o, o];
        return <option key={valeur} value={valeur}>{libelle}</option>;
      })}
      {children}
    </select>
  );
}

/**
 * Case — une case à cocher qui dit ce qu'elle change.
 *
 * Le titre nomme, l'aide explique la conséquence. « Réalisée en sous-traitance »
 * ne veut rien dire tant qu'on n'ajoute pas que le chiffre d'affaires ne se
 * déclare pas au même endroit.
 */
export function Case({ coche = false, sur, titre, aide, disabled = false }) {
  const id = useId();
  return (
    <label className="lg-case" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={coche}
        disabled={disabled}
        onChange={(e) => sur?.(e.target.checked)}
      />
      <span>
        <span className="lg-case__titre">{titre}</span>
        {aide && <span className="lg-case__aide">{aide}</span>}
      </span>
    </label>
  );
}

/** Une grille de champs qui se replie toute seule. */
export function Grille({ min = 240, gap = 16, children, style = {} }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`,
      gap,
      ...style,
    }}
    >
      {children}
    </div>
  );
}

export default Champ;
