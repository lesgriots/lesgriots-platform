// Ossature du back office Griothèque.
//
// 30/08/2026 — REFONTE DE LISIBILITÉ. Ce qui a changé et pourquoi :
//
//   1. La navigation était onze liens séparés par des points médians sur une
//      seule ligne qui débordait, sans regroupement et sans état actif. Rien
//      ne disait où l'on se trouvait. Elle devient une barre latérale groupée
//      en trois familles, avec la page courante en encre pleine.
//   2. Le corps de texte était en monospace partout, formulaires longs
//      compris : plus large, plus fatigant, et il aplatissait la hiérarchie
//      puisque tout se ressemblait. Le corps passe en Geist Sans ; le mono
//      redevient la couche machine — étiquettes, en-têtes de colonne,
//      boutons, compteurs, identifiants, code.
//   3. Les titres montaient à 64 px, une taille d'affiche sur des pages dont
//      l'intérêt est la liste. Ils redescendent à 32 px au plus.
//   4. Les cartes de l'accueil n'avaient AUCUNE règle CSS : neuf liens
//      empilés sans cadre. C'est la première chose qu'on voit en entrant.
//   5. Le focus était identique à la souris et au clavier. Il devient un
//      anneau visible, et seulement au clavier.
//
// L'identité ne bouge pas : papier crème, encre, jaune de marque, Geist,
// mot-marque vectorisé.
//
// Le shim de basePath reste en tête : le BO est servi sous /griotheque via
// admin.lesgriots.com, et tout le code client utilise des URLs absolues.
import Barre from "./components/Barre";

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
  // XHR AUSSI, PAS SEULEMENT FETCH. Les champs de media uploadent par
  // XMLHttpRequest, seule facon d'afficher une barre de progression. Ces
  // appels echappaient au shim : ils partaient sur /api/upload, que le hub
  // envoie au BO Studio, et le fichier atterrissait dans le dossier du site
  // studio pendant que la Griotheque enregistrait un chemin introuvable.
  var oo = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function (method, url) {
    if (typeof url === "string" && url.charAt(0) === "/" && url.indexOf(BP + "/") !== 0) {
      url = BP + url;
      arguments[1] = url;
    }
    return oo.apply(this, arguments);
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


/* =====================================================================
   BACK OFFICE LA GRIOTHEQUE — feuille de style
   Identite conservee : papier creme, encre, jaune de marque, Geist.
   Ce qui change : la structure (barre laterale groupee), la hierarchie
   typographique (le corps passe en sans, le mono redevient la couche
   machine), la densite, et les etats.
   ===================================================================== */

:root {
  --paper:      #f6f5f3;
  --paper-2:    #efedea;
  --paper-3:    #e7e4df;
  --ink:        #000000;
  --ink-2:      rgba(0,0,0,0.68);
  --ink-dim:    rgba(0,0,0,0.50);
  --rule:       rgba(0,0,0,0.16);
  --rule-fort:  rgba(0,0,0,0.30);
  --accent:     #ffca00;
  --accent-soft:#ffe071;
  --danger:     #c62828;
  --ok:         #2e6b3e;

  --font-mono: "Geist Mono", "JetBrains Mono", ui-monospace, "Courier New", monospace;
  --font-sans: "Geist", "Inter", -apple-system, system-ui, sans-serif;

  --barre: 236px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  background: var(--paper);
  color: var(--ink);
  /* LE CORPS PASSE EN SANS. Le monospace restait sur tout, y compris les
     formulaires longs : plus large, plus fatigant, et il aplatissait la
     hierarchie puisque tout se ressemblait. Le mono garde ce qui est
     machine — etiquettes, en-tetes de colonne, boutons, compteurs, code. */
  font-family: var(--font-sans);
  font-size: 14.5px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

/* ---------- ossature ------------------------------------------------ */

.bo {
  display: grid;
  grid-template-columns: var(--barre) minmax(0, 1fr);
  min-height: 100vh;
}

.bo-barre {
  border-right: 1px solid var(--ink);
  background: var(--paper);
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.bo-marque {
  display: block;
  padding: 20px 20px 18px;
  border-bottom: 1px solid var(--ink);
  text-decoration: none;
  color: var(--ink);
}
.bo-marque__wordmark { display: block; width: 100%; height: auto; }
.bo-marque__sub {
  display: block;
  margin-top: 7px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-dim);
}

.bo-menu { padding: 6px 0 18px; flex: 1 1 auto; }

.bo-menu__groupe {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-dim);
  padding: 18px 20px 7px;
}

.bo-menu a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 20px;
  color: var(--ink-2);
  text-decoration: none;
  font-size: 14px;
  line-height: 1.3;
  border-left: 3px solid transparent;
}
.bo-menu a:hover { background: var(--paper-2); color: var(--ink); }
/* L'ETAT ACTIF EST LE POINT CENTRAL. Onze liens sans reperage, c'est ce
   qui rendait la navigation illisible : rien ne disait ou l'on etait. */
