'use client';

/**
 * Interrupteur — la sixième primitive.
 *
 * Une bascule, ce n'est pas une case à cocher. La case enregistre un choix
 * dans un formulaire qu'on validera ; l'interrupteur allume ou éteint quelque
 * chose, tout de suite. Les deux méritent deux dessins, pas trois chacun.
 *
 *   <Interrupteur actif={x} sur={setX} titre="Rappel automatique"
 *                 aide="Sept jours avant le premier module." />
 *
 * Sans `titre`, il ne rend que la bascule, pour les cas où l'étiquette vit
 * ailleurs, dans un en-tête de tableau par exemple.
 *
 * L'or dit allumé, partout dans l'OS. Le pouce garde l'encre de l'or : c'est
 * la seule teinte qui tienne le contraste sur du jaune vif, en thème encre
 * comme en thème papier.
 */

export default function Interrupteur({
  actif = false,
  sur,
  titre,
  aide,
  disabled = false,
  label,
  style = {},
}) {
  const bascule = (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={label || titre}
      disabled={disabled}
      onClick={() => sur?.(!actif)}
      className="lg-inter"
      style={titre ? { marginTop: 2, ...style } : style}
    >
      <span className="lg-inter__pouce" />
    </button>
  );

  if (!titre) return bascule;

  return (
    <label className="lg-inter-ligne">
      {bascule}
      <span>
        <span className="lg-inter-ligne__titre">{titre}</span>
        {aide && <span className="lg-inter-ligne__aide">{aide}</span>}
      </span>
    </label>
  );
}
