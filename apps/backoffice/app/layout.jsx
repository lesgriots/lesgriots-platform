// Layout racine du back office.
// Aligné sur le style du site studio : Geist Mono, palette ink/yellow,
// sticker top-left, griot ASCII bottom-right.
export const metadata = {
  title: "LESGRIOTSxSTUDIO — Back Office",
};

// ASCII griot version condensée (silhouette principale) — affichée en
// bas à droite, faded, en décoration. Pas d'animation côté back office.
const ASCII_GRIOT = `              000000
          0111111111110
        0111111111111111
       0111111110111111111
      01111111101001000111
      011111111110001   111
      01001111111001     01
      00011 111000000 0 011
      00 010111 0  01   11
     1111111111   11011111
    1110111111010 101 111
010000111010111100001010 00
1001010100  11010111111010001111
010    11011111111110011
01011110 11111111111110
011 110  00  1  0010
01    0010 110  00 0010
0101 0101  0 10101 01
0  011110101 0 10110101
010  1010011101 110010
00 010     1 00 0100 1
11      10110 01  1 11001
1 111     1 10  011 11
1101    100111010100  10
1010    0111 00111100001
011     010010 011010000
001    0011001 11000010
01    011010   1 0 1011
101    0001101101001100
0011101   01 101111 001000
0101000010110101  1011101
0            100110  1 100001
01           11 010010000
11    011111111111101
01111111111111   011111111111
011111111111111
0111111111111
01111111110
0111`;

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <style>{globalCss}</style>
      </head>
      <body>
        {/* Sticker top-left — même image que le site studio */}
        <a href="/" className="bo-sticker" aria-label="Back office home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/preview?p=img/sticker.png" alt="LESGRIOTSXSTUDIO" />
        </a>

        <div className="shell">
          <header className="bo-topbar">
            <span className="bo-topbar__tag">BACK · OFFICE</span>
            <nav className="bo-nav">
              <a href="/">Projets</a>
              <span className="bo-nav__sep">·</span>
              <a href="/projects/new">+ Nouveau</a>
              <span className="bo-nav__sep">·</span>
              <a href="/site/about">Page About</a>
              <span className="bo-nav__sep">·</span>
              <a href="/site/pages">Pages actives</a>
            </nav>
          </header>
          <main>{children}</main>
        </div>

        {/* Griot ASCII bottom-right — décoration, en arrière-plan */}
        <pre className="bo-griot" aria-hidden="true">{ASCII_GRIOT}</pre>
      </body>
    </html>
  );
}