.bo-menu a[aria-current="page"] {
  background: var(--ink);
  color: var(--paper);
  border-left-color: var(--accent);
  font-weight: 500;
}
.bo-menu a[aria-current="page"] .bo-compte { color: var(--accent); border-color: transparent; }

.bo-compte {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--ink-dim);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  flex: 0 0 auto;
}
.bo-menu a > span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.bo-barre__pied {
  border-top: 1px solid var(--rule);
  padding: 14px 20px 18px;
  display: grid;
  gap: 10px;
}
.bo-barre__pied a.bo-lien-site {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-dim);
  text-decoration: none;
}
.bo-barre__pied a.bo-lien-site:hover { color: var(--ink); }

/* ---------- contenu ------------------------------------------------- */

.bo-corps { min-width: 0; padding: 30px clamp(20px, 3.4vw, 46px) 110px; }
.bo-page  { max-width: 1180px; }
/* Les formulaires se lisent en colonne etroite : au-dela d'environ
   quatre-vingts caracteres, l'oeil perd la ligne en revenant a gauche. */
.bo-page--forme { max-width: 860px; }

.bo-tete {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--ink);
  margin-bottom: 26px;
}
.bo-tete__gauche { min-width: 0; }
.bo-fil {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-dim);
  margin-bottom: 8px;
}
.bo-fil a { color: inherit; text-decoration: none; }
.bo-fil a:hover { color: var(--ink); }

h1 {
  font-family: var(--font-sans);
  /* Descendu de 64 px : un titre d'affiche mangeait un tiers de l'ecran
     sur une page dont l'interet est la liste, pas le titre. */
  font-size: clamp(24px, 2.4vw, 32px);
  font-weight: 400;
  line-height: 1.08;
  letter-spacing: -0.02em;
  color: var(--ink);
}
/* Le compteur d'une liste : une pastille a cote du titre, pas dans le
   titre. Il change pendant le chargement, il ne doit pas faire sauter la
   ligne. */
.bo-tete__compte {
  display: inline-block;
  margin-left: 12px;
  padding: 2px 9px;
  vertical-align: 0.28em;
  background: var(--paper-3);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
  color: var(--ink-2);
}

h2 {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--ink-dim);
  margin: 34px 0 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--rule);
}
h3 {
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.01em;
  margin: 20px 0 8px;
}

p { color: var(--ink-2); }
.note { color: var(--ink-dim); font-size: 12.5px; margin: 6px 0 0; max-width: 76ch; }

a { color: var(--ink); text-underline-offset: 3px; text-decoration-color: var(--rule-fort); }
a:hover { text-decoration-color: var(--ink); }

/* Un anneau de focus VISIBLE, et seulement au clavier. L'ancien style
   posait la meme ombre au clic et au clavier : on ne savait jamais ou
   etait le focus reel. */
:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 2px;
  border-radius: 1px;
}

/* ---------- cartes d'accueil ---------------------------------------- */
/* Elles n'avaient AUCUN style : neuf liens empiles, sans cadre ni
   hierarchie. C'est la premiere chose qu'on voit en entrant. */
.bo-cartes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1px;
  margin-top: 26px;
}
.bo-carte {
  background: var(--paper);
  /* Le filet passe par une ombre, pas par le fond de la grille : une
     derniere rangee incomplete laissait sinon des cases grises vides. */
  box-shadow: 0 0 0 1px var(--rule);
  padding: 20px 20px 18px;
  text-decoration: none;
  color: var(--ink);
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-height: 124px;
  transition: background 0.12s;
}
.bo-carte:hover { background: var(--accent); }
.bo-carte__titre {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}
.bo-carte__desc { font-size: 13px; color: var(--ink-dim); flex: 1 1 auto; }
.bo-carte:hover .bo-carte__desc { color: var(--ink-2); }
.bo-carte__compte {
  font-family: var(--font-mono);
  font-size: 22px;
  font-weight: 400;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

/* ---------- formulaires --------------------------------------------- */

label {
  display: block;
  margin: 0 0 6px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--ink-dim);
  text-transform: uppercase;
  letter-spacing: 0.13em;
}
.champ { margin: 18px 0 0; }
.champ__aide { font-size: 12px; color: var(--ink-dim); margin-top: 6px; }

input, textarea, select {
  font: inherit;
  font-family: var(--font-sans);
  color: var(--ink);
  background: #fff;
  border: 1px solid var(--rule-fort);
  padding: 9px 11px;
  border-radius: 0;
  width: 100%;
}
/* Les valeurs techniques restent en mono : un slug, un identifiant ou une
   URL se relisent caractere par caractere. */
input.mono, textarea.mono { font-family: var(--font-mono); font-size: 13px; }
input:hover, textarea:hover, select:hover { border-color: var(--ink-2); }
input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--ink);
  box-shadow: 0 0 0 2px var(--accent-soft);
}
input:disabled, textarea:disabled, select:disabled {
  background: var(--paper-2); color: var(--ink-dim); cursor: not-allowed;
}
textarea { resize: vertical; min-height: 96px; line-height: 1.5; }

