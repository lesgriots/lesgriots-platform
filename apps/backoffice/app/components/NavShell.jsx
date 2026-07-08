// Coquille de navigation du back office (client).
// Sidebar groupée + état actif (usePathname) + drawer mobile.
// Garde l'ADN terminal : mono, prompt ">", or moutarde / jaune.
"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import SyncButton from "./SyncButton";

// Groupes de navigation. Chaque lien : { href, label, external? }.
const GROUPS = [
  {
    title: "Projets",
    links: [
      { href: "/", label: "Tous les projets" },
      { href: "/projects/new", label: "+ Nouveau projet" },
    ],
  },
  {
    title: "Contenu du site",
    links: [
      { href: "/site/about", label: "About" },
      { href: "/site/talent", label: "Talent" },
      { href: "/site/services", label: "Services" },
      { href: "/site/ecosysteme", label: "Écosystème" },
      { href: "/site/kora", label: "Son du Griot" },
      { href: "/site/pages", label: "Pages actives" },
    ],
  },
];

export default function NavShell() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);

  // "/" ne doit être actif que sur l'accueil exact ; les autres sur préfixe.
  function isActive(href) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {/* Barre mobile : sticker + burger. Cachée en desktop. */}
      <header className="bo-mobilebar">
        <a href="/" className="bo-mobilebar__brand" aria-label="Accueil back office">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/preview?p=img/sticker.png" alt="LESGRIOTSXSTUDIO" />
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

      {/* Voile de fermeture (mobile, quand le menu est ouvert). */}
      {open && <div className="bo-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      {/* Sidebar : fixe en desktop, drawer en mobile. */}
      <aside className={`bo-sidebar${open ? " bo-sidebar--open" : ""}`}>
        <a href="/" className="bo-sidebar__brand" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/preview?p=img/sticker.png" alt="LESGRIOTSXSTUDIO" />
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
                href="https://lesgriotsxstudio.com"
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
