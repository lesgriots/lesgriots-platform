/* global React */
// Screensaver — full-screen pixel-art scene after 10s idle.
// Big seated griot under a starry/dithered sky, animated frames,
// bouncing music notes, twinkling stars.

const { useEffect: useEffectS, useState: useStateS, useRef: useRefS } = React;

const PX = 8; // larger pixel size for hero scene
const PAL = {
  K: "#0d0c0a", Y: "#f6e21c", R: "#a8602e", D: "#6b3f1d",
  L: "#d9c510", W: "#f3eee5", B: "#1f1c18", S: "#262320",
};

// 24-wide × 28-tall hero griot sprite — bigger, more detail
const GRIOT_FRAMES = [
  // Frame A
  [
    "........................",
    "........KKKKKK..........",
    ".......KKKKKKKK.........",
    "......KK.KKKK.KK........",
    "......K.KKKKKK.K........",
    "......KRRRRRRRR.........",
    "......KRWKWKRWKR........",
    "......KRRRRRRRR.........",
    ".....KKKKRRRRKKK........",
    "....KK..KKKKKK..KK......",
    "....KKKKKKKKKKKKKK......",
    "...KKYYYYYYYYYYYYKK.....",
    "...KYYDDYYDDYYDDYYK.....",
    "...KYRRYYRRYYRRYYK......",
    "...KKYYDDYYDDYYDKK......",
    "....KKYYDDYYDDKK........",
    "....KKKKYYYYKKKK........",
    ".....KKKKKKKKKK.........",
    ".....KKK....KKK.........",
    "....KKKK....KKKK........",
    "....KKK......KKK........",
    "...KKK........KKK.......",
    "..KKK..........KKK......",
    "..KKK..........KKK......",
    "..KK............KK......",
    "..KK............KK......",
    ".KKK............KKK.....",
    "KKK..............KKK....",
  ],
  // Frame B — hands lifted, strumming
  [
    "........................",
    "........KKKKKK..........",
    ".......KKKKKKKK.........",
    "......KK.KKKK.KK........",
    "......K.KKKKKK.K........",
    "......KRRRRRRRR.........",
    "......KRWKWKRWKR........",
    "......KRRRRRRRR.........",
    "....KKKKKRRRRKKKKK......",
    "...KKYK..KKKKKK..KYK....",
    "...KYKKKKKKKKKKKKKYK....",
    "...KYYYYYYYYYYYYYYYK....",
    "...KYDDYYDDYYDDYYDDK....",
    "...KYRRYYRRYYRRYYRRK....",
    "...KKYYDDYYDDYYDDYKK....",
    "....KKYYDDYYDDYYKK......",
    "....KKKKYYYYYYKKKK......",
    ".....KKKKKKKKKKKK.......",
    ".....KKK....KKK.........",
    "....KKKK....KKKK........",
    "....KKK......KKK........",
    "...KKK........KKK.......",
    "..KKK..........KKK......",
    "..KKK..........KKK......",
    "..KK............KK......",
    "..KK............KK......",
    ".KKK............KKK.....",
    "KKK..............KKK....",
  ],
  // Frame C — note floating
  [
    "........................",
    "........KKKKKK..........",
    ".......KKKKKKKK......YY.",
    "......KK.KKKK.KK....YYY.",
    "......K.KKKKKK.K....YY..",
    "......KRRRRRRRR....YY...",
    "......KRWKWKRWKR........",
    "......KRRRRRRRR.........",
    ".....KKKKRRRRKKK........",
    "....KK..KKKKKK..KK......",
    "....KKKKKKKKKKKKKK......",
    "...KKYYYYYYYYYYYYKK.....",
    "...KYYDDYYDDYYDDYYK.....",
    "...KYRRYYRRYYRRYYK......",
    "...KKYYDDYYDDYYDKK......",
    "....KKYYDDYYDDKK........",
    "....KKKKYYYYKKKK........",
    ".....KKKKKKKKKK.........",
    ".....KKK....KKK.........",
    "....KKKK....KKKK........",
    "....KKK......KKK........",
    "...KKK........KKK.......",
    "..KKK..........KKK......",
    "..KKK..........KKK......",
    "..KK............KK......",
    "..KK............KK......",
    ".KKK............KKK.....",
    "KKK..............KKK....",
  ],
];

