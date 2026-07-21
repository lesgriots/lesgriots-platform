// Layout racine du back office Griothèque.
// DA alignée sur le site lagriotheque : paper crème + ink noir + accent jaune,
// Geist Mono + Geist sans, header sticky avec bordure, style SUPSI éditorial.
// Plus de terminal sombre, plus de sticker ni griot ASCII (pas adaptés à un admin).
import ExportButton from "./components/ExportButton";

export const metadata = {
  title: "LA GRIOTHÈQUE — Back Office",
};

// En prod le BO est servi sous le basePath /griotheque (cf. next.config.js et
// le hub admin.lesgriots.com). Or tout le code client utilise des URLs
// absolues depuis la racine (fetch("/api/…"), <a href="/formations">) qui
// ignorent ce préfixe : les requêtes partaient sur /api/… (→ BO Studio) et les
// liens sur /formations (→ 404). Ce shim préfixe automatiquement ces URLs.
const BASE_PATH = process.env.NODE_ENV === "production" ? "/griotheque" : "";

const basePathShim = `(function(){
  var BP = ${JSON.stringify(BASE_PATH)};
  window.__BP = BP;
  if (!BP) return;
  var of = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === "string" && input.charAt(0) === "/" && input.indexOf(BP + "/") !== 0) {
      input = BP + input;
    }
    return of.call(this, input, init);
  };
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href^='/']") : null;
    if (!a) return;
    var h = a.getAttribute("href");
    if (!h || h.indexOf("//") === 0 || h === BP || h.indexOf(BP + "/") === 0) return;
    e.preventDefault();
    window.location.href = BP + h;
  }, true);
})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: basePathShim }} />
        <style>{globalCss}</style>
      </head>
      <body>
        <header className="bo-header">
          <a href="/" className="bo-brand">
            <div className="bo-brand__text">
              {/* Mot-marque officiel vectorisé (branding/logo-lagriotheque-wordmark-*.svg) */}
              <svg
                className="bo-brand__wordmark"
                viewBox="0 0 8448 1095"
                role="img"
                aria-label="LA GRIOTHÈQUE"
                preserveAspectRatio="xMidYMid meet"
              >
                <g
                  transform="matrix(1 0 0 -1 -26.0 968.0)"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="26"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  paintOrder="stroke"
                >
                  <path d="M86 0V710H194V99H540V0Z M603 0 859 710H996L1252 0H1137L1072 185H782L718 0ZM816 283H1039L927 607Z M1880 -16Q1779 -16 1707.0 31.5Q1635 79 1597.0 162.5Q1559 246 1559 354Q1559 461 1598.0 545.0Q1637 629 1709.5 677.5Q1782 726 1884 726Q1971 726 2031.5 695.0Q2092 664 2127.5 610.0Q2163 556 2177 487L2064 481Q2052 546 2010.0 586.5Q1968 627 1884 627Q1810 627 1763.0 590.0Q1716 553 1693.5 491.0Q1671 429 1671 354Q1671 276 1693.5 215.0Q1716 154 1763.5 118.5Q1811 83 1885 83Q1943 83 1985.0 108.0Q2027 133 2050.5 176.0Q2074 219 2076 271H1886V362H2179V0H2105L2100 113Q2073 55 2013.0 19.5Q1953 -16 1880 -16Z M2314 0V710H2597Q2710 710 2776.5 652.0Q2843 594 2843 496Q2843 434 2807.5 389.5Q2772 345 2722 330Q2771 322 2798.5 292.0Q2826 262 2831 207L2850 0H2741L2724 193Q2721 236 2695.0 256.5Q2669 277 2610 277H2422V0ZM2422 376H2599Q2660 376 2695.5 406.0Q2731 436 2731 493Q2731 550 2694.5 580.5Q2658 611 2590 611H2422Z M2994 0V710H3102V0Z M3563 -16Q3460 -16 3386.0 28.5Q3312 73 3272.0 156.0Q3232 239 3232 354Q3232 469 3272.0 552.5Q3312 636 3386.0 681.0Q3460 726 3563 726Q3667 726 3741.5 681.0Q3816 636 3855.5 552.5Q3895 469 3895 354Q3895 239 3855.5 156.0Q3816 73 3741.5 28.5Q3667 -16 3563 -16ZM3563 83Q3666 83 3724.5 154.5Q3783 226 3783 354Q3783 482 3724.5 554.5Q3666 627 3563 627Q3461 627 3402.5 554.5Q3344 482 3344 354Q3344 226 3402.5 154.5Q3461 83 3563 83Z M4169 0V611H3951V710H4495V611H4277V0Z M4593 0V710H4701V406H5029V710H5137V0H5029V308H4701V0Z M5309 0V710H5771V611H5417V404H5759V308H5417V99H5779V0ZM5505 774 5415 908H5526L5589 774Z M6386 -67 6329 7Q6305 -4 6272.5 -10.0Q6240 -16 6204 -16Q6101 -16 6027.5 33.0Q5954 82 5915.0 165.5Q5876 249 5876 354Q5876 458 5914.0 542.5Q5952 627 6025.5 676.5Q6099 726 6204 726Q6311 726 6384.0 676.5Q6457 627 6495.0 542.5Q6533 458 6533 354Q6533 256 6498.5 176.0Q6464 96 6399 46L6489 -67ZM6204 83Q6223 83 6238.5 85.0Q6254 87 6265 92L6164 219H6267L6335 129Q6421 201 6421 354Q6421 428 6397.5 490.0Q6374 552 6326.0 589.5Q6278 627 6204 627Q6131 627 6083.0 589.5Q6035 552 6011.5 490.0Q5988 428 5988 354Q5988 281 6012.0 219.0Q6036 157 6084.0 120.0Q6132 83 6204 83Z M6924 -16Q6839 -16 6777.0 16.5Q6715 49 6681.5 109.0Q6648 169 6648 251V710H6756V251Q6756 170 6800.0 126.5Q6844 83 6924 83Q7004 83 7048.0 126.5Q7092 170 7092 251V710H7200V251Q7200 169 7166.5 109.0Q7133 49 7071.0 16.5Q7009 -16 6924 -16Z M7357 0V710H7819V611H7465V404H7807V308H7465V99H7827V0Z M8169.78 624.58V842.2H8226.82L8291.92 669.22L8357.64 842.2H8414.06V624.58H8371.28V775.86L8316.1 624.58H8267.74L8212.56 773.38V624.58ZM8030.28 624.58V801.28H7963.32V842.2H8141.26V801.28H8074.92V624.58Z" />
                </g>
              </svg>
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
            <a href="/events">événements</a>
            <span className="bo-nav__sep">·</span>
            <a href="/resources">ressources</a>
            <span className="bo-nav__sep">·</span>
            <a href="/leads">leads</a>
            <span className="bo-nav__sep">·</span>
            <a href="/defaults">textes</a>
            <span className="bo-nav__sep">·</span>
            <a href="/site/content">contenus site</a>
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
  .bo-brand__wordmark {
    height: 13px;
    width: auto;
    display: block;
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