.row { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }

/* ---------- boutons -------------------------------------------------- */

.btn {
  background: var(--ink);
  color: var(--paper);
  border: 1px solid var(--ink);
  padding: 10px 18px;
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: 11.5px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  text-decoration: none;
  display: inline-block;
  transition: background 0.13s, color 0.13s;
}
.btn:hover { background: var(--accent); color: var(--ink); }
.btn--ghost { background: transparent; color: var(--ink); }
.btn--ghost:hover { background: var(--ink); color: var(--paper); }
.btn--accent { background: var(--accent); color: var(--ink); }
.btn--accent:hover { background: var(--ink); color: var(--accent); }
.btn--danger { background: transparent; color: var(--danger); border-color: var(--danger); }
.btn--danger:hover { background: var(--danger); color: #fff; }
.btn--petit { padding: 5px 10px; font-size: 10.5px; letter-spacing: 0.07em; }
.btn--large { width: 100%; text-align: center; padding: 11px 14px; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }

/* La barre d'actions d'un formulaire colle en bas : sur une fiche
   formation de deux ecrans, « Enregistrer » etait hors de vue en
   permanence. */
.bo-actions-collees {
  position: sticky;
  bottom: 0;
  margin-top: 30px;
  padding: 14px 0;
  background: linear-gradient(to top, var(--paper) 72%, rgba(246,245,243,0));
  border-top: 1px solid var(--rule);
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

/* ---------- tableaux -------------------------------------------------- */

.bo-tableau { overflow-x: auto; border: 1px solid var(--rule); margin-top: 20px; background: var(--paper); }
table { width: 100%; border-collapse: collapse; min-width: 640px; }
th, td { text-align: left; padding: 11px 14px; border-bottom: 1px solid var(--rule); vertical-align: middle; }
th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--paper-2);
  font-family: var(--font-mono);
  font-size: 9.5px;
  color: var(--ink-dim);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-weight: 500;
  border-bottom: 1px solid var(--ink);
  white-space: nowrap;
}
tbody tr:last-child td { border-bottom: 0; }
tbody tr:hover td { background: var(--paper-2); }
td.num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 13px; }
td .actions { justify-content: flex-end; }

/* ---------- divers ---------------------------------------------------- */

.pill {
  display: inline-block;
  padding: 2px 8px;
  border: 1px solid var(--rule-fort);
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--ink-2);
}
.pill--on { border-color: var(--ok); color: var(--ok); }
.pill--off { border-color: var(--rule-fort); color: var(--ink-dim); }
.empty {
  color: var(--ink-dim);
  padding: 54px 30px;
  text-align: center;
  border: 1px dashed var(--rule-fort);
  margin-top: 20px;
  font-size: 13.5px;
}
code {
  background: var(--paper-3);
  padding: 1px 6px;
  font-family: var(--font-mono);
  font-size: 12px;
}
.bo-caret {
  display: inline-block; width: 0.5em; margin-left: 2px;
  color: var(--ink); font-weight: 300; line-height: 1;
  animation: bo-caret-blink 1s steps(1) infinite;
}
@keyframes bo-caret-blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }

/* ---------- telephone -------------------------------------------------- */

.bo-burger { display: none; }
.bo-voile { display: none; }

@media (max-width: 900px) {
  .bo { grid-template-columns: minmax(0, 1fr); }
  .bo-barre {
    position: fixed;
    top: 0; left: 0; bottom: 0;
    width: 268px;
    z-index: 60;
    transform: translateX(-100%);
    transition: transform 220ms cubic-bezier(0.16,0.84,0.18,1);
    box-shadow: 0 0 0 1px var(--ink);
  }
  .bo.est-ouvert .bo-barre { transform: translateX(0); }
  .bo-voile {
    display: block;
    position: fixed; inset: 0; z-index: 55;
    background: rgba(0,0,0,0.35);
    opacity: 0; pointer-events: none;
    transition: opacity 220ms ease;
  }
  .bo.est-ouvert .bo-voile { opacity: 1; pointer-events: auto; }
  .bo-burger {
    display: flex;
    align-items: center;
    gap: 10px;
    position: sticky; top: 0; z-index: 50;
    width: 100%;
    padding: 12px 18px;
    background: var(--paper);
    border: 0;
    border-bottom: 1px solid var(--ink);
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink);
  }
  .bo-burger__traits { display: inline-flex; flex-direction: column; gap: 3px; }
  .bo-burger__traits i { display: block; width: 16px; height: 1.5px; background: var(--ink); }
  .bo-corps { padding: 20px 18px 90px; }
  .bo-tete { align-items: flex-start; flex-direction: column; gap: 12px; }
  .row { grid-template-columns: 1fr; }
  .bo-cartes { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}

`;

export const metadata = {
  title: "Back office · LA GRIOTHÈQUE",
  robots: { index: false, follow: false },
};

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
        <Barre>{children}</Barre>
      </body>
    </html>
  );
}
