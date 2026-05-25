/* global React */
// Yellow ID card — uses the real sticker artwork

function YellowCard({ onClick }) {
  return (
    <button className="idcard" onClick={onClick} aria-label="lesgriotsxstudio — home">
      <img src="img/sticker.png" alt="lesgriotsxstudio" className="idcard__img" />
    </button>
  );
}

window.YellowCard = YellowCard;
