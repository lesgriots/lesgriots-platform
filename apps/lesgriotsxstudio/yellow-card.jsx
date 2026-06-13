/* global React, useLang, tr, Type */
// Yellow ID card — uses the real sticker artwork.
// Cliquable depuis n'importe quelle page → retour home. Au hover, un petit
// label "HOME" / "ACCUEIL" flotte en dessous avec effet typewriter (comme
// le label d'une miniature de projet sur la grille Work).

function YellowCard({ onClick }) {
  const lang = useLang();
  // hovered + seq : on remonte un seq à chaque hover pour ré-mounter le
  // composant Type, ce qui rejoue l'effet typewriter à chaque survol.
  const [hovered, setHovered] = React.useState(false);
  const [seq, setSeq] = React.useState(0);
  return (
    <button
      className="idcard"
      onClick={onClick}
      onMouseEnter={() => { setHovered(true); setSeq((s) => s + 1); }}
      onMouseLeave={() => setHovered(false)}
      aria-label="lesgriotsxstudio — home"
    >
      <img src="img/sticker.png" alt="lesgriotsxstudio" className="idcard__img" />
      <span className="idcard__label" aria-hidden="true">
        {hovered && (
          <Type key={"home-" + lang + "-" + seq} text={tr("menu.home", lang)} speed={32} cursor="always" />
        )}
      </span>
    </button>
  );
}

window.YellowCard = YellowCard;
