/* global React */
// Stickers easter egg — a tiny sticker hotspot lives in the bottom-right
// corner. Click it and a full-size sticker "slaps" onto a random spot of
// the page at a random angle. Each placed sticker has a [X] handle to
// peel it off. Positions persist across reloads via localStorage.

const STICKER_KEY = "lgs.stickers";

function loadStickers() {
  try {
    const raw = localStorage.getItem(STICKER_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
function saveStickers(list) {
  try { localStorage.setItem(STICKER_KEY, JSON.stringify(list)); } catch (e) {}
}

function StickerLayer() {
  const [stickers, setStickers] = React.useState(loadStickers);
  const idRef = React.useRef(1);

  React.useEffect(() => { saveStickers(stickers); }, [stickers]);

  // bump idRef past existing IDs so new ones don't collide
  React.useEffect(() => {
    if (stickers.length) {
      const maxId = stickers.reduce((m, s) => Math.max(m, s.id || 0), 0);
      idRef.current = maxId + 1;
    }
  }, []);

  function slap() {
    // random position within viewport, avoiding the very edges
    const sz = 220;
    const x = Math.round(8 + Math.random() * 84); // % of viewport width
    const y = Math.round(12 + Math.random() * 76);
    const rot = Math.round((Math.random() - 0.5) * 40); // -20 to +20 deg
    const scale = 0.7 + Math.random() * 0.45;
    setStickers((s) => [
      ...s,
      { id: idRef.current++, x, y, rot, scale, size: sz },
    ]);
  }

  function remove(id) {
    setStickers((s) => s.filter((x) => x.id !== id));
  }

  function clearAll() {
    setStickers([]);
  }

  return (
    <React.Fragment>
      {/* Placed stickers layer */}
      <div className="sticker-layer" aria-hidden={stickers.length === 0}>
        {stickers.map((s) => (
          <div
            key={s.id}
            className="placed-sticker"
            style={{
              left: s.x + "vw",
              top: s.y + "vh",
              transform: `translate(-50%, -50%) rotate(${s.rot}deg) scale(${s.scale})`,
              width: s.size + "px",
            }}
          >
            <img src="img/sticker.png" alt="" />
            <button
              className="placed-sticker__close"
              onClick={(e) => { e.stopPropagation(); remove(s.id); }}
              aria-label="Peel off">
              [×]
            </button>
          </div>
        ))}
      </div>

      {/* Tiny clickable hotspot in the bottom-right corner */}
      <button
        className="sticker-hotspot"
        onClick={slap}
        title="Slap a sticker"
        aria-label="Place a sticker on the page">
        <img src="img/sticker.png" alt="" />
      </button>

      {/* Clear-all link only appears when there are stickers placed */}
      {stickers.length > 0 && (
        <button
          className="sticker-clear"
          onClick={clearAll}
          title="Remove all stickers">
          PEEL ALL [×]
        </button>
      )}
    </React.Fragment>
  );
}

window.StickerLayer = StickerLayer;
