// La barre laterale du back office.
//
// Composant client parce qu'il lui faut deux choses que le serveur ne peut
// pas donner : savoir quelle page est ouverte (pour l'etat actif, qui est
// tout l'interet du changement), et ouvrir ou fermer le tiroir sur telephone.
//
// Les compteurs sont charges une fois et affiches a cote de chaque entree :
// on sait combien il y a de formations sans avoir a ouvrir la page.
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import ExportButton from "./ExportButton";

const GROUPES = [
  {
    titre: "Catalogue",
    entrees: [
      { href: "/formations", libelle: "Formations", api: "formations" },
      { href: "/workshops", libelle: "Workshops", api: "workshops" },
      { href: "/events", libelle: "Evenements", api: "events" },
      { href: "/sessions", libelle: "Sessions", api: "sessions" },
      { href: "/trainers", libelle: "Intervenants", api: "trainers" },
    ],
  },
  {
    titre: "Contenus",
    entrees: [
      { href: "/site/content", libelle: "Contenus du site" },
      { href: "/defaults", libelle: "Textes par defaut" },
      { href: "/pages", libelle: "Pages actives" },
      { href: "/resources", libelle: "Ressources", api: "resources" },
    ],
  },
  {
    titre: "Relation",
    entrees: [
      { href: "/leads", libelle: "Leads", api: "leads" },
      { href: "/projects", libelle: "Projets", api: "projects" },
    ],
  },
];

export default function Barre({ children }) {
  const chemin = usePathname() || "/";
  const [ouvert, setOuvert] = useState(false);
  const [comptes, setComptes] = useState({});

  // Le tiroir se referme des qu'on change de page : sinon il reste ouvert
  // par-dessus la page qu'on vient de demander.
  useEffect(() => { setOuvert(false); }, [chemin]);

  // Echap referme, comme partout ailleurs.
  useEffect(() => {
    function auClavier(e) { if (e.key === "Escape") setOuvert(false); }
    window.addEventListener("keydown", auClavier);
    return () => window.removeEventListener("keydown", auClavier);
  }, []);

  useEffect(() => {
    const aCompter = GROUPES.flatMap((g) => g.entrees).filter((e) => e.api);
    Promise.all(
      aCompter.map((e) =>
        fetch(`/api/${e.api}`)
          .then((r) => (r.ok ? r.json() : []))
          .then((t) => [e.href, Array.isArray(t) ? t.length : null])
          .catch(() => [e.href, null])
      )
    ).then((paires) => setComptes(Object.fromEntries(paires)));
  }, []);

  // Une entree est active si le chemin lui correspond exactement, ou s'il
  // s'agit d'une de ses fiches : /formations/ecrire-pour-le-web garde
  // « Formations » allume. On prend la correspondance la plus longue pour que
  // /site/content ne soit pas eclipse par une entree plus courte.
  const actif = GROUPES
    .flatMap((g) => g.entrees)
    .filter((e) => chemin === e.href || chemin.startsWith(e.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <div className={"bo" + (ouvert ? " est-ouvert" : "")}>
      <button
        className="bo-burger"
        type="button"
        aria-expanded={ouvert}
        aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
        onClick={() => setOuvert((v) => !v)}
      >
        <span className="bo-burger__traits" aria-hidden="true"><i /><i /><i /></span>
        {actif ? actif.libelle : "Menu"}
      </button>

      <div className="bo-voile" onClick={() => setOuvert(false)} aria-hidden="true" />

      <aside className="bo-barre">
        <a className="bo-marque" href="/">
          <svg
            className="bo-marque__wordmark"
            viewBox="0 0 8448 1095"
            role="img"
            aria-label="LA GRIOTHEQUE"
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
          <span className="bo-marque__sub">back office</span>
        </a>

        <nav className="bo-menu" aria-label="Sections du back office">
          {GROUPES.map((g) => (
            <div key={g.titre}>
              <div className="bo-menu__groupe">{g.titre}</div>
              {g.entrees.map((e) => {
                const estActif = actif && actif.href === e.href;
                const n = comptes[e.href];
                return (
                  <a key={e.href} href={e.href} aria-current={estActif ? "page" : undefined}>
                    <span>{e.libelle}</span>
                    {typeof n === "number" && <span className="bo-compte">{n}</span>}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="bo-barre__pied">
          <a
            className="bo-lien-site"
            href="https://lagriotheque.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Voir le site &#8599;
          </a>
          <ExportButton variant="btn" />
        </div>
      </aside>

      <main className="bo-corps">{children}</main>
    </div>
  );
}