const globalCss = `
  /* ---- Fonts Geist Mono (servies via /api/preview depuis ../fonts) -- */
  @font-face {
    font-family: "Geist Mono";
    src: url("/api/preview?p=fonts/GeistMono-Regular.woff2") format("woff2");
    font-weight: 400; font-display: swap;
  }
  @font-face {
    font-family: "Geist Mono";
    src: url("/api/preview?p=fonts/GeistMono-Medium.woff2") format("woff2");
    font-weight: 500; font-display: swap;
  }
  @font-face {
    font-family: "Geist Mono";
    src: url("/api/preview?p=fonts/GeistMono-Bold.woff2") format("woff2");
    font-weight: 700; font-display: swap;
  }

  /* ---- Palette du site studio --------------------------------------- */
  :root {
    --bg: #050505;
    --ink: #8a7a20;          /* mustard gold — texte principal */
    --ink-dim: #5a5018;
    --rule: #1a1814;
    --yellow: #f6e21c;
    --yellow-deep: #d9c510;
    --danger: #ff5f56;
    --font-mono: "Geist Mono", "JetBrains Mono", "Courier New", monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: var(--bg);
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: 14px;
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }

  /* ---- Caret terminal clignotant ------------------------------------ */
  .bo-caret {
    display: inline-block;
    width: 0.55em;
    margin-left: 1px;
    color: var(--yellow);
    line-height: 1;
    animation: bo-caret-blink 1s steps(1) infinite;
  }
  @keyframes bo-caret-blink {
    0%, 49%   { opacity: 1; }
    50%, 100% { opacity: 0; }
  }

  /* ---- Préfixe prompt > devant la nav et les liens-actions ---------- */
  .bo-nav a::before {
    content: "> ";
    color: var(--ink-dim);
    opacity: 0.6;
    margin-right: 1px;
  }
  .bo-nav a:hover::before { color: var(--yellow); opacity: 1; }

  /* ---- Scanlines CRT — overlay très subtil, plein viewport ---------- */
  body::after {
    content: "";
    position: fixed;
    inset: 0;
    z-index: 999;
    pointer-events: none;
    background-image: repeating-linear-gradient(
      to bottom,
      rgba(0,0,0,0)   0px,
      rgba(0,0,0,0)   2px,
      rgba(0,0,0,0.18) 3px,
      rgba(0,0,0,0)   4px
    );
    mix-blend-mode: multiply;
    opacity: 0.45;
  }

  /* ---- Vignette CRT douce sur les bords ----------------------------- */
  body::before {
    content: "";
    position: fixed;
    inset: 0;
    z-index: 998;
    pointer-events: none;
    background: radial-gradient(ellipse at center,
      rgba(0,0,0,0) 60%,
      rgba(0,0,0,0.4) 100%);
  }

  /* ---- Sticker top-left (même position que sur le site) ------------- */
  .bo-sticker {
    position: fixed;
    top: 14px;
    left: 14px;
    width: 220px;
    z-index: 90;
    display: block;
    filter: drop-shadow(2px 4px 0 rgba(0, 0, 0, 0.35));
    transition: transform 0.35s cubic-bezier(0.2,0.7,0.2,1);
  }
  .bo-sticker:hover { transform: translate(-2px, -2px); }
  .bo-sticker img { display: block; width: 100%; height: auto; }

  /* ---- Griot ASCII bottom-right ------------------------------------- */
  .bo-griot {
    position: fixed;
    right: -10px;
    bottom: -20px;
    z-index: 0;
    color: var(--ink-dim);
    opacity: 0.45;
    font-family: var(--font-mono);
    font-size: 8px;
    line-height: 1;
    letter-spacing: 0;
    white-space: pre;
    pointer-events: none;
    transform: scale(1);
    transform-origin: bottom right;
  }

  /* ---- Layout principal --------------------------------------------- */
  /* Pleine largeur du viewport, comme le site studio. Padding gauche
     généreux pour laisser respirer le sticker. Pas de max-width. */
  .shell {
    position: relative;
    z-index: 1;
    width: 100%;
    margin: 0;
    padding: 24px 60px 200px 260px;
  }
  @media (max-width: 900px) {
    .shell { padding: 200px 18px 200px; }
  }

  /* ---- Topbar / nav ------------------------------------------------- */
  .bo-topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 0 24px;
    border-bottom: 1px solid var(--rule);
    margin-bottom: 28px;
  }
  .bo-topbar__tag {
    font-size: 11px;
    color: var(--ink-dim);
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-weight: 500;
  }
  .bo-nav { display: flex; gap: 12px; align-items: center; }
  .bo-nav a {
    color: var(--ink);
    text-decoration: none;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    transition: color 0.15s;
  }
  .bo-nav a:hover { color: var(--yellow); }
  .bo-nav__sep { color: var(--ink-dim); opacity: 0.6; font-size: 11px; }

  /* ---- Liens, boutons, formulaires ---------------------------------- */
  a { color: var(--ink); text-decoration: none; }
  a:hover { color: var(--yellow); }
  button { font: inherit; cursor: pointer; }
  input, textarea, select {
    font: inherit; color: var(--ink); background: #0f0e0a;
    border: 1px solid var(--rule); padding: 8px 10px; border-radius: 0;
    width: 100%;
  }
  input:focus, textarea:focus, select:focus {
    outline: none; border-color: var(--ink);
  }
  textarea { font-family: var(--font-mono); resize: vertical; min-height: 80px; }
  label {
    display: block; margin: 14px 0 6px;
    font-size: 11px; color: var(--ink-dim);
    text-transform: uppercase; letter-spacing: 0.14em;
  }

  /* ---- Typo titres -------------------------------------------------- */
  h1 {
    font-size: 26px;
    font-weight: 500;
    color: var(--yellow);
    margin: 0 0 18px;
    letter-spacing: -0.01em;
  }
  /* Prompt $ devant chaque titre h1 — style commande terminal */
  h1::before {
    content: "$ ";
    color: var(--ink-dim);
    opacity: 0.7;
    margin-right: 4px;
    font-weight: 400;
  }
  h2 {
    font-size: 14px;
    font-weight: 500;
    margin: 28px 0 12px;
    color: var(--ink);
    text-transform: uppercase;
    letter-spacing: 0.16em;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--rule);
  }
  /* Prompt > devant chaque h2 */
  h2::before {
    content: "> ";
    color: var(--ink-dim);
    opacity: 0.6;
    margin-right: 4px;
  }

  /* ---- Grille de formulaires --------------------------------------- */
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

  /* ---- Boutons ----------------------------------------------------- */
  .btn {
    background: var(--yellow);
    color: #000;
    border: 0;
    padding: 10px 18px;
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    transition: background 0.15s, transform 0.15s;
  }
  .btn:hover { background: #fff; transform: translateY(-1px); }
  .btn--ghost {
    background: transparent;
    color: var(--ink);
    border: 1px solid var(--rule);
  }
  .btn--ghost:hover {
    border-color: var(--yellow);
    color: var(--yellow);
    background: transparent;
    transform: none;
  }
  .btn--danger { background: var(--danger); color: #fff; }
  .btn--danger:hover { background: #ff8079; color: #fff; transform: none; }
  .actions { display: flex; gap: 10px; margin-top: 24px; flex-wrap: wrap; }

  /* ---- Tableau ----------------------------------------------------- */
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--rule); }
  th {
    font-size: 10px; color: var(--ink-dim);
    text-transform: uppercase; letter-spacing: 0.14em;
    font-weight: 500;
  }
  tr:hover td { background: #0f0e0a; }

  /* ---- Pill / note / empty ----------------------------------------- */
  .pill {
    display: inline-block;
    padding: 2px 8px;
    border: 1px solid var(--rule);
    font-size: 10px;
    margin-right: 4px;
    color: var(--ink-dim);
    letter-spacing: 0.08em;
  }
  .empty {
    color: var(--ink-dim);
    padding: 40px;
    text-align: center;
    border: 1px dashed var(--rule);
  }
  .note { color: var(--ink-dim); font-size: 11px; margin: 4px 0 0; line-height: 1.5; }

  /* ---- Code inline ------------------------------------------------- */
  code {
    background: #0f0e0a;
    border: 1px solid var(--rule);
    padding: 1px 6px;
    font-size: 11px;
    color: var(--yellow-deep);
  }
`;
