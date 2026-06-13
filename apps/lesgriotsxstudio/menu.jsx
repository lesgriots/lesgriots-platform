/* global React, Type, useLang, setLang, tr, MatrixGriot */
// Top-right inline menu (Frame 136 style) + FR/EN switch + STRIP/INDEX toggle + INQUIRY

function MenuBar({ view, onNavigate }) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef(null);
  // openSeq is bumped every time the menu opens, so the Type components
  // re-mount and the cascading typing animation plays from scratch.
  const [openSeq, setOpenSeq] = React.useState(0);
  React.useEffect(() => {
    if (open) setOpenSeq((s) => s + 1);
  }, [open]);

  // Toggle une classe sur body quand le menu s'ouvre/ferme. La classe sert
  // à appliquer un filter: blur direct sur le contenu de la page (méthode
  // fiable cross-browser, surtout iOS Safari où backdrop-filter peut
  // échouer à travers les stacking contexts du viewer).
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("menu-open", open);
    return () => { document.body.classList.remove("menu-open"); };
  }, [open]);

  // Close the menu when clicking outside of it, or when pressing Escape.
  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const lang = useLang();

  // Le back office peut désactiver des pages via window.SITE_CONTENT.activePages
  // ({work, about, eco}). Par défaut tout est activé.
  const activePages = (typeof window !== "undefined" &&
    window.SITE_CONTENT && window.SITE_CONTENT.activePages) || {};
  const isActive = (k) => activePages[k] !== false;
  // HOME a été retiré du menu — le sticker (.idcard) sert maintenant de
  // bouton "retour accueil" universel avec son propre label HOME/ACCUEIL
  // au hover. Le menu ne liste que les pages de contenu : WORK, ABOUT, ECO.
  //
  // /!\ id  → identifiant unique pour React.key (évite le warning "duplicate key")
  //     to  → cible de navigation (peut être identique entre 2 items)
  const items = [
    { id: "work",  to: "home",  label: tr("menu.work",  lang), active: isActive("work") },
    { id: "about", to: "about", label: tr("menu.about", lang), active: isActive("about") },
    { id: "eco",   to: "eco",   label: tr("menu.eco",   lang), active: isActive("eco") },
  ].filter((it) => it.active);

  function pick(it) {
    onNavigate(it.to);
    setOpen(false);
  }

  // Language switch — trigger the matrix-griot "binarize" effect:
  // every text node on the page flickers as 0/1 digits, and we swap the
  // language at the midpoint so the change is hidden behind the noise.
  // While swapping, we set window.__skipType so Type components render
  // the new-language text instantly instead of re-typing it.
  function pickLang(l) {
    if (l === lang) return;
    const swap = () => {
      window.__skipType = true;
      setLang(l);
      // React re-renders + useEffects run synchronously after setState;
      // a short timeout makes sure every Type has seen the flag.
      setTimeout(() => { window.__skipType = false; }, 80);
    };
    if (window.binarizePage) {
      window.binarizePage({ duration: 1200, onHalf: swap });
    } else {
      swap();
    }
  }

  return (
    <div ref={rootRef} className={"menubar" + (open ? " open" : "")}>
      <div className="menubar__topline">
        <div className="menubar__lang">
          <button
            className={lang === "en" ? "is-active" : ""}
            onClick={() => pickLang("en")}
            aria-label="English">
            <Type text="EN" speed={40} cursor="while" key={"l-en-"+lang} />
          </button>
          <span className="sep">/</span>
          <button
            className={lang === "fr" ? "is-active" : ""}
            onClick={() => pickLang("fr")}
            aria-label="Français">
            <Type text="FR" speed={40} delay={80} cursor="while" key={"l-fr-"+lang} />
          </button>
        </div>
        <button className="menubar__toggle" onClick={() => setOpen((o) => !o)}>
          <span className="menubar__toggle__text">
            [ <Type text={tr("menu.menu", lang)} speed={32} delay={160} cursor="while" key={"mtog-"+lang} /> ]
          </span>
        </button>
      </div>
      <div
        className="menubar__term"
        role="dialog"
        aria-label="Menu"
        onClick={(e) => {
          // Tap dans la zone vide du panel (la moitié basse transparente
          // OU les espaces entre les items) → ferme le menu.
          // Tout tap dont la cible n'est PAS un élément cliquable
          // (button, a, ou enfant d'un button/a) ferme le menu.
          const t = e.target;
          if (t && t.closest && t.closest("button, a")) return;
          setOpen(false);
        }}
      >
        <div className="menubar__term__bar">
          <span className="menubar__term__dots" aria-hidden="true">
            <span className="d d--y"></span>
          </span>
          <span className="menubar__term__title">~ menu.sh</span>
          <button
            className="menubar__term__x"
            onClick={() => setOpen(false)}
            aria-label="Close menu">×</button>
        </div>
        {/* Switch de langue dans le menu (visible uniquement en mobile via
            CSS) — duplique le switch du topline qui est masqué sur mobile.
            Permet à l'utilisateur d'accéder à la langue depuis le menu
            ouvert sans avoir à fermer pour atteindre le topline. */}
        <div className="menubar__lang menubar__lang--in-term">
          <button
            className={lang === "en" ? "is-active" : ""}
            onClick={() => pickLang("en")}
            aria-label="English">
            EN
          </button>
          <span className="sep">/</span>
          <button
            className={lang === "fr" ? "is-active" : ""}
            onClick={() => pickLang("fr")}
            aria-label="Français">
            FR
          </button>
        </div>
        <div className="menubar__items">
          {items.map((it, i) => {
            const speed = 28;
            const prevDuration = items
              .slice(0, i)
              .reduce((acc, p) => acc + p.label.length * speed + 200, 0);
            return (
              <button
                key={it.id}
                className={view === it.to ? "active" : ""}
                onClick={() => pick(it)}
              >
                <span className="prompt" aria-hidden="true">&gt;</span>
                <Type
                  text={it.label}
                  speed={speed}
                  delay={prevDuration}
                  cursor={view === it.to ? "always" : "while"}
                  key={"m-" + it.id + "-" + lang + "-" + openSeq}
                />
                {/* "VOIR" / "VIEW" retiré — le prompt > et le label
                    suffisent, plus simple visuellement. */}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

window.MenuBar = MenuBar;


