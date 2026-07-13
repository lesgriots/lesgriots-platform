// Layout racine du back office.
// Aligné sur le style du site studio : Geist Mono, palette ink/yellow,
// sticker top-left, griot ASCII bottom-right.
import NavShell from "./components/NavShell";

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
        <NavShell />

        <div className="shell">
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

  /* ---- Fonts Geist Sans (typo principale du back office) ------------- */
  @font-face {
    font-family: "Geist";
    src: url("/api/preview?p=fonts/Geist-Regular.woff2") format("woff2");
    font-weight: 400; font-display: swap;
  }
  @font-face {
    font-family: "Geist";
    src: url("/api/preview?p=fonts/Geist-Medium.woff2") format("woff2");
    font-weight: 500; font-display: swap;
  }
  @font-face {
    font-family: "Geist";
    src: url("/api/preview?p=fonts/Geist-Bold.woff2") format("woff2");
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
    --font-sans: "Geist", "Inter", system-ui, -apple-system, sans-serif;
    /* Aliases — utilisés par les pages/composants. Avant ils n'étaient pas
       définis → les couleurs tombaient en fallback navigateur (bug). */
    --dim: var(--ink-dim);
    --accent: var(--yellow);
    --fg: var(--ink);
    /* Modernisation douce : rayons + surfaces + easing partagés */
    --r-sm: 6px;
    --r-md: 10px;
    --surface: #0b0a08;
    --surface-2: #12100b;
    --ease: cubic-bezier(0.25, 0.7, 0.3, 1);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: var(--bg);
    color: var(--ink);
    font-family: var(--font-sans);
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
    opacity: 0.28; /* adouci — l'identité CRT reste mais moins brutale */
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

  /* ---- Sidebar (desktop) / drawer (mobile) -------------------------- */
  .bo-sidebar {
    position: fixed;
    top: 0; left: 0; bottom: 0;
    width: 232px;
    z-index: 95;
    display: flex;
    flex-direction: column;
    padding: 18px 16px 24px;
    background: #070604;
    border-right: 1px solid var(--rule);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .bo-sidebar__brand {
    display: block;
    margin: 4px 6px 22px;
    filter: drop-shadow(2px 4px 0 rgba(0,0,0,0.35));
    transition: transform 0.35s cubic-bezier(0.2,0.7,0.2,1);
  }
  .bo-sidebar__brand:hover { transform: translate(-2px,-2px); }
  .bo-sidebar__brand img { display: block; width: 150px; max-width: 78%; height: auto; }
  .bo-sidebar__tag {
    display: block;
    margin-top: 10px;
    font-size: 10px;
    color: var(--ink-dim);
    text-transform: uppercase;
    letter-spacing: 0.22em;
  }

  /* Groupes + liens de nav */
  .bo-navgroup { margin-bottom: 18px; }
  .bo-navgroup__title {
    font-size: 9px;
    color: var(--ink-dim);
    text-transform: uppercase;
    letter-spacing: 0.2em;
    padding: 0 8px 6px;
    margin-bottom: 2px;
    border-bottom: 1px solid var(--rule);
  }
  .bo-navlink {
    display: block;
    padding: 7px 8px;
    color: var(--ink);
    font-size: 12px;
    letter-spacing: 0.04em;
    border-left: 2px solid transparent;
    transition: color 0.12s, background 0.12s, border-color 0.12s;
  }
  .bo-navlink::before {
    content: "> ";
    color: var(--ink-dim);
    opacity: 0.5;
    margin-right: 2px;
  }
  .bo-navlink:hover {
    color: var(--yellow);
    background: #100e09;
  }
  .bo-navlink:hover::before { color: var(--yellow); opacity: 1; }
  .bo-navlink--active {
    color: var(--yellow);
    background: #14110a;
    border-left-color: var(--yellow);
    font-weight: 500;
  }
  .bo-navlink--active::before { content: "$ "; color: var(--yellow); opacity: 1; }
  .bo-sidenav__actions { display: flex; flex-direction: column; gap: 8px; padding: 4px 8px 0; }
  .bo-navlink--ext { padding-left: 0; }
  .bo-navlink--ext::before { content: ""; margin: 0; }

  /* Barre mobile (cachée en desktop) */
  .bo-mobilebar { display: none; }
  .bo-scrim {
    position: fixed; inset: 0; z-index: 94;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(1px);
  }

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
    margin-left: 232px;
    padding: 32px 60px 200px 48px;
    max-width: 1180px;
  }

  /* Tablette / mobile : la sidebar devient un drawer, barre mobile visible. */
  @media (max-width: 900px) {
    .bo-mobilebar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 93;
      padding: 10px 14px;
      background: rgba(7,6,4,0.92);
      backdrop-filter: blur(6px);
      border-bottom: 1px solid var(--rule);
    }
    .bo-mobilebar__brand img { display: block; width: 104px; height: auto; }
    .bo-burger {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: transparent;
      color: var(--ink);
      border: 1px solid var(--rule);
      padding: 7px 12px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }
    .bo-burger span { font-size: 11px; }
    .bo-burger:hover { color: var(--yellow); border-color: var(--yellow); }

    .bo-sidebar {
      transform: translateX(-100%);
      transition: transform 0.28s cubic-bezier(0.3,0.7,0.2,1);
      width: 264px;
      box-shadow: 8px 0 40px rgba(0,0,0,0.6);
    }
    .bo-sidebar--open { transform: translateX(0); }

    .shell { margin-left: 0; padding: 22px 18px 120px; }
    .bo-griot { display: none; }
  }
  @media (max-width: 600px) {
    .shell { padding: 18px 14px 100px; }
    .bo-sidebar { width: 84vw; }
  }
  /* En desktop, le voile mobile ne doit jamais s'afficher. */
  @media (min-width: 901px) { .bo-scrim { display: none; } }

  /* ---- Liens, boutons, formulaires ---------------------------------- */
  a { color: var(--ink); text-decoration: none; }
  a:hover { color: var(--yellow); }
  button { font: inherit; cursor: pointer; }
  input, textarea, select {
    font: inherit; color: var(--ink); background: #0f0e0a;
    border: 1px solid var(--rule); padding: 9px 11px; border-radius: var(--r-sm);
    width: 100%;
    transition: border-color 0.18s var(--ease), box-shadow 0.18s var(--ease), background 0.18s var(--ease);
  }
  input::placeholder, textarea::placeholder { color: #4a4418; opacity: 1; }
  input:hover, textarea:hover, select:hover { border-color: var(--ink-dim); }
  input:focus, textarea:focus, select:focus {
    outline: none;
    border-color: var(--yellow);
    background: #12100a;
    box-shadow: 0 0 0 2px rgba(246,226,28,0.18);
  }
  textarea { font-family: var(--font-sans); resize: vertical; min-height: 80px; }
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
  @media (max-width: 640px) { .row { grid-template-columns: 1fr; gap: 4px; } }

  /* ---- Boutons ----------------------------------------------------- */
  .btn {
    background: var(--yellow);
    color: #000;
    border: 0;
    border-radius: var(--r-sm);
    padding: 10px 18px;
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    transition: background 0.18s var(--ease), transform 0.18s var(--ease), box-shadow 0.18s var(--ease);
  }
  .btn:hover { background: #fff; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(246,226,28,0.12); }
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
    border-radius: 99px;
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
    border-radius: var(--r-md);
  }

  /* ================================================================
     BIBLIOTHÈQUE PROJETS — façon YouTube Studio
     ================================================================ */
  .bo-toolbar {
    display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
    margin: 14px 0 20px;
  }
  .bo-search {
    flex: 1; min-width: 220px; max-width: 420px;
    position: relative;
  }
  .bo-search input { padding-left: 34px; border-radius: 99px; }
  .bo-search::before {
    content: "⌕";
    position: absolute; left: 13px; top: 50%; transform: translateY(-50%) scaleX(-1);
    color: var(--ink-dim); font-size: 15px; pointer-events: none; z-index: 1;
  }
  .projlib {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 18px;
    margin-top: 8px;
  }
  .projcard {
    position: relative;
    background: var(--surface);
    border: 1px solid var(--rule);
    border-radius: var(--r-md);
    overflow: hidden;
    transition: transform 0.22s var(--ease), border-color 0.22s var(--ease), box-shadow 0.22s var(--ease), opacity 0.22s var(--ease);
    cursor: grab;
  }
  .projcard:hover {
    transform: translateY(-3px);
    border-color: var(--ink-dim);
    box-shadow: 0 14px 34px rgba(0,0,0,0.5);
  }
  .projcard--hidden { opacity: 0.45; }
  .projcard--hidden:hover { opacity: 0.8; }
  .projcard--dragging { opacity: 0.35; border-style: dashed; }
  .projcard--dropover { border-color: var(--yellow); box-shadow: 0 0 0 2px rgba(246,226,28,0.25); }
  .projcard__thumb {
    position: relative;
    aspect-ratio: 16 / 9;
    background: #141210;
    overflow: hidden;
  }
  .projcard__thumb img, .projcard__thumb video {
    width: 100%; height: 100%; object-fit: cover; display: block;
    transition: transform 0.4s var(--ease);
  }
  .projcard:hover .projcard__thumb img, .projcard:hover .projcard__thumb video {
    transform: scale(1.04);
  }
  .projcard__order {
    position: absolute; top: 8px; left: 8px;
    padding: 1px 8px;
    background: rgba(5,5,5,0.72); color: var(--ink);
    font-family: var(--font-mono); font-size: 10px;
    border-radius: 99px;
    letter-spacing: 0.08em;
  }
  .projcard__badges { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; }
  .projcard__badge {
    padding: 1px 8px; border-radius: 99px;
    background: rgba(5,5,5,0.72);
    font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--ink);
  }
  .projcard__badge--warn { color: var(--danger); border: 1px solid rgba(255,95,86,0.5); }
  .projcard__actions {
    position: absolute; inset: auto 0 0 0;
    display: flex; gap: 6px; justify-content: flex-end;
    padding: 26px 8px 8px;
    background: linear-gradient(to top, rgba(5,5,5,0.85), transparent);
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 0.2s var(--ease), transform 0.2s var(--ease);
  }
  .projcard:hover .projcard__actions { opacity: 1; transform: none; }
  .projcard__act {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 28px; height: 28px; padding: 0 9px;
    background: rgba(15,14,10,0.9);
    border: 1px solid var(--rule);
    border-radius: var(--r-sm);
    color: var(--ink); font-size: 12px;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .projcard__act:hover { color: var(--yellow); border-color: var(--yellow); }
  .projcard__act--danger:hover { color: var(--danger); border-color: var(--danger); }
  .projcard__meta { padding: 10px 12px 12px; }
  .projcard__name { display: block; font-weight: 500; color: var(--ink); font-size: 13px; line-height: 1.3; }
  .projcard:hover .projcard__name { color: var(--yellow); }
  .projcard__sub {
    margin-top: 3px;
    font-size: 11px; color: var(--ink-dim);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  /* ================================================================
     GALERIE MÉDIAS — façon Instagram (fiche projet)
     ================================================================ */
  .medialib {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
    margin: 12px 0;
  }
  .mediatile {
    position: relative;
    aspect-ratio: 1 / 1;
    background: var(--surface);
    border: 1px solid var(--rule);
    border-radius: var(--r-sm);
    overflow: hidden;
    cursor: grab;
    transition: transform 0.2s var(--ease), border-color 0.2s var(--ease), box-shadow 0.2s var(--ease), opacity 0.2s var(--ease);
  }
  .mediatile:hover { transform: translateY(-2px); border-color: var(--ink-dim); }
  .mediatile--selected { border-color: var(--yellow); box-shadow: 0 0 0 2px rgba(246,226,28,0.3); }
  .mediatile--dragging { opacity: 0.35; border-style: dashed; }
  .mediatile--dropover { border-color: var(--yellow); box-shadow: 0 0 0 2px rgba(246,226,28,0.25); }
  .mediatile img, .mediatile video {
    width: 100%; height: 100%; object-fit: cover; display: block;
  }
  .mediatile__type {
    position: absolute; top: 5px; left: 5px;
    padding: 1px 7px; border-radius: 99px;
    background: rgba(5,5,5,0.75);
    font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--ink);
  }
  .mediatile__num {
    position: absolute; top: 5px; right: 5px;
    min-width: 18px; height: 18px;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 99px;
    background: rgba(5,5,5,0.75);
    font-family: var(--font-mono); font-size: 9px; color: var(--ink);
  }
  .mediatile__missing {
    display: flex; align-items: center; justify-content: center;
    width: 100%; height: 100%;
    color: var(--ink-dim); font-size: 11px; letter-spacing: 0.1em;
  }
  .mediatile__remove {
    position: absolute; bottom: 5px; right: 5px;
    width: 22px; height: 22px;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 99px; border: 0;
    background: rgba(5,5,5,0.8); color: var(--ink);
    font-size: 12px; opacity: 0;
    transition: opacity 0.18s var(--ease), color 0.15s;
  }
  .mediatile:hover .mediatile__remove { opacity: 1; }
  .mediatile__remove:hover { color: var(--danger); }
  .mediatile--add {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 2px;
    border-style: dashed;
    color: var(--ink-dim);
    background: transparent;
    cursor: pointer;
    font-size: 11px; letter-spacing: 0.06em;
  }
  .mediatile--add:hover { color: var(--yellow); border-color: var(--yellow); transform: none; }
  .mediatile--add .plus { font-size: 20px; line-height: 1; }
  .media-editor {
    border: 1px solid var(--rule);
    border-radius: var(--r-md);
    background: var(--surface);
    padding: 14px 16px 16px;
    margin: 4px 0 14px;
    animation: media-editor-in 0.22s var(--ease);
  }
  @keyframes media-editor-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: none; }
  }

  /* ================================================================
     UPLOAD — façon Vimeo (drop global + file d'attente)
     ================================================================ */
  .dropveil {
    position: fixed; inset: 0; z-index: 200;
    display: flex; align-items: center; justify-content: center;
    background: rgba(5,5,5,0.82);
    backdrop-filter: blur(3px);
    pointer-events: none;
  }
  .dropveil__box {
    padding: 44px 64px;
    border: 2px dashed var(--yellow);
    border-radius: var(--r-md);
    color: var(--yellow);
    font-size: 15px; letter-spacing: 0.12em; text-transform: uppercase;
    background: rgba(15,14,10,0.7);
    animation: dropveil-pulse 1.2s ease infinite;
  }
  @keyframes dropveil-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.025); }
  }
  .upqueue {
    position: fixed; right: 18px; bottom: 18px; z-index: 210;
    width: 300px;
    display: flex; flex-direction: column; gap: 8px;
  }
  .upqueue__item {
    background: var(--surface-2);
    border: 1px solid var(--rule);
    border-radius: var(--r-sm);
    padding: 9px 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.55);
    animation: media-editor-in 0.2s var(--ease);
  }
  .upqueue__name {
    display: flex; justify-content: space-between; gap: 8px;
    font-size: 11px; color: var(--ink);
    white-space: nowrap; overflow: hidden;
  }
  .upqueue__name em { font-style: normal; color: var(--ink-dim); flex-shrink: 0; }
  .upqueue__bar {
    height: 3px; margin-top: 7px; border-radius: 99px;
    background: var(--rule); overflow: hidden;
  }
  .upqueue__fill {
    height: 100%; border-radius: 99px;
    background: var(--yellow);
    transition: width 0.2s var(--ease);
  }
  .upqueue__item--done .upqueue__fill { background: #6fd66f; }
  .upqueue__item--error .upqueue__fill { background: var(--danger); }
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
