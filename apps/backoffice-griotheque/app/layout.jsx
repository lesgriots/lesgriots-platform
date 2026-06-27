// Layout racine du back office Griothèque.
// DA alignée sur le site lagriotheque : paper crème + ink noir + accent jaune,
// Geist Mono + Geist sans, header sticky avec bordure, style SUPSI éditorial.
// Plus de terminal sombre, plus de sticker ni griot ASCII (pas adaptés à un admin).
import ExportButton from "./components/ExportButton";

export const metadata = {
  title: "LA GRIOTHÈQUE — Back Office",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <style>{globalCss}</style>
      </head>
      <body>
        <header className="bo-header">
          <a href="/" className="bo-brand">
            <span className="bo-brand__mark">LG</span>
            <div className="bo-brand__text">
              <span className="bo-brand__name">LA GRIOTHÈQUE</span>
              <span className="bo-brand__sub">back office</span>
            </div>
          </a>

          <nav className="bo-nav">
            <a href="/formations">formations</a>
            <span className="bo-nav__sep">·</span>
            <a href="/workshops">workshops</a>
            <span className="bo-nav__sep">·</span>
            <a href="/trainers">intervenants</a>
            <span className="bo-nav__sep">·</span>
            <a href="/sessions">sessions</a>
            <span className="bo-nav__sep">·</span>
            <a href="/resources">ressources</a>
            <span className="bo-nav__sep">·</span>
            <a href="/leads">leads</a>
            <span className="bo-nav__sep">·</span>
            <a href="/defaults">textes</a>
            <span className="bo-nav__sep">·</span>
            <a href="/pages">pages</a>
            <span className="bo-nav__sep">·</span>
            <a href="https://lagriotheque.com" target="_blank" rel="noopener noreferrer">voir le site ↗</a>
            <span className="bo-nav__sep">·</span>
            <ExportButton variant="nav" />
          </nav>
        </header>

        <main className="bo-main">{children}</main>
      </body>
    </html>
  );
}

