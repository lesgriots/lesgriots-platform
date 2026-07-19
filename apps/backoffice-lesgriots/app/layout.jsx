// Layout racine du back office.
// DA alignée sur le SITE OMBRELLE (apps/lesgriots/styles.css) :
//   fond noir profond, encre ivoire #f4efe3, accent or #F1B81F, hot #C4321F,
//   titres Instrument Serif (em italique = or), labels JetBrains Mono
//   uppercase très espacés, grain photographique (feTurbulence) en overlay.
// Les noms de classes sont inchangés — seules les valeurs bougent.
import NavShell from "./components/NavShell";

export const metadata = {
  title: "LES GRIOTS — Back Office",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {/* Mêmes polices que le site les griots : Instrument Serif (titres),
            Geist (texte), JetBrains Mono (labels) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <style>{globalCss}</style>
      </head>
      <body>
        <NavShell />

        <div className="shell">
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}

const globalCss = `
  /* ---- Palette du SITE OMBRELLE (styles.css du site) ----------------- */
  :root {
    --bg: #0a0a0a;
    --ink: #f4efe3;                          /* ivoire — texte principal */
    --ink-dim: rgba(244, 239, 227, 0.55);    /* ivoire éteint — labels */
    --rule: rgba(244, 239, 227, 0.14);       /* filets */
    --yellow: #F1B81F;                       /* or du site (accent) */
    --yellow-deep: #d9a41b;
    --danger: #C4321F;                       /* rouge chaud du site (--hot) */
    --font-mono: "JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace;
    --font-sans: "Geist", "Söhne", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
    --font-serif: "Instrument Serif", "Newsreader", "Times New Roman", Georgia, serif;
    /* Aliases utilisés par les pages/composants */
    --dim: var(--ink-dim);
    --accent: var(--yellow);
    --fg: var(--ink);
    /* Éditorial = angles nets, rayons discrets */
    --r-sm: 3px;
    --r-md: 6px;
    --surface: #111111;
    --surface-2: #161616;
    --ease: cubic-bezier(0.25, 0.7, 0.3, 1);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: var(--bg);
    color: var(--ink);
    font-family: var(--font-sans);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    min-height: 100vh;
  }

  /* ---- Caret clignotant (conservé, en or) ---------------------------- */
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

  /* ---- Grain photographique — même recette feTurbulence que le site -- */
  body::after {
    content: "";
    position: fixed;
    inset: 0;
    z-index: 999;
    pointer-events: none;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .9 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/></svg>");
    background-size: 260px 260px;
    opacity: 0.16;
    mix-blend-mode: overlay;
  }

  /* ---- Sidebar (desktop) / drawer (mobile) --------------------------- */
  .bo-sidebar {
    position: fixed;
    top: 0; left: 0; bottom: 0;
    width: 232px;
    z-index: 95;
    display: flex;
    flex-direction: column;
    padding: 22px 18px 24px;
    background: #000;
    border-right: 1px solid var(--rule);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .bo-sidebar__brand {
    display: block;
    margin: 4px 6px 26px;
    transition: opacity 0.25s var(--ease);
  }
  .bo-sidebar__brand:hover { opacity: 0.85; }
  .bo-sidebar__brand img { display: block; width: 150px; max-width: 78%; height: auto; }
  .bo-sidebar__tag {
    display: block;
    margin-top: 12px;
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--ink-dim);
    text-transform: uppercase;
    letter-spacing: 0.22em;
  }

  /* Groupes + liens de nav — labels mono espacés comme le site */
  .bo-navgroup { margin-bottom: 20px; }
  .bo-navgroup__title {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--ink-dim);
    text-transform: uppercase;
    letter-spacing: 0.22em;
    padding: 0 8px 7px;
    margin-bottom: 3px;
    border-bottom: 1px solid var(--rule);
  }
  .bo-navlink {
    display: block;
    padding: 8px 8px;
    color: var(--ink);
    font-size: 12.5px;
    letter-spacing: 0.03em;
    border-left: 2px solid transparent;
    transition: color 0.15s, background 0.15s, border-color 0.15s;
  }
  .bo-navlink:hover {
    color: var(--yellow);
    background: rgba(244, 239, 227, 0.04);
  }
  .bo-navlink--active {
    color: var(--yellow);
    background: rgba(241, 184, 31, 0.07);
    border-left-color: var(--yellow);
    font-weight: 500;
  }
  .bo-sidenav__actions { display: flex; flex-direction: column; gap: 8px; padding: 4px 8px 0; }
  .bo-navlink--ext { padding-left: 0; }

  /* Barre mobile (cachée en desktop) */
  .bo-mobilebar { display: none; }
  .bo-scrim {
    position: fixed; inset: 0; z-index: 94;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(2px);
  }

  /* ---- Layout principal ---------------------------------------------- */
  .shell {
    position: relative;
    z-index: 1;
    margin-left: 232px;
    padding: 40px 60px 160px 52px;
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
      background: rgba(10,10,10,0.92);
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
      font-family: var(--font-mono);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      cursor: pointer;
    }
    .bo-burger span { font-size: 10px; }
    .bo-burger:hover { color: var(--yellow); border-color: var(--yellow); }

    .bo-sidebar {
      transform: translateX(-100%);
      transition: transform 0.28s cubic-bezier(0.3,0.7,0.2,1);
      width: 264px;
      box-shadow: 8px 0 40px rgba(0,0,0,0.7);
    }
    .bo-sidebar--open { transform: translateX(0); }

    .shell { margin-left: 0; padding: 22px 18px 120px; }
  }
  @media (max-width: 600px) {
    .shell { padding: 18px 14px 100px; }
    .bo-sidebar { width: 84vw; }
  }
  @media (min-width: 901px) { .bo-scrim { display: none; } }

  /* ---- Liens, boutons, formulaires ------------------------------------ */
  a { color: var(--ink); text-decoration: none; }
  a:hover { color: var(--yellow); }
  button { font: inherit; cursor: pointer; }
  input, textarea, select {
    font: inherit; color: var(--ink); background: #141414;
    border: 1px solid var(--rule); padding: 9px 11px; border-radius: var(--r-sm);
    width: 100%;
    transition: border-color 0.18s var(--ease), box-shadow 0.18s var(--ease), background 0.18s var(--ease);
  }
  input::placeholder, textarea::placeholder { color: rgba(244,239,227,0.3); opacity: 1; }
  input:hover, textarea:hover, select:hover { border-color: rgba(244,239,227,0.35); }
  input:focus, textarea:focus, select:focus {
    outline: none;
    border-color: var(--yellow);
    background: #171717;
    box-shadow: 0 0 0 2px rgba(241, 184, 31, 0.18);
  }
  textarea { font-family: var(--font-sans); resize: vertical; min-height: 80px; }
  label {
    display: block; margin: 14px 0 6px;
    font-family: var(--font-mono);
    font-size: 10px; color: var(--ink-dim);
    text-transform: uppercase; letter-spacing: 0.18em;
  }

  /* ---- Typo titres — Instrument Serif, em italique = or (comme le site) */
  h1 {
    font-family: var(--font-serif);
    font-size: 46px;
    font-weight: 400;
    color: var(--ink);
    margin: 0 0 18px;
    letter-spacing: -0.015em;
    line-height: 1.05;
  }
  h1 em, h2 em { font-style: italic; color: var(--yellow); }
  h2 {
    font-family: var(--font-serif);
    font-size: 25px;
    font-weight: 400;
    margin: 30px 0 12px;
    color: var(--ink);
    letter-spacing: -0.01em;
    padding-bottom: 7px;
    border-bottom: 1px solid var(--rule);
  }

  /* ---- Grille de formulaires ----------------------------------------- */
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 640px) { .row { grid-template-columns: 1fr; gap: 4px; } }

  /* ---- Boutons — or du site, labels mono espacés ---------------------- */
  .btn {
    background: var(--yellow);
    color: #000;
    border: 0;
    border-radius: var(--r-sm);
    padding: 11px 20px;
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 10.5px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    transition: background 0.18s var(--ease), color 0.18s var(--ease), transform 0.18s var(--ease);
  }
  .btn:hover { background: var(--ink); color: #000; transform: translateY(-1px); }
  .btn:disabled { opacity: 0.45; cursor: default; transform: none; }
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
  .btn--danger:hover { background: #a52a1a; color: #fff; transform: none; }
  .actions { display: flex; gap: 10px; margin-top: 24px; flex-wrap: wrap; }

  /* ---- Tableau -------------------------------------------------------- */
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--rule); }
  th {
    font-family: var(--font-mono);
    font-size: 9px; color: var(--ink-dim);
    text-transform: uppercase; letter-spacing: 0.18em;
    font-weight: 500;
  }
  tr:hover td { background: rgba(244,239,227,0.03); }

  /* ---- Pill / note / empty -------------------------------------------- */
  .pill {
    display: inline-block;
    padding: 2px 9px;
    border: 1px solid var(--rule);
    border-radius: 99px;
    font-family: var(--font-mono);
    font-size: 9px;
    margin-right: 4px;
    color: var(--ink-dim);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .empty {
    color: var(--ink-dim);
    padding: 40px;
    text-align: center;
    border: 1px dashed var(--rule);
    border-radius: var(--r-md);
    font-family: var(--font-serif);
    font-size: 16px;
  }

  /* ================================================================
     BIBLIOTHÈQUE PROJETS
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
  }
  .projcard:hover {
    transform: translateY(-3px);
    border-color: rgba(244,239,227,0.35);
    box-shadow: 0 14px 34px rgba(0,0,0,0.55);
  }
  .projcard--hidden { opacity: 0.45; }
  .projcard--hidden:hover { opacity: 0.8; }
  .projcard--dragging { opacity: 0.35; border-style: dashed; }
  .projcard--dropover { border-color: var(--yellow); box-shadow: 0 0 0 2px rgba(241,184,31,0.3); }
  .projcard__thumb {
    position: relative;
    aspect-ratio: 16 / 9;
    background: #000;
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
    background: rgba(0,0,0,0.72); color: var(--ink);
    font-family: var(--font-mono); font-size: 10px;
    border-radius: 99px;
    letter-spacing: 0.08em;
  }
  .projcard__badges { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; }
  .projcard__badge {
    padding: 1px 8px; border-radius: 99px;
    background: rgba(0,0,0,0.72);
    font-family: var(--font-mono);
    font-size: 8.5px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--ink);
  }
  .projcard__badge--warn { color: #ff8071; border: 1px solid rgba(196,50,31,0.6); }
  .projcard__actions {
    position: absolute; inset: auto 0 0 0;
    display: flex; gap: 6px; justify-content: flex-end;
    padding: 26px 8px 8px;
    background: linear-gradient(to top, rgba(0,0,0,0.85), transparent);
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 0.2s var(--ease), transform 0.2s var(--ease);
  }
  .projcard:hover .projcard__actions { opacity: 1; transform: none; }
  .projcard__act {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 28px; height: 28px; padding: 0 9px;
    background: rgba(10,10,10,0.9);
    border: 1px solid var(--rule);
    border-radius: var(--r-sm);
    color: var(--ink); font-size: 12px;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .projcard__act:hover { color: var(--yellow); border-color: var(--yellow); }
  .projcard__act--danger:hover { color: #ff8071; border-color: var(--danger); }
  .projcard__meta { padding: 10px 12px 12px; }
  .projcard__name { display: block; font-weight: 500; color: var(--ink); font-size: 13px; line-height: 1.3; }
  .projcard:hover .projcard__name { color: var(--yellow); }
  .projcard__sub {
    margin-top: 3px;
    font-size: 11px; color: var(--ink-dim);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  /* ================================================================
     GALERIE MÉDIAS
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
    transition: transform 0.2s var(--ease), border-color 0.2s var(--ease), box-shadow 0.2s var(--ease), opacity 0.2s var(--ease);
  }
  .mediatile:hover { transform: translateY(-2px); border-color: rgba(244,239,227,0.35); }
  .mediatile--selected { border-color: var(--yellow); box-shadow: 0 0 0 2px rgba(241,184,31,0.35); }
  .mediatile--dragging { opacity: 0.35; border-style: dashed; }
  .mediatile--dropover { border-color: var(--yellow); box-shadow: 0 0 0 2px rgba(241,184,31,0.3); }
  .mediatile img, .mediatile video {
    width: 100%; height: 100%; object-fit: cover; display: block;
  }
  .mediatile__type {
    position: absolute; top: 5px; left: 5px;
    padding: 1px 7px; border-radius: 99px;
    background: rgba(0,0,0,0.75);
    font-family: var(--font-mono);
    font-size: 8.5px; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--ink);
  }
  .mediatile__num {
    position: absolute; top: 5px; right: 5px;
    min-width: 18px; height: 18px;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 99px;
    background: rgba(0,0,0,0.75);
    font-family: var(--font-mono); font-size: 9px; color: var(--ink);
  }
  .mediatile__missing {
    display: flex; align-items: center; justify-content: center;
    width: 100%; height: 100%;
    color: var(--ink-dim);
    font-family: var(--font-serif); font-style: italic;
    font-size: 13px; letter-spacing: 0.02em;
  }
  .mediatile__remove {
    position: absolute; bottom: 5px; right: 5px;
    width: 22px; height: 22px;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 99px; border: 0;
    background: rgba(0,0,0,0.8); color: var(--ink);
    font-size: 12px; opacity: 0;
    transition: opacity 0.18s var(--ease), color 0.15s;
  }
  .mediatile:hover .mediatile__remove { opacity: 1; }
  .mediatile__remove:hover { color: #ff8071; }
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
    padding: 16px 18px 18px;
    margin: 4px 0 14px;
    animation: media-editor-in 0.22s var(--ease);
  }
  @keyframes media-editor-in {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: none; }
  }

  /* ================================================================
     UPLOAD — drop global + file d'attente
     ================================================================ */
  .dropveil {
    position: fixed; inset: 0; z-index: 200;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.84);
    backdrop-filter: blur(3px);
    pointer-events: none;
  }
  .dropveil__box {
    padding: 44px 64px;
    border: 2px dashed var(--yellow);
    border-radius: var(--r-md);
    color: var(--yellow);
    font-family: var(--font-mono);
    font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase;
    background: rgba(17,17,17,0.7);
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
    box-shadow: 0 10px 30px rgba(0,0,0,0.6);
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
  .note { color: var(--ink-dim); font-size: 11.5px; margin: 4px 0 0; line-height: 1.55; }

  /* ---- Code inline ---------------------------------------------------- */
  code {
    background: #141414;
    border: 1px solid var(--rule);
    border-radius: var(--r-sm);
    padding: 1px 6px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--yellow);
  }
`;
