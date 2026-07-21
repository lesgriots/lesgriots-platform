/* global React, useLang, tr, Type */
// Yellow ID card — uses the real sticker artwork.
// Cliquable depuis n'importe quelle page → retour home. Au hover, un petit
// label "HOME" / "ACCUEIL" flotte en dessous avec effet typewriter (comme
// le label d'une miniature de projet sur la grille Work).

function YellowCard({ onClick }) {
  const lang = useLang();
  // hovered + seq : on remonte un seq à chaque hover pour ré-mounter le
  // composant Type, ce qui rejoue l'effet typewriter à chaque survol.
  // Sur device tactile (pas de souris), on ignore les hover events :
  // un seul tap suffit à naviguer, pas d'étape "hover" qui demanderait
  // un 2e tap. La détection se fait avec matchMedia "hover: hover".
  const hasHover = typeof window !== "undefined"
    && window.matchMedia
    && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const [hovered, setHovered] = React.useState(false);
  const [seq, setSeq] = React.useState(0);
  const hoverProps = hasHover ? {
    onMouseEnter: () => { setHovered(true); setSeq((s) => s + 1); },
    onMouseLeave: () => setHovered(false),
  } : {};
  return (
    <button
      className="idcard"
      onClick={onClick}
      aria-label="lesgriotsxstudio — home"
      {...hoverProps}
    >
      <img src="img/sticker.png" alt="lesgriotsxstudio" className="idcard__img" />
      <span className="idcard__label" aria-hidden="true">
        {hovered && (
          <Type key={"home-" + lang + "-" + seq} text={tr("sticker.home", lang)} speed={32} cursor="always" />
        )}
      </span>
    </button>
  );
}

window.YellowCard = YellowCard;
