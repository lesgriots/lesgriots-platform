// Coquille de navigation du back office LES GRIOTS (site ombrelle).
// Sidebar groupée + état actif (usePathname) + drawer mobile.
// Garde l'ADN terminal : mono, prompt ">", or moutarde / jaune.
"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import SyncButton from "./SyncButton";

// Groupes de navigation. Chaque lien : { href, label }.
const GROUPS = [
  {
    title: "Site ombrelle",
    links: [
      { href: "/", label: "Tableau de bord" },
      { href: "/site-mode", label: "Mode du site" },
      { href: "/home-video", label: "Vidéo d'accueil" },
      { href: "/projects", label: "Projets (stage)" },
      { href: "/about", label: "About + liens" },
      { href: "/shop", label: "Boutique" },
    ],
  },
];

export default function NavShell() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);

  function isActive(href) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {/* Barre mobile : logo + burger. Cachée en desktop. */}
      <header className="bo-mobilebar">
        <a href="/" className="bo-mobilebar__brand" aria-label="Accueil back office">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/preview?p=assets/les-griots-logo.png" alt="LES GRIOTS" />
        </a>
        <button
          type="button"
          className="bo-burger"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "✕" : "≡"} <span>Menu</span>
        </button>
      </header>

      {open && <div className="bo-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside className={`bo-sidebar${open ? " bo-sidebar--open" : ""}`}>
        <a href="/" className="bo-sidebar__brand" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/preview?p=assets/les-griots-logo.png" alt="LES GRIOTS" />
          <span className="bo-sidebar__tag">BACK · OFFICE</span>
        </a>

        <nav className="bo-sidenav">
          {GROUPS.map((g) => (
            <div className="bo-navgroup" key={g.title}>
              <div className="bo-navgroup__title">{g.title}</div>
              {g.links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className={`bo-navlink${isActive(l.href) ? " bo-navlink--active" : ""}`}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </a>
              ))}
            </div>
          ))}

          <div className="bo-navgroup">
            <div className="bo-navgroup__title">Actions</div>
            <div className="bo-sidenav__actions">
              <SyncButton />
              <a
                href="https://lesgriots.com"
                target="_blank"
                rel="noopener noreferrer"
                className="bo-navlink bo-navlink--ext"
                onClick={() => setOpen(false)}
              >
                Voir le site ↗
              </a>
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
}