const globalCss = `
  /* ---- Fonts (servies via /api/preview depuis apps/lagriotheque/fonts) -- */
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

  /* ---- Palette du site Griothèque ---------------------------------- */
  :root {
    --paper: #f6f5f3;            /* crème, fond principal */
    --ink: #000000;              /* noir pur */
    --ink-dim: rgba(0,0,0,0.55); /* noir transparent */
    --rule: rgba(0,0,0,0.18);    /* lignes subtiles */
    --accent: #ffca00;           /* jaune brand */
    --accent-soft: #ffe071;      /* jaune doux */
    --danger: #d72d2d;
    --font-mono: "Geist Mono", "JetBrains Mono", "Courier New", monospace;
    --font-sans: "Geist", "Inter", system-ui, sans-serif;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: var(--paper);
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: 14px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }

  /* ---- Header sticky avec bordure inférieure ----------------------- */
  .bo-header {
    display: flex;
    align-items: center;
    gap: 32px;
    padding: 14px 28px;
    border-bottom: 1px solid var(--ink);
    background: var(--paper);
    position: sticky;
    top: 0;
    z-index: 50;
  }

  .bo-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    color: var(--ink);
  }
  .bo-brand__mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1.5px solid var(--ink);
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0;
  }
  .bo-brand__text {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
  }
  .bo-brand__name {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  .bo-brand__sub {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-dim);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-top: 2px;
  }

  /* ---- Navigation inline — typo Geist sans, gros, lowercase --------
     Identique à la nav du site lagriotheque (.lg__menu__row:last-child) :
     police sans-serif Geist, weight 500, letter-spacing négatif léger,
     taille fluide pour rester sur une ligne. */
  .bo-nav {
    display: flex;
    gap: clamp(8px, 1vw, 14px);
    align-items: baseline;
    margin-left: auto;
    flex-wrap: wrap;
    font-family: var(--font-sans);
    font-weight: 500;
    letter-spacing: -0.01em;
    line-height: 1.1;
    color: var(--ink);
  }
  .bo-nav a {
    color: inherit;
    text-decoration: none;
    text-transform: lowercase;
    font-size: clamp(14px, 1.4vw, 22px);
    transition: text-decoration-color 0.15s;
    padding: 0;
  }
  .bo-nav a:hover {
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
  }
  .bo-nav__sep {
    color: var(--ink);
    font-weight: 500;
    font-size: clamp(14px, 1.4vw, 22px);
  }
  /* Bouton Exporter : pas affecté par la lowercase, garde son cadre jaune */
  .bo-nav a.bo-nav__export {
    color: var(--ink);
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 8px 14px;
    background: var(--accent);
    border: 1px solid var(--ink);
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
  }
  .bo-nav a.bo-nav__export:hover {
    background: var(--ink);
    color: var(--accent);
    text-decoration: none;
  }

  /* ---- Main content ------------------------------------------------ */
  .bo-main {
    padding: 32px 48px 120px;
    max-width: 1400px;
  }
  @media (max-width: 900px) {
    .bo-header { flex-direction: column; align-items: flex-start; gap: 16px; padding: 14px 20px; }
    .bo-nav { margin-left: 0; }
    .bo-main { padding: 24px 20px 80px; }
  }

  /* ---- Titres SUPSI : gros, lowercase, light --------------------- */
  h1 {
    font-family: var(--font-sans);
    font-size: clamp(36px, 5.5vw, 64px);
    font-weight: 400;
    line-height: 1;
    letter-spacing: -0.02em;
    margin: 0 0 24px;
    color: var(--ink);
  }
  h2 {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--ink-dim);
    margin: 32px 0 14px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--rule);
  }
  h3 {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin: 18px 0 8px;
    color: var(--ink);
  }

  /* ---- Liens, boutons, formulaires --------------------------------- */
  a { color: var(--ink); text-decoration: underline; text-decoration-color: var(--rule); text-underline-offset: 3px; }
  a:hover { text-decoration-color: var(--ink); }
  button { font: inherit; cursor: pointer; }

  input, textarea, select {
    font: inherit;
    color: var(--ink);
    background: var(--paper);
    border: 1px solid var(--ink);
    padding: 10px 12px;
    border-radius: 0;
    width: 100%;
    font-family: var(--font-mono);
  }
  input:focus, textarea:focus, select:focus {
    outline: none;
    border-color: var(--ink);
    box-shadow: inset 0 0 0 1px var(--ink);
  }
  input:disabled, textarea:disabled, select:disabled {
    background: rgba(0,0,0,0.04);
    color: var(--ink-dim);
    cursor: not-allowed;
  }
  textarea { resize: vertical; min-height: 90px; }
  label {
    display: block;
    margin: 14px 0 6px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-dim);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  /* ---- Grille de formulaires --------------------------------------- */
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  @media (max-width: 700px) { .row { grid-template-columns: 1fr; } }

  /* ---- Boutons ----------------------------------------------------- */
  .btn {
    background: var(--ink);
    color: var(--paper);
    border: 1px solid var(--ink);
    padding: 12px 22px;
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
    display: inline-block;
  }
  .btn:hover { background: var(--accent); color: var(--ink); }
  .btn--ghost {
    background: transparent;
    color: var(--ink);
    border: 1px solid var(--ink);
  }
  .btn--ghost:hover {
    background: var(--ink);
    color: var(--paper);
  }
  .btn--danger {
    background: var(--paper);
    color: var(--danger);
    border: 1px solid var(--danger);
  }
  .btn--danger:hover { background: var(--danger); color: var(--paper); }
  .actions { display: flex; gap: 10px; margin-top: 28px; flex-wrap: wrap; align-items: center; }

  /* ---- Tableau ----------------------------------------------------- */
  table { width: 100%; border-collapse: collapse; margin-top: 18px; }
  th, td {
    text-align: left;
    padding: 14px 14px;
    border-bottom: 1px solid var(--rule);
    vertical-align: middle;
  }
  th {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-dim);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-weight: 500;
    border-bottom: 1px solid var(--ink);
  }
  tr:hover td { background: rgba(0,0,0,0.025); }
  td a { color: var(--ink); font-weight: 500; }

  /* ---- Pill / note / empty ----------------------------------------- */
  .pill {
    display: inline-block;
    padding: 3px 9px;
    border: 1px solid var(--rule);
    font-size: 10px;
    margin-right: 4px;
    color: var(--ink-dim);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .empty {
    color: var(--ink-dim);
    padding: 60px 40px;
    text-align: center;
    border: 1px dashed var(--rule);
    font-family: var(--font-mono);
    font-size: 13px;
  }
  .empty a { color: var(--ink); }
  .note {
    color: var(--ink-dim);
    font-family: var(--font-mono);
    font-size: 11px;
    margin: 6px 0 0;
    line-height: 1.55;
  }

  /* ---- Code inline ------------------------------------------------- */
  code {
    background: rgba(0,0,0,0.06);
    padding: 2px 7px;
    font-family: var(--font-mono);
    font-size: 11.5px;
    color: var(--ink);
  }

  /* ---- Caret clignotant (sur Type) — bar discrète éditoriale ------- */
  .bo-caret {
    display: inline-block;
    width: 0.5em;
    margin-left: 2px;
    color: var(--ink);
    font-weight: 300;
    line-height: 1;
    animation: bo-caret-blink 1s steps(1) infinite;
  }
  @keyframes bo-caret-blink {
    0%, 49%   { opacity: 1; }
    50%, 100% { opacity: 0; }
  }
`;
