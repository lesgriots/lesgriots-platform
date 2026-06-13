/* global React, useLang, tr */
// Yellow ID card — uses the real sticker artwork.
// Cliquable depuis n'importe quelle page → retour home. Au hover, un petit
// label "HOME" / "ACCUEIL" flotte en dessous (même esprit que le label
// d'une miniature de projet sur la grille Work).

function YellowCard({ onClick }) {
  const lang = useLang();
  return (
    <button className="idcard" onClick={onClick} aria-label="lesgriotsxstudio — home">
      <img src="img/sticker.png" alt="lesgriotsxstudio" className="idcard__img" />
      <span className="idcard__label" aria-hidden="true">{tr("menu.home", lang)}</span>
    </button>
  );
}

window.YellowCard = YellowCard;