function PixelGriot({ frame = 0, scale = 1 }) {
  const f = GRIOT_FRAMES[frame % GRIOT_FRAMES.length];
  const rows = f.length;
  const cols = f[0].length;
  const rects = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const c = f[y][x];
      if (c === "." || !PAL[c]) continue;
      rects.push(<rect key={`${x}-${y}`} x={x * PX} y={y * PX} width={PX} height={PX} fill={PAL[c]} />);
    }
  }
  return (
    <svg
      width={cols * PX * scale}
      height={rows * PX * scale}
      viewBox={`0 0 ${cols * PX} ${rows * PX}`}
      shapeRendering="crispEdges"
      style={{ display: "block", imageRendering: "pixelated" }}
    >
      {rects}
    </svg>
  );
}

// Pixel scenery: ground, moon, stars
function PixelScene({ stars, moonPhase }) {
  return (
    <svg className="screensaver__scene" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 220">
      {/* Moon */}
      <circle cx="330" cy="50" r="22" fill="#f3eee5" />
      <circle cx="338" cy="45" r="18" fill="#0a0908" />
      {/* Stars */}
      {stars.map((s, i) => (
        <rect key={i} x={s.x} y={s.y} width="2" height="2" fill="#f3eee5" opacity={s.tw ? 1 : 0.3} />
      ))}
      {/* Horizon — pixelated mountains */}
      <path d="M0 160 L30 145 L55 155 L80 130 L120 150 L160 138 L200 148 L240 130 L280 145 L320 135 L360 150 L400 145 L400 220 L0 220 Z" fill="#1a1814" />
      <path d="M0 175 L40 168 L80 175 L130 165 L180 172 L230 165 L290 175 L340 168 L400 173 L400 220 L0 220 Z" fill="#0d0c0a" />
      {/* Ground line */}
      <rect x="0" y="195" width="400" height="2" fill="#262320" />
      <rect x="0" y="200" width="400" height="2" fill="#1a1814" opacity="0.5" />
    </svg>
  );
}

function Screensaver({ idleAfter = 10000 }) {
  const [active, setActive] = useStateS(false);
  const [frame, setFrame] = useStateS(0);
  const [tick, setTick] = useStateS(0);
  const lastInputRef = useRefS(Date.now());

  // Pre-compute stars once (memoize on activation tick)
  const stars = React.useMemo(() => {
    const s = [];
    for (let i = 0; i < 60; i++) {
      s.push({ x: Math.floor(Math.random() * 400), y: Math.floor(Math.random() * 130), tw: Math.random() > 0.4 });
    }
    return s;
  }, [tick]);

  useEffectS(() => {
    const ping = () => {
      lastInputRef.current = Date.now();
      if (active) setActive(false);
    };
    const events = ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, ping, { passive: true }));
    const id = setInterval(() => {
      if (Date.now() - lastInputRef.current >= idleAfter && !active) {
        setTick((t) => t + 1);
        setActive(true);
      }
    }, 500);
    return () => {
      events.forEach((e) => window.removeEventListener(e, ping));
      clearInterval(id);
    };
  }, [active, idleAfter]);

  // Frame animation + star twinkle
  useEffectS(() => {
    if (!active) return;
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % GRIOT_FRAMES.length);
      setTick((t) => t + 1); // re-roll twinkle
    }, 600);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <div className="screensaver" role="presentation" aria-hidden="true">
      {/* Dithered B&W noise */}
      <svg className="screensaver__bg" preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 600">
        <defs>
          <filter id="ss-noise" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="2" stitchTiles="stitch" seed="2">
              <animate attributeName="seed" from="1" to="80" dur="3s" repeatCount="indefinite" />
            </feTurbulence>
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
            <feComponentTransfer>
              <feFuncA type="discrete" tableValues="0 0 0 0 0 0 1 1" />
            </feComponentTransfer>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="#0a0908" />
        <rect width="100%" height="100%" fill="#f3eee5" filter="url(#ss-noise)" opacity="0.6" />
      </svg>

      {/* Pixel landscape scene */}
      <PixelScene stars={stars} />

      {/* Hero griot in foreground */}
      <div className="screensaver__hero">
        <PixelGriot frame={frame} scale={1} />
      </div>

      {/* Title */}
      <div className="screensaver__title">
        <div className="t-line">LESGRIOTSXSTUDIO</div>
        <div className="t-sub">MULTIDISCIPLINARY CREATIVE STUDIO · IDLE</div>
      </div>

      <div className="screensaver__hint">[ MOVE · TAP · TYPE TO RESUME ]</div>
    </div>
  );
}

window.Screensaver = Screensaver;
