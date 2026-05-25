/* global React, ReactDOM, FORMATIONS, WORKSHOPS, TRAINERS, SESSIONS, RESOURCES, MatrixGriot */
// LA GRIOTHÈQUE — vitrine + catalogue des formations

const { useState, useEffect, useRef, useLayoutEffect } = React;

// Hook qui mesure UN titre et règle font-size pour qu'il remplisse
// la largeur du parent sur une seule ligne (sans dépasser maxSize).
function useFitOne(maxSize = 200) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const container = el.parentElement;
      if (!container) return;
      // Mesure : on force temporairement maxSize pour calculer le ratio
      el.style.fontSize = maxSize + "px";
      el.style.whiteSpace = "nowrap";
      const cw = container.clientWidth;
      const tw = el.scrollWidth;
      if (tw > 0 && cw > 0) {
        const scale = Math.min(1, cw / tw);
        const newSize = Math.floor(maxSize * scale * 0.985);
        // On expose la taille via CSS variable plutôt qu'inline → permet à
        // .is-stuck d'utiliser calc(var(--fit-size) * 0.5) pour shrinker
        // la font sans toucher au transform (la barre garde sa pleine largeur).
        el.style.fontSize = "";
        el.style.setProperty("--fit-size", newSize + "px");
      }
    };
    fit();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fit).catch(() => {});
    }
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return ref;
}

// Hook qui mesure si un titre dépasse de son conteneur et expose
// la distance de débordement comme variable CSS (--overflow) pour
// déclencher le marquee CSS au hover.
function useMarqueeOverflow(deps) {
  const titleRef = useRef(null);
  useLayoutEffect(() => {
    const title = titleRef.current;
    if (!title) return;
    const inner = title.querySelector(".lg__marquee__inner");
    const measure = () => {
      const cw = title.clientWidth;
      const tw = inner ? inner.scrollWidth : title.scrollWidth;
      const overflow = Math.max(0, tw - cw);
      if (overflow > 0) {
        title.classList.add("is-overflowing");
        title.style.setProperty("--overflow", `-${overflow}px`);
        // Vitesse ~60 px/s
        title.style.setProperty(
          "--marquee-duration",
          `${Math.max(2.5, overflow / 60)}s`
        );
      } else {
        title.classList.remove("is-overflowing");
      }
    };
    measure();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line
  }, deps || []);
  return titleRef;
}

function MenuRow({ items }) {
  return (
    <div className="lg__menu__row">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {item}
          {i < items.length - 1 && <span className="lg__menu__sep">•</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

function Header({ route }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e) => { if (e.key === "Escape") closeDrawer(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // Ferme le drawer quand la route change
  useEffect(() => { setDrawerOpen(false); }, [route]);

  const navLink = (target, label) => (
    <a
      href={"#/" + target}
      className={"lg__menu__link" + (route === target ? " is-active" : "")}
      onClick={closeDrawer}
    >
      {label}
    </a>
  );
  const homeLink = (
    <a
      href="#/"
      className={"lg__menu__link" + (route === "" ? " is-active" : "")}
      onClick={closeDrawer}
    >la griothèque</a>
  );
  const utilityLinks = [
    <a key="news" href="mailto:formations@lesgriots.com?subject=Newsletter" className="lg__menu__link">souscrire à notre newsletter</a>,
    <a key="ig" href="https://instagram.com/lagriotheque" className="lg__menu__link" target="_blank" rel="noopener">instagram</a>,
    <a key="li" href="https://linkedin.com" className="lg__menu__link" target="_blank" rel="noopener">linkedin</a>,
  ];
  // Filtre les liens de nav selon les pages actives configurées dans le backoffice.
  // window.SITE_CONFIG.activePages = { home: true, formations: false, ... }
  // Par défaut (config absente), tout est actif — pas de régression.
  const activePages = (typeof window !== "undefined" && window.SITE_CONFIG && window.SITE_CONFIG.activePages) || {};
  const isActive = (key) => activePages[key] !== false;

  // Le mapping ci-dessous lie clé backoffice ↔ route ↔ lien JSX.
  // Si la page est désactivée, son lien disparaît du menu et l'accès URL
  // est bloqué (cf. route guard plus bas dans le router).
  const allNavLinks = [
    { key: "home", node: homeLink },
    { key: "formations", node: navLink("catalogue", "formations") },
    { key: "workshops", node: navLink("workshops", "workshops") },
    { key: "agenda", node: navLink("agenda", "agenda") },
    { key: "ressources", node: navLink("ressources", "ressources") },
    { key: "approche", node: navLink("approche", "notre approche") },
    { key: "contact", node: navLink("contact", "à propos") },
  ];
  const navLinks = allNavLinks.filter((l) => isActive(l.key)).map((l) => l.node);

  return (
    <>
      <header className="lg__header">
        <a className="lg__header__griot" href="#/" aria-label="Accueil">
          <GriotRing />
        </a>
        <a className="lg__header__wordmark" href="#/" aria-label="Accueil">
          LA&nbsp;GRIOTHÈQUE
        </a>
        <div className="lg__menu">
          <MenuRow items={utilityLinks} />
          <MenuRow items={navLinks} />
        </div>
        <button
          className="lg__header__menubtn"
          aria-label="Ouvrir le menu"
          onClick={() => setDrawerOpen(true)}
          type="button"
        >
          Menu
        </button>
      </header>

      {drawerOpen && (
        <div className="lg__drawer" onClick={closeDrawer}>
          <div className="lg__drawer__panel" onClick={(e) => e.stopPropagation()}>
            <button
              className="lg__drawer__close"
              aria-label="Fermer le menu"
              onClick={closeDrawer}
              type="button"
            >Fermer</button>
            <nav className="lg__drawer__nav">
              {navLinks.map((el, i) => (
                <div key={i} className="lg__drawer__item">{el}</div>
              ))}
            </nav>
            <nav className="lg__drawer__nav lg__drawer__nav--utility">
              {utilityLinks.map((el, i) => (
                <div key={i} className="lg__drawer__item">{el}</div>
              ))}
            </nav>
            <div className="lg__drawer__griot" aria-hidden="true">
              <GriotRing />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function GriotRing() {
  return (
    <div className="lg__hero__griot__wrap">
      <MatrixGriot />
      <svg
        className="lg__hero__griot__ring"
        viewBox="0 0 400 400"
        aria-hidden="true"
      >
        <defs>
          <path
            id="lg-ring-path"
            d="M 200,200 m -155,0 a 155,155 0 1,1 310,0 a 155,155 0 1,1 -310,0"
          />
        </defs>
        <text>
          <textPath href="#lg-ring-path" startOffset="0%">LA GRIOTHÈQUE</textPath>
        </text>
        <text>
          <textPath href="#lg-ring-path" startOffset="33.333%">LA GRIOTHÈQUE</textPath>
        </text>
        <text>
          <textPath href="#lg-ring-path" startOffset="66.666%">LA GRIOTHÈQUE</textPath>
        </text>
      </svg>
    </div>
  );
}

function Splash({ onEnter }) {
  const [loadingText, setLoadingText] = useState("░░░░░░░");

  // Scramble pixel : ░ ▒ ▓ █ qui se résolvent progressivement en LOADING
  useEffect(() => {
    const target = "LOADING";
    const blocks = "░▒▓█";
    let frame = 0;
    const id = setInterval(() => {
      frame++;
      const out = target
        .split("")
        .map((c, i) => (frame > i * 2 + 3 ? c : blocks[Math.floor(Math.random() * blocks.length)]))
        .join("");
      setLoadingText(out);
      if (frame > target.length * 2 + 8) clearInterval(id);
    }, 70);
    return () => clearInterval(id);
  }, []);

  // Auto-dismiss après ~1.9s (même timing que le boot du site studio).
  useEffect(() => {
    const t = setTimeout(() => onEnter && onEnter(), 1900);
    return () => clearTimeout(t);
  }, [onEnter]);

  return (
    <section
      className="lg__splash"
      onClick={onEnter}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onEnter(); }}
    >
      <div className="lg__splash__veil" />
      <div className="lg__splash__center">
        <GriotRing />
      </div>
      <p className="lg__splash__sub">{loadingText}</p>
      <div className="lg__splash__cue" aria-hidden="true">[ ENTRER ]</div>
    </section>
  );
}

function Manifesto() {
  const [videoReady, setVideoReady] = useState(false);
  const [loadingText, setLoadingText] = useState("00000000");
  const heroVideoRef = useRef(null);

  // Bouton "plein écran" : passe la vidéo en fullscreen avec controls + son
  const playFullVideo = () => {
    const v = heroVideoRef.current;
    if (!v) return;
    v.muted = false;
    v.controls = true;
    v.currentTime = 0;
    const req = v.requestFullscreen || v.webkitRequestFullscreen || v.msRequestFullscreen;
    if (req) req.call(v);
    v.play();
  };

  // Quand on sort du fullscreen, on retire les controls et on remute (pour la boucle d'ambiance)
  useEffect(() => {
    const onFsChange = () => {
      const v = heroVideoRef.current;
      if (!v) return;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        v.muted = true;
        v.controls = false;
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  // Effet scramble : 0/1 aléatoires qui se résolvent progressivement en "LOADING…"
  useEffect(() => {
    if (videoReady) return;
    const target = "LOADING…";
    const noise = "01·=–";
    let frame = 0;
    const id = setInterval(() => {
      frame++;
      const out = target
        .split("")
        .map((c, i) => (frame > i * 2 + 4 ? c : noise[Math.floor(Math.random() * noise.length)]))
        .join("");
      setLoadingText(out);
      if (frame > target.length * 2 + 20) clearInterval(id);
    }, 70);
    return () => clearInterval(id);
  }, [videoReady]);

  // Fallback : si la vidéo n'arrive pas à charger, on libère après 4s
  useEffect(() => {
    const t = setTimeout(() => setVideoReady(true), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {/* HERO splash : vidéo plein écran + griot géant + tagline (sans menu) */}
      <section className={"lg__hero-yard" + (videoReady ? " is-ready" : "")}>
        <div className="lg__hero-yard__media">
          <video
            ref={heroVideoRef}
            src="img/hero.mp4"
            autoPlay
            loop
            muted
            playsInline
            onCanPlay={() => setVideoReady(true)}
            onLoadedData={() => setVideoReady(true)}
          />
        </div>
        <button
          type="button"
          className="lg__hero-yard__watch"
          onClick={playFullVideo}
        >
          ▶ Voir la vidéo
        </button>
        {!videoReady && (
          <div className="lg__hero-yard__loading" aria-live="polite">
            {loadingText}
          </div>
        )}
        <div className="lg__hero-yard__brand" aria-hidden="true">
          <GriotRing />
        </div>
        <p className="lg__hero-yard__wordmark" aria-hidden="true">LA&nbsp;GRIOTHÈQUE</p>
        <a className="lg__hero-yard__play" href="#/agenda">
          ▶ Prochaines sessions
        </a>
        <div className="lg__hero-yard__tagline">
          <p>
            L'école de transmission<br />
            pour la nouvelle génération<br />
            créative.
          </p>
        </div>
        <div className="lg__hero-yard__scrollhint" aria-hidden="true">
          ↓ scroll
        </div>
        <PromoSticker />
      </section>

      {/* Manifeste — prose sous le hero */}
      <section className="lg__manifesto">
        <div className="lg__manifeste lg__manifeste--hero">
          <div className="lg__manifeste__prose">
            <p>
              <span className="lg-brand">LA GRIOTHÈQUE</span> est une école
              dédiée à la transmission de méthodes éprouvées sur le terrain,
              au croisement de la direction artistique, du récit de marque
              et de la production. Dans un paysage culturel saturé, où trop
              de talents avancent sans cadre et trop de récits puissants se
              dissipent faute de structure, nous offrons aux artistes, aux
              créatifs et aux entrepreneurs de la prochaine génération les
              outils pour bâtir leur récit et créer de nouveaux imaginaires.
            </p>
          </div>
        </div>
      </section>

      {/* LATEST — liste des formations à l'affiche, style YARD */}
      <section className="lg__latest">
        <div className="lg__latest__tabs">
          <span className="is-active">Nos formations</span>
          <a href="#/workshops">Workshops</a>
        </div>
        <div className="lg__latest__list">
          {FORMATIONS.filter((f) => f.available).map((f) => (
            <a
              key={f.id}
              href={"#/formations/" + f.id}
              className="lg__latest__row"
            >
              <span className="lg__latest__row__left">
                {f.discipline ? f.discipline.split(" · ")[0].toLowerCase() : "formation"}
              </span>
              <h3 className="lg__latest__row__title">{f.title}</h3>
              <span className="lg__latest__row__right">
                {f.duration ? f.duration.split(" · ").pop().toLowerCase() : ""}
              </span>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}

// Carte intervenant : nom + photo + bio toujours visibles (style SUPSI).
// Supporte un seul trainer OU un array (plusieurs formateurs listés).
function TrainerCard({ trainer }) {
  const list = Array.isArray(trainer) ? trainer : [trainer];
  return (
    <div className="lg__trainercard">
      {list.map((t, i) => {
        const full =
          (typeof TRAINERS !== "undefined" &&
            TRAINERS.find(
              (x) =>
                x.name.toUpperCase() === (t.name || "").toUpperCase() ||
                x.id === t.id
            )) ||
          null;
        const bio = full && full.bio ? full.bio : null;
        const photo = full && full.photo ? full.photo : null;
        return (
          <div className="lg__trainercard__item" key={t.id || t.name || i}>
            <h3 className="lg__trainercard__name">{t.name}</h3>
            <div className="lg__trainercard__panel">
              <div className="lg__trainercard__photo">
                {photo ? (
                  <img src={photo} alt={t.name} />
                ) : (
                  <div className="lg__trainercard__photo--placeholder" aria-hidden="true">
                    {t.name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                )}
              </div>
              <div className="lg__trainercard__bio">
                <p className="lg__trainercard__role">{t.role}</p>
                {bio ? <p>{bio}</p> : <p>Bio à venir.</p>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FormationRow({ f, onHover }) {
  const titleRef = useMarqueeOverflow([f.title]);
  const handleEnter = onHover ? () => onHover(f.video || "img/hero.mp4") : undefined;
  const handleLeave = onHover ? () => onHover(null) : undefined;
  return (
    <a
      className={"lg__row" + (f.available ? "" : " is-soon")}
      href={"#/formations/" + f.id}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <p className="lg__row__label">
        FORMATION · 2026
        {!f.available && <span className="lg__row__soon"> · PROCHAINEMENT</span>}
      </p>
      <h3 className="lg__row__title" ref={titleRef}>
        <span className="lg__marquee__inner">{f.title}</span>
      </h3>
    </a>
  );
}

// Rangée de section : titre cliquable. Fermée → ligne tight ; ouverte → titre
// proportion "Seasons" (géant + numéro en exposant + rule + contenu en dessous).
function SectionRow({ title, id, index, open, onToggle, children }) {
  const tightRef = useFitOne(64);
  const bigRef = useFitOne(220);
  if (open) {
    const num = "(" + String(index).padStart(2, "0") + ")";
    return (
      <div className="lg__section is-open" id={id}>
        <button
          type="button"
          className="lg__section-big__head"
          onClick={onToggle}
          aria-expanded={true}
        >
          <h2 className="lg__section-big__title" ref={bigRef}>
            {title}
            <sup className="lg__section-big__num">{num}</sup>
          </h2>
          <span className="lg__section__toggle" aria-hidden="true">−</span>
        </button>
        <div className="lg__section-big__body">{children}</div>
      </div>
    );
  }
  return (
    <div className="lg__section" id={id}>
      <button
        type="button"
        className="lg__section-head"
        onClick={onToggle}
        aria-expanded={false}
      >
        <span className="lg__section-head__num">{String(index).padStart(2, "0")}</span>
        <h2 className="lg__section-head__title" ref={tightRef}>{title}</h2>
        <span className="lg__section__toggle" aria-hidden="true">+</span>
      </button>
    </div>
  );
}

// Renvoie un libellé lisible pour une session, qu'elle vienne de l'ancien
// schéma (s.dateLabel) ou du nouveau (s.date au format ISO ou texte FR).
function sessionDateLabel(s) {
  if (!s) return "";
  if (s.dateLabel) return s.dateLabel;
  const d = parseSessionDate(s.date);
  if (d.day) return `${d.day} ${MONTHS_FR_LOWER[d.monthIdx] || ""} ${d.year}`.trim();
  return d.monthLabel || "";
}

// Vrai si la session pointe vers cet item (formation ou workshop). Tolère
// l'ancien schéma (s.kind + s.targetId) ET le nouveau (s.formation_id /
// s.workshop_id).
function sessionMatchesItem(s, item, kind) {
  if (!s || !item) return false;
  if (kind === "workshop") {
    return s.workshop_id === item.id || (s.kind === "workshop" && s.targetId === item.id);
  }
  return s.formation_id === item.id || (s.kind === "formation" && s.targetId === item.id);
}

function bookingHref(item, session) {
  const label = sessionDateLabel(session);
  const format = session ? (session.format || "") : "";
  const subject = encodeURIComponent(
    `Réservation — ${item.title}${label ? ` · ${label}` : ""}`
  );
  const body = encodeURIComponent(
    "Bonjour,\n\n" +
    "Je souhaite réserver une place pour :\n" +
    `· ${item.title}\n` +
    (session ? `· Session : ${label}${format ? ` (${format})` : ""}\n` : "") +
    `· Tarif : ${item.price}\n\n` +
    "Mes coordonnées :\n" +
    "Nom :\nPrénom :\nStatut (MDA/AE/EI/SASU/salarié·e) :\nTéléphone :\nFinancement envisagé (perso / OPCO / FAF) :\n\n" +
    "Merci pour votre retour.\n"
  );
  return `mailto:formations@lesgriots.com?subject=${subject}&body=${body}`;
}

function ProgramPage({ item, kind }) {
  const titleRef = useFitOne(160);
  const titleSentinelRef = useRef(null);
  const headerRef = useRef(null);
  const heroRef = useRef(null);
  const [showTitleInNav, setShowTitleInNav] = useState(false);
  const [pastVideo, setPastVideo] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [openSection, setOpenSection] = useState(null);
  const [showSommaire, setShowSommaire] = useState(false);
  const [titleStuck, setTitleStuck] = useState(false);
  const sommaireRef = useRef(null);
  const toggleSection = (id) =>
    setOpenSection((prev) => (prev === id ? null : id));

  // Fermer le sommaire au clic extérieur ou à Escape
  useEffect(() => {
    if (!showSommaire) return;
    const onClick = (e) => {
      if (sommaireRef.current && !sommaireRef.current.contains(e.target)) {
        setShowSommaire(false);
      }
    };
    const onKey = (e) => { if (e.key === "Escape") setShowSommaire(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [showSommaire]);

  // Ouvre une section puis scroll dessus (utilisé par le menu sticky).
  const openAndScrollTo = (id) => {
    setOpenSection(id);
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;
      const isMobile = window.matchMedia("(max-width: 600px)").matches;
      // hauteur du header + de la barre titre (variable) + du nav sections
      const titleH = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue("--lg-title-h") || "80",
        10
      );
      const offset = (isMobile ? 85 : 121) + titleH + 48;
      const y = el.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: y, behavior: "smooth" });
    });
  };

  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setShowTitleInNav(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-120px 0px 0px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [item && item.id]);

  // Détecter quand on passe sous la vidéo/image hero → afficher les liens nav
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setPastVideo(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-120px 0px 0px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [item && item.id]);

  // Détecter quand le titre est "stuck" sous le header via un sentinel
  // placé juste au-dessus. Le sentinel ne bouge pas quand le titre se transforme,
  // ce qui évite la boucle de feedback (tremblement au scroll).
  useEffect(() => {
    const title = titleRef.current;
    const sentinel = titleSentinelRef.current;
    if (!title || !sentinel || typeof IntersectionObserver === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 600px)").matches;
    const STUCK_TOP = isMobile ? 85 : 121;
    const obs = new IntersectionObserver(
      ([entry]) => {
        // Sentinel passé sous la ligne de stick → titre stuck
        const stuck = !entry.isIntersecting && entry.boundingClientRect.top < STUCK_TOP;
        if (stuck) {
          title.classList.add("is-stuck");
        } else {
          title.classList.remove("is-stuck");
        }
        setTitleStuck(stuck);
      },
      { rootMargin: `-${STUCK_TOP}px 0px 0px 0px`, threshold: [0, 1] }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [item && item.id]);

  // Exposer la hauteur du titre comme variable CSS pour positionner le menu
  // sticky des sections juste en-dessous (même quand le titre rétrécit).
  useEffect(() => {
    const title = titleRef.current;
    if (!title || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const h = Math.round(title.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--lg-title-h", h + "px");
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(title);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update);
    };
  }, [item && item.id]);


  // Track which section is currently in view (à droite du titre dans la sticky bar)
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const ids = [
      "description",
      "objectifs",
      "programme",
      "public",
      "prerequis",
      "duree",
      "lieu",
      "formateur",
      "moyens",
      "evaluation",
      "indicateurs",
      "delai",
      "accessibilite",
      "tarif",
    ];
    const seen = new Map();
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          seen.set(entry.target.id, entry.isIntersecting);
        });
        // Choisir la dernière section visible (dans l'ordre)
        const lastActive = ids.filter((id) => seen.get(id)).pop();
        setActiveSection(lastActive || null);
      },
      { rootMargin: "-180px 0px -55% 0px", threshold: 0 }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [item && item.id]);

  const SECTIONS_ORDER = [
    "description",
    "objectifs",
    "programme",
    "public",
    "prerequis",
    "duree",
    "lieu",
    "formateur",
    "moyens",
    "evaluation",
    "indicateurs",
    "delai",
    "accessibilite",
    "tarif",
  ];
  const SECTION_LABELS = {
    description: "Description",
    objectifs: "Objectifs pédagogiques",
    programme: "Programme",
    public: "Public",
    prerequis: "Pré-requis",
    duree: "Durée",
    lieu: "Lieu",
    formateur: "Formateur",
    moyens: "Moyens pédagogiques",
    evaluation: "Évaluation",
    indicateurs: "Indicateurs",
    delai: "Délai d'accès",
    accessibilite: "Accessibilité",
    tarif: "Tarif",
  };

  if (!item) return null;
  // Sessions associées à ce programme : on tolère les deux schémas
  // (ancien s.kind+s.targetId / nouveau s.formation_id|workshop_id).
  // Tri par date croissante via parseSessionDate (gère ISO et texte FR).
  const upcoming = SESSIONS
    .filter((s) => sessionMatchesItem(s, item, kind))
    .sort((a, b) => parseSessionDate(a.date || a.dateLabel).sortKey
      .localeCompare(parseSessionDate(b.date || b.dateLabel).sortKey));
  const nextSession =
    upcoming.find((s) => normalizeStatus(s.status).class === "open") || upcoming[0];
  const f = item; // alias pour minimiser le diff ci-dessous
  const kindLabel = kind === "workshop" ? "workshop" : "formation";
  const backHref = kind === "workshop" ? "#/workshops" : "#/catalogue";
  const backLabel = kind === "workshop" ? "← Retour aux workshops" : "← Retour aux formations";
  const disciplineLabel = f.discipline ? f.discipline.toLowerCase() : "";
  const scrollToId = (id) => (e) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      const isMobile = window.matchMedia("(max-width: 600px)").matches;
      // hauteur du header + de l'anchor nav sticky
      const offset = isMobile ? 85 + 56 : 121 + 60;
      const y = el.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <section className="lg__formation">
      <div className="lg__formation__head" ref={headerRef} aria-hidden="true" />
      <div ref={titleSentinelRef} aria-hidden="true" style={{ height: 0, margin: 0, padding: 0 }} />
      <h1 className="lg__formation__title" ref={titleRef}>{f.title}</h1>

      {f.media && (
        <div className="lg__formation__hero" ref={heroRef}>
          {f.media.type === "video" ? (
            <video
              src={f.media.src}
              poster={f.media.poster}
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            <img src={f.media.src} alt={f.title} />
          )}
          {f.tagline && (
            <p className="lg__formation__hero__tagline">{f.tagline}</p>
          )}
          {f.media.credit && (
            <p className="lg__formation__hero__credit">{f.media.credit}</p>
          )}
          <PromoSticker />
        </div>
      )}

      {/* Prochaines sessions — visible en permanence sous la vidéo */}
      <div className="lg__formation__upcoming">
        <div className="lg__formation__upcoming__head">
          <h2 className="lg__formation__upcoming__title">Prochaines sessions</h2>
          <a className="lg__formation__upcoming__more" href="#/agenda">voir l'agenda complet →</a>
        </div>
        {upcoming.length > 0 ? (
          <ul className="lg__formation__sessions">
            {upcoming.map((s) => {
              // Normalise pour supporter ancien + nouveau schéma de session.
              const dateLabel = sessionDateLabel(s);
              const status = normalizeStatus(s.status);
              const places = s.places || s.seats;
              const format = s.format || (s.online ? "en ligne" : "présentiel");
              return (
                <li key={s.id} className={"lg__formation__session is-" + status.class}>
                  <span className="lg__formation__session__date">{dateLabel}</span>
                  <span className="lg__formation__session__format">{format}</span>
                  <span className="lg__formation__session__status">
                    {status.class === "open" && places ? `${places} place${Number(places) > 1 ? "s" : ""}` : ""}
                    {status.class === "full" && "complet"}
                    {status.class === "soon" && "date à confirmer"}
                    {status.class === "cancel" && "annulée"}
                  </span>
                  {status.class === "open" ? (
                    <a className="lg__formation__session__book" href={bookingHref(item, s)}>
                      Réserver →
                    </a>
                  ) : (
                    <span className="lg__formation__session__book lg__formation__session__book--soon">
                      Bientôt
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="lg__formation__upcoming__empty">
            Aucune date confirmée pour le moment.{" "}
            <a href={bookingHref(item, null)}>Écris-nous</a>{" "}
            pour être prévenu·e dès l'ouverture des inscriptions.
          </p>
        )}
      </div>

      {/* Sommaire sticky plié — un bouton, click ouvre le panneau des 14 sections */}
      {pastVideo && (
        <div className="lg__sommaire" ref={sommaireRef}>
          <button
            type="button"
            className={"lg__sommaire__btn" + (showSommaire ? " is-open" : "")}
            onClick={() => setShowSommaire((v) => !v)}
            aria-expanded={showSommaire}
            aria-controls="sommaire-panel"
          >
            <span>[ Sommaire {activeSection ? `· ${SECTION_LABELS[activeSection]}` : ""} ]</span>
            <span className="lg__sommaire__btn__arrow" aria-hidden="true">{showSommaire ? "↑" : "↓"}</span>
          </button>
          {showSommaire && (
            <div id="sommaire-panel" className="lg__sommaire__panel" role="menu">
              <ol className="lg__sommaire__list">
                {SECTIONS_ORDER.map((id, i) => (
                  <li key={id}>
                    <button
                      type="button"
                      role="menuitem"
                      className={
                        "lg__sommaire__item" +
                        (openSection === id ? " is-open" : "") +
                        (activeSection === id ? " is-active" : "")
                      }
                      onClick={() => {
                        openAndScrollTo(id);
                        setShowSommaire(false);
                      }}
                    >
                      <span className="lg__sommaire__num">{String(i + 1).padStart(2, "0")}</span>
                      <span className="lg__sommaire__label">{SECTION_LABELS[id]}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* OVERVIEW — narratif style "The Futur" : hook + paragraphe alternés
          en pleine largeur, AVANT l'accordéon des sections détaillées */}
      {f.overview && f.overview.length > 0 && (
        <div className="lg__formation__overview">
          <p className="lg__formation__overview__kicker">Overview</p>
          {f.overview.map((pair, i) => (
            <div key={i} className="lg__formation__overview__block">
              <h3 className="lg__formation__overview__hook">{pair[0]}</h3>
              <p className="lg__formation__overview__p">{pair[1]}</p>
            </div>
          ))}
        </div>
      )}

      {/* 14 sections en accordéon — clic sur le titre pour déplier.
          L'ensemble du bloc des sections fermées prend 1/3 du viewport. */}
      <div className="lg__formation__sections">
      {[
        {
          id: "description",
          title: "description",
          body: f.description ? <p className="lg__formation__prose">{f.description}</p> : null,
        },
        {
          id: "objectifs",
          title: "objectifs pédagogiques",
          body:
            f.objectives && f.objectives.length > 0 ? (
              <ol>
                {f.objectives.map((o, i) => (
                  <li key={i}>
                    <span className="num">{String(i + 1).padStart(2, "0")}</span>
                    <span>{o}</span>
                  </li>
                ))}
              </ol>
            ) : null,
        },
        {
          id: "programme",
          title: "programme",
          body:
            f.program && f.program.length > 0 ? (
              <div className="lg__program">
                {f.program.map((d, i) => (
                  <div key={i} className="lg__program__day">
                    <span className="lg__program__day__tag">{d.day}</span>
                    {d.modules && d.modules.map((m, j) => (
                      <div key={j} className="lg__program__module">
                        <h4 className="lg__program__module__title">{m.title}</h4>
                        <ul className="lg__program__items">
                          {m.items.map((it, k) => <li key={k}>{it}</li>)}
                        </ul>
                      </div>
                    ))}
                    {d.exercises && d.exercises.length > 0 && (
                      <ul className="lg__program__exercises">
                        {d.exercises.map((ex, k) => (
                          <li key={k}><span className="lg__program__plus">+ </span>Exercice : {ex}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : f.chapters && f.chapters.length > 0 ? (
              <ol>
                {f.chapters.map((c, i) => (
                  <li key={i}>
                    <span className="num">{String(i + 1).padStart(2, "0")}</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ol>
            ) : null,
        },
        {
          id: "public",
          title: "public",
          body: f.audience ? <p className="lg__formation__prose">{f.audience}</p> : null,
        },
        {
          id: "prerequis",
          title: "pré-requis",
          body: f.prerequisites ? <p className="lg__formation__prose">{f.prerequisites}</p> : null,
        },
        {
          id: "duree",
          title: "durée",
          body: (
            <p className="lg__formation__prose">
              {f.duration || "—"}
              {f.format ? <> · {f.format.toLowerCase()}</> : null}
            </p>
          ),
        },
        {
          id: "lieu",
          title: "lieu",
          body: f.location ? <p className="lg__formation__prose">{f.location}</p> : null,
        },
        {
          id: "formateur",
          title: "formateur",
          body: f.trainer ? <TrainerCard trainer={f.trainer} /> : null,
        },
        {
          id: "moyens",
          title: "moyens pédagogiques",
          body: f.methods ? <p className="lg__formation__prose">{f.methods}</p> : null,
        },
        {
          id: "evaluation",
          title: "évaluation",
          body: f.evaluation ? <p className="lg__formation__prose">{f.evaluation}</p> : null,
        },
        {
          id: "indicateurs",
          title: "indicateurs",
          body: (
            <p className="lg__formation__prose">
              Indicateurs de satisfaction et de recommandation publiés après
              chaque session. La Griothèque démarre sa première promotion en
              2025 — les premiers chiffres seront disponibles à l'issue.
            </p>
          ),
        },
        {
          id: "delai",
          title: "délai d'accès",
          body: (
            <p className="lg__formation__prose">
              Réponse à toute demande sous 48h ouvrées. Inscription possible
              jusqu'à 14 jours avant le démarrage de la session, dans la
              limite des places disponibles.
            </p>
          ),
        },
        {
          id: "accessibilite",
          title: "accessibilité",
          body: f.accessibility ? <p className="lg__formation__prose">{f.accessibility}</p> : null,
        },
        {
          id: "tarif",
          title: "tarif",
          body: (
            <p className="lg__formation__prose">
              {f.price || "—"} — TVA non applicable (art. 293 B du CGI).
              {(f.cpf || f.opco) && (
                <> Prise en charge possible {f.opco ? "OPCO" : ""}{f.cpf && f.opco ? " · " : ""}{f.cpf ? "CPF" : ""}.</>
              )}
            </p>
          ),
        },
      ].map((s, i) => (
        <SectionRow
          key={s.id}
          id={s.id}
          title={s.title}
          index={i + 1}
          open={openSection === s.id}
          onToggle={() => toggleSection(s.id)}
        >
          {s.body}
        </SectionRow>
      ))}
      </div>

      {/* CTA discret — apparait dans la barre du titre quand elle est sticky */}
      {titleStuck && (
        <a
          className="lg__formation__cta-reserve"
          href={bookingHref(item, nextSession)}
        >
          Réserver →
        </a>
      )}

      <div className="lg__formation__actions">
        <a className="lg__btn lg__btn--primary" href={bookingHref(item, nextSession)}>
          Réserver une place
        </a>
        <a className="lg__btn" href="mailto:formations@lesgriots.com?subject=Devis%20OPCO%20%2F%20FAF">
          Étudier un financement
        </a>
        <button
          type="button"
          className="lg__btn"
          onClick={() => {
            document.title = `LA GRIOTHÈQUE — ${f.title}`;
            window.print();
          }}
        >
          ↓ Télécharger le programme
        </button>
        <a className="lg__btn lg__btn--ghost" href={backHref}>
          {backLabel}
        </a>
      </div>
    </section>
  );
}

function FormationPage({ f }) {
  return <ProgramPage item={f} kind="formation" />;
}

function WorkshopPage({ w }) {
  return <ProgramPage item={w} kind="workshop" />;
}

function FormationDetail({ id, onClose }) {
  const f = FORMATIONS.find((x) => x.id === id);
  if (!f) return null;
  return (
    <div className="lg__detail" onClick={onClose}>
      <div className="lg__detail__panel" onClick={(e) => e.stopPropagation()}>
        <button className="lg__detail__close" onClick={onClose}>[ × FERMER ]</button>
        <p className="lg__detail__kicker">{f.discipline}</p>
        <h2 className="lg__detail__title">{f.title}</h2>
        <p className="lg__detail__tagline">{f.tagline}</p>

        <div className="lg__detail__grid">
          <div>
            <h6>DURÉE</h6>
            <p>{f.duration}</p>
          </div>
          <div>
            <h6>FORMAT</h6>
            <p>{f.format}</p>
          </div>
          <div>
            <h6>TARIF</h6>
            <p>{f.price}</p>
          </div>
          <div>
            <h6>PROCHAINE SESSION</h6>
            <p>{f.next}</p>
          </div>
          <div>
            <h6>FORMATEUR</h6>
            <p>{f.trainer.name} — {f.trainer.role}</p>
          </div>
          <div>
            <h6>FINANCEMENT</h6>
            <p>{f.cpf ? "CPF" : "—"} {f.cpf && f.opco && "·"} {f.opco ? "OPCO" : ""}</p>
          </div>
        </div>

        <div className="lg__detail__obj">
          <h6>OBJECTIFS PÉDAGOGIQUES</h6>
          <ol>
            {f.objectives.map((o, i) => (
              <li key={i}>
                <span className="num">{String(i + 1).padStart(2, "0")}</span>
                <span>{o}</span>
              </li>
            ))}
          </ol>
        </div>

        {f.chapters && f.chapters.length > 0 && (
          <div className="lg__detail__obj">
            <h6>CHAPITRES</h6>
            <ol>
              {f.chapters.map((c, i) => (
                <li key={i}>
                  <span className="num">{String(i + 1).padStart(2, "0")}</span>
                  <span>{c}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="lg__detail__actions">
          <a className="lg__btn lg__btn--primary" href="mailto:formations@lesgriots.com?subject=Inscription%20%E2%80%94%20{title}">
            DEMANDER UNE INSCRIPTION
          </a>
          <a className="lg__btn" href="mailto:formations@lesgriots.com?subject=Devis%20CPF%2FOPCO">
            ÉTUDIER UN FINANCEMENT
          </a>
        </div>
      </div>
    </div>
  );
}

function HoverBg({ src }) {
  if (!src) return null;
  return (
    <div className="lg__page-bg" aria-hidden="true">
      <video src={src} autoPlay loop muted playsInline key={src} />
    </div>
  );
}

function PageIntro({ text, sub }) {
  return (
    <div className="lg__intro">
      <p className="lg__intro__text">{text}</p>
      {sub && <p className="lg__intro__sub">{sub}</p>}
    </div>
  );
}

function Catalogue() {
  const [bg, setBg] = useState(null);
  const [category, setCategory] = useState("all");

  // Catégories uniques extraites de la première partie du champ discipline
  const categories = React.useMemo(() => {
    const set = new Set();
    FORMATIONS.forEach((f) => {
      const cat = (f.discipline || "").split(" · ")[0].trim();
      if (cat) set.add(cat);
    });
    return Array.from(set);
  }, []);

  const archivedCount = FORMATIONS.filter((f) => f.available === false).length;
  const visible =
    category === "archives"
      ? FORMATIONS.filter((f) => f.available === false)
      : category === "all"
        ? FORMATIONS.filter((f) => f.available !== false)
        : FORMATIONS.filter(
            (f) =>
              f.available !== false &&
              (f.discipline || "").split(" · ")[0].trim() === category
          );

  return (
    <section className="lg__catalogue" id="catalogue">
      <HoverBg src={bg} />
      <PageIntro
        text={
          <>
            Des formations courtes et intensives pour les créatifs,
            entrepreneurs et institutions — pensées comme des fondations
            applicables immédiatement. Trois disciplines, trois journées&nbsp;:
            la marque, le contenu, l'image.
          </>
        }
        sub="Sessions 2026 · Paris & en ligne"
      />

      {/* Filtres par catégorie — petits tabs au-dessus de la liste */}
      <nav className="lg__cat-filters" aria-label="Filtrer par catégorie">
        <button
          type="button"
          className={"lg__cat-filters__btn" + (category === "all" ? " is-active" : "")}
          onClick={() => setCategory("all")}
        >
          Tous <span className="lg__cat-filters__count">({FORMATIONS.filter((f) => f.available !== false).length})</span>
        </button>
        {categories.map((cat) => {
          const count = FORMATIONS.filter(
            (f) => f.available !== false && (f.discipline || "").split(" · ")[0].trim() === cat
          ).length;
          return (
            <button
              key={cat}
              type="button"
              className={"lg__cat-filters__btn" + (category === cat ? " is-active" : "")}
              onClick={() => setCategory(cat)}
            >
              {cat.toLowerCase()} <span className="lg__cat-filters__count">({count})</span>
            </button>
          );
        })}
        <button
          type="button"
          className={"lg__cat-filters__btn lg__cat-filters__btn--archives" + (category === "archives" ? " is-active" : "")}
          onClick={() => setCategory("archives")}
        >
          archives <span className="lg__cat-filters__count">({archivedCount})</span>
        </button>
      </nav>

      <div className="lg__rows">
        {visible.map((f) => (
          <FormationRow key={f.id} f={f} onHover={setBg} />
        ))}
        {visible.length === 0 && (
          <p className="lg__cat-empty">Aucune formation dans cette catégorie pour le moment.</p>
        )}
      </div>
    </section>
  );
}

// WORKSHOPS, FORMATIONS, SESSIONS, TRAINERS, RESOURCES viennent de data.jsx
// (généré par le backoffice). Ne PAS redéclarer ici — ça shadowait le global
// et le matching workshop_id → workshop échouait silencieusement.

function WorkshopRow({ w, onHover }) {
  const titleRef = useMarqueeOverflow([w.title]);
  const handleEnter = onHover ? () => onHover(w.video || "img/hero.mp4") : undefined;
  const handleLeave = onHover ? () => onHover(null) : undefined;
  return (
    <a
      className={"lg__row" + (w.available ? "" : " is-soon")}
      href={"#/workshops/" + w.id}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <p className="lg__row__label">
        WORKSHOP · 2026
        {!w.available && <span className="lg__row__soon"> · PROCHAINEMENT</span>}
      </p>
      <h3 className="lg__row__title" ref={titleRef}>
        <span className="lg__marquee__inner">{w.title}</span>
      </h3>
    </a>
  );
}

function Workshops() {
  const [bg, setBg] = useState(null);
  return (
    <section className="lg__catalogue" id="workshops">
      <HoverBg src={bg} />
      <PageIntro
        text={
          <>
            Workshops résidentiels et intensifs courts pour les indépendants
            déjà en activité — format immersif, groupes restreints,
            accompagnement individuel sur projet réel.
          </>
        }
        sub="2026. Paris & en résidence. Sur sélection de dossier."
      />
      <div className="lg__rows">
        {WORKSHOPS.map((w) => (
          <WorkshopRow key={w.id} w={w} onHover={setBg} />
        ))}
      </div>
    </section>
  );
}

// ===== Agenda helpers — gère les deux formats de date possibles ============
// 1. ISO "2026-09-24" (depuis backoffice idéalement)
// 2. Texte "MARS 2026" (legacy)
const MONTHS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];
const MONTHS_FR_LOWER = MONTHS_FR.map((m) => m.toLowerCase());
const MONTHS_ABBR = MONTHS_FR_LOWER.map((m) => m.slice(0, 4));

// Renvoie { year, monthIdx, day?, sortKey, monthLabel }
function parseSessionDate(input) {
  if (!input) return { year: 9999, monthIdx: 0, day: null, sortKey: "9999-00-00", monthLabel: "Date à confirmer" };
  const s = String(input).trim();

  // ISO YYYY-MM-DD ou YYYY-MM
  const iso = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (iso) {
    const year = +iso[1];
    const monthIdx = +iso[2] - 1;
    const day = iso[3] ? +iso[3] : null;
    return {
      year, monthIdx, day,
      sortKey: `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day || 0).padStart(2, "0")}`,
      monthLabel: `${MONTHS_FR[monthIdx] || ""} ${year}`.trim(),
    };
  }

  // Texte fr "MARS 2026" / "Mars 2026" / "Mars" / "12 mars 2026"
  const lower = s.toLowerCase();
  let monthIdx = MONTHS_FR_LOWER.findIndex((m) => lower.includes(m));
  if (monthIdx < 0) monthIdx = MONTHS_ABBR.findIndex((m) => lower.includes(m));
  const yearMatch = s.match(/\b(20\d{2})\b/);
  const year = yearMatch ? +yearMatch[1] : new Date().getFullYear();
  const dayMatch = s.match(/\b(\d{1,2})\b(?!\d)/);
  const day = dayMatch && +dayMatch[1] <= 31 ? +dayMatch[1] : null;

  if (monthIdx < 0) {
    return { year: 9999, monthIdx: 0, day: null, sortKey: `9999-${s}`, monthLabel: s };
  }
  return {
    year, monthIdx, day,
    sortKey: `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day || 0).padStart(2, "0")}`,
    monthLabel: `${MONTHS_FR[monthIdx]} ${year}`,
  };
}

// Normalise un statut en { class, label }
function normalizeStatus(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (s === "open" || s.startsWith("ouverte") || s.startsWith("ouvert")) return { class: "open", label: "ouverte" };
  if (s === "full" || s.startsWith("complet")) return { class: "full", label: "complet" };
  if (s.startsWith("annul")) return { class: "cancel", label: "annulée" };
  return { class: "soon", label: "à venir" };
}

// AgendaRow refondue façon agenda éditorial :
// - Date prominente à gauche (jour très gros + mois/année dessous)
// - Type + statut en haut à droite (pill)
// - Titre Geist sans medium au centre
// - Click → accordion qui se déroule juste en dessous (pas de modal)
// - Identique PC + mobile (le grid s'empile en mobile)
function AgendaRow({ s, item, isOpen, onToggle }) {
  const dateInfo = parseSessionDate(s.date);
  const status = normalizeStatus(s.status);
  const isWorkshop = !!s.workshop_id || s.kind === "workshop";
  const targetId = s.formation_id || s.workshop_id || s.targetId || "";
  const title = item?.title || s.title || targetId || "—";
  const dayBig = dateInfo.day ? String(dateInfo.day).padStart(2, "0") : "—";
  const monthLong = (MONTHS_FR[dateInfo.monthIdx] || "").toLowerCase();
  const dateLong = dateInfo.day
    ? `${dateInfo.day} ${monthLong} ${dateInfo.year}`
    : `${monthLong} ${dateInfo.year}`;
  const subject = encodeURIComponent(`Inscription — ${title} (${dateLong})`);
  const mailto = `mailto:formations@lesgriots.com?subject=${subject}`;
  const detailHref = isWorkshop
    ? (targetId ? `#/workshops/${targetId}` : "#/workshops")
    : (targetId ? `#/formations/${targetId}` : "#/catalogue");

  return (
    <div className={"lg__ag" + (isOpen ? " is-open" : "") + " is-" + status.class}>
      {/* Row cliquable : date + titre + statut */}
      <button
        type="button"
        className="lg__ag__head"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <div className="lg__ag__date">
          <div className="lg__ag__day">{dayBig}</div>
          <div className="lg__ag__month">{monthLong} {dateInfo.year}</div>
        </div>
        <div className="lg__ag__main">
          <div className="lg__ag__kind">{isWorkshop ? "workshop" : "formation"}</div>
          <h3 className="lg__ag__title">{title}</h3>
        </div>
        <div className="lg__ag__side">
          <span className={"lg__ag__pill is-" + status.class}>{status.label}</span>
          {s.places && status.class === "open" && (
            <span className="lg__ag__places">{s.places} place{Number(s.places) > 1 ? "s" : ""}</span>
          )}
          <span className="lg__ag__caret">{isOpen ? "−" : "+"}</span>
        </div>
      </button>

      {/* Panneau qui se déroule sous la row (accordion). Pas de modal. */}
      {isOpen && (
        <div className="lg__ag__panel">
          {item?.tagline && (
            <p className="lg__ag__tagline">{item.tagline}</p>
          )}
          <div className="lg__ag__grid">
            {item?.duration && <Pair label="Durée" value={item.duration} />}
            {item?.format && <Pair label="Format" value={item.format} />}
            {item?.price && <Pair label="Tarif" value={item.price} />}
            {item?.trainer?.name && <Pair label="Intervenant" value={item.trainer.name} />}
          </div>
          {item?.description && (
            <p className="lg__ag__desc">{item.description}</p>
          )}
          <div className="lg__ag__actions">
            {status.class === "open" && (
              <a href={mailto} className="lg__ag__btn lg__ag__btn--primary">
                ↓ Réserver
              </a>
            )}
            <a href={detailHref} className="lg__ag__btn">
              → Voir la page complète
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// Petit composant pour les paires label/valeur du panel
function Pair({ label, value }) {
  return (
    <div className="lg__ag__pair">
      <div className="lg__ag__pair__label">{label}</div>
      <div className="lg__ag__pair__value">{value}</div>
    </div>
  );
}

// Modal d'origine retirée — remplacée par l'accordion inline dans AgendaRow.
// Kept commented for reference if we ever want to bring it back.
function _UnusedSessionDetailModal({ session, item, isWorkshop, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const dateInfo = parseSessionDate(session.date);
  const status = normalizeStatus(session.status);
  const dateLong = dateInfo.day
    ? `${dateInfo.day} ${(MONTHS_FR[dateInfo.monthIdx] || "").toLowerCase()} ${dateInfo.year}`
    : `${(MONTHS_FR[dateInfo.monthIdx] || "").toLowerCase()} ${dateInfo.year}`;
  const title = item?.title || session.title || "—";
  const subject = encodeURIComponent(`Inscription — ${title} (${dateLong})`);
  const mailto = `mailto:formations@lesgriots.com?subject=${subject}`;
  const targetId = session.formation_id || session.workshop_id || session.targetId || "";
  const detailHref = isWorkshop
    ? (targetId ? `#/workshops/${targetId}` : "#/workshops")
    : (targetId ? `#/formations/${targetId}` : "#/catalogue");

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{
        background: "var(--paper)", color: "var(--ink)",
        maxWidth: 720, width: "100%",
        maxHeight: "85vh", overflowY: "auto",
        padding: "36px 32px",
        border: "1px solid var(--ink)",
        fontFamily: "var(--font-mono)",
        position: "relative",
      }}>
        <button
          onClick={onClose}
          aria-label="Fermer"
          style={{
            position: "absolute", top: 10, right: 14,
            background: "none", border: 0,
            font: "inherit", color: "var(--ink)",
            fontSize: 22, cursor: "pointer", padding: 6,
          }}
        >×</button>

        <p style={{
          fontSize: 11, letterSpacing: "0.14em",
          textTransform: "uppercase", opacity: 0.6, marginBottom: 12,
        }}>
          {dateLong} · {isWorkshop ? "workshop" : "formation"} ·{" "}
          <span style={{
            color: status.class === "open" ? "#1a7a3a"
              : status.class === "full" ? "#b03030"
              : "inherit",
          }}>{status.label}</span>
        </p>

        <h2 style={{
          fontFamily: "var(--font-sans)",
          fontWeight: 500,
          fontSize: "clamp(28px, 4vw, 44px)",
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          marginBottom: 18,
        }}>{title}</h2>

        {item?.tagline && (
          <p style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 22, opacity: 0.85 }}>
            {item.tagline}
          </p>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14, padding: "18px 0",
          borderTop: "1px solid rgba(0,0,0,0.15)",
          borderBottom: "1px solid rgba(0,0,0,0.15)",
          marginBottom: 22,
        }}>
          {item?.duration && (
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.16em", opacity: 0.5, marginBottom: 3 }}>DURÉE</div>
              <div style={{ fontSize: 13 }}>{item.duration}</div>
            </div>
          )}
          {item?.format && (
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.16em", opacity: 0.5, marginBottom: 3 }}>FORMAT</div>
              <div style={{ fontSize: 13 }}>{item.format}</div>
            </div>
          )}
          {item?.price && (
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.16em", opacity: 0.5, marginBottom: 3 }}>TARIF</div>
              <div style={{ fontSize: 13 }}>{item.price}</div>
            </div>
          )}
          {session.places && status.class === "open" && (
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.16em", opacity: 0.5, marginBottom: 3 }}>PLACES</div>
              <div style={{ fontSize: 13 }}>{session.places}</div>
            </div>
          )}
          {item?.trainer?.name && (
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.16em", opacity: 0.5, marginBottom: 3 }}>INTERVENANT</div>
              <div style={{ fontSize: 13 }}>{item.trainer.name}</div>
            </div>
          )}
        </div>

        {item?.description && (
          <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 24, opacity: 0.85 }}>
            {item.description}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {status.class === "open" && (
            <a href={mailto} style={{
              display: "inline-block",
              padding: "12px 22px",
              background: "var(--accent, #ffca00)",
              color: "var(--ink)",
              border: "1px solid var(--ink)",
              fontFamily: "var(--font-mono)",
              fontSize: 12, fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.08em",
              textDecoration: "none",
            }}>
              ↓ Réserver cette session
            </a>
          )}
          <a href={detailHref} onClick={onClose} style={{
            display: "inline-block",
            padding: "12px 22px",
            background: "transparent",
            color: "var(--ink)",
            border: "1px solid var(--ink)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            textTransform: "uppercase", letterSpacing: "0.08em",
            textDecoration: "none",
          }}>
            → Page détaillée
          </a>
        </div>
      </div>
    </div>
  );
}

function Agenda() {
  // Filtre actif : "all" | "formation" | "workshop"
  const [filter, setFilter] = useState("all");
  // Id de la session actuellement dépliée (null = aucune). Une seule à la fois.
  const [openId, setOpenId] = useState(null);

  // Helper pour déterminer le type d'une session
  const sessionKind = (s) =>
    !!s.workshop_id || s.kind === "workshop" ? "workshop" : "formation";

  // Respect des pages désactivées : si une page (formations ou workshops) est
  // désactivée dans le back-office, on n'expose pas ses sessions dans l'agenda
  // — sinon le visiteur cliquerait sur "page complète" et tomberait sur une
  // route morte. La règle : si la page n'est pas dans la nav, les events liés
  // disparaissent aussi.
  const cfgActivePages = (typeof window !== "undefined" && window.SITE_CONFIG && window.SITE_CONFIG.activePages) || {};
  const formationsOn = cfgActivePages.formations !== false;
  const workshopsOn = cfgActivePages.workshops !== false;

  // Tri par date croissante puis filtre par pages actives
  const sorted = [...SESSIONS]
    .filter((s) => {
      const k = sessionKind(s);
      if (k === "workshop") return workshopsOn;
      return formationsOn;
    })
    .sort((a, b) => {
      const da = parseSessionDate(a.date).sortKey;
      const db = parseSessionDate(b.date).sortKey;
      return da.localeCompare(db);
    });
  const visible = filter === "all"
    ? sorted
    : sorted.filter((s) => sessionKind(s) === filter);

  // Compteurs pour les tabs (sur la base déjà filtrée par activePages)
  const counts = {
    all: sorted.length,
    formation: sorted.filter((s) => sessionKind(s) === "formation").length,
    workshop: sorted.filter((s) => sessionKind(s) === "workshop").length,
  };

  // Si le filtre actif pointe vers un type masqué (ex: workshops désactivés
  // mais filter === "workshop"), on rebascule sur "all" pour éviter une liste
  // vide trompeuse.
  if (filter === "workshop" && !workshopsOn) setFilter("all");
  if (filter === "formation" && !formationsOn) setFilter("all");

  // Même structure exacte que Catalogue : section + intro + filtres + rows
  return (
    <section className="lg__catalogue" id="agenda">
      <PageIntro
        text={<>Les dates des prochains événements — formations, workshops et sessions à venir.</>}
        sub="Présentiel à Paris · en ligne · en résidence. Groupes restreints."
      />

      {/* Filtres tous/formations/workshops — même style que les catégories du Catalogue */}
      <nav className="lg__cat-filters" aria-label="Filtrer par type">
        <button
          type="button"
          className={"lg__cat-filters__btn" + (filter === "all" ? " is-active" : "")}
          onClick={() => setFilter("all")}
        >
          tous <span className="lg__cat-filters__count">({counts.all})</span>
        </button>
        {formationsOn && (
          <button
            type="button"
            className={"lg__cat-filters__btn" + (filter === "formation" ? " is-active" : "")}
            onClick={() => setFilter("formation")}
          >
            formations <span className="lg__cat-filters__count">({counts.formation})</span>
          </button>
        )}
        {workshopsOn && (
          <button
            type="button"
            className={"lg__cat-filters__btn" + (filter === "workshop" ? " is-active" : "")}
            onClick={() => setFilter("workshop")}
          >
            workshops <span className="lg__cat-filters__count">({counts.workshop})</span>
          </button>
        )}
      </nav>

      <div className="lg__ag__list">
        {visible.map((s) => {
          const isWorkshop = sessionKind(s) === "workshop";
          const targetId = s.formation_id || s.workshop_id || s.targetId || "";
          const pool = isWorkshop ? WORKSHOPS : FORMATIONS;
          const item = pool.find((x) => x.id === targetId);
          return (
            <AgendaRow
              key={s.id}
              s={s}
              item={item}
              isOpen={openId === s.id}
              onToggle={() => setOpenId(openId === s.id ? null : s.id)}
            />
          );
        })}
        {visible.length === 0 && (
          <p className="lg__cat-empty">
            Aucune session {filter !== "all" ? `de type ${filter}` : ""} pour l'instant.
          </p>
        )}
      </div>
    </section>
  );
}

function ResourceRow({ r, onRequest }) {
  const titleRef = useMarqueeOverflow([r.title]);
  const typeLabel = {
    template: "TEMPLATE",
    guide: "GUIDE",
    article: "ARTICLE",
    video: "VIDÉO",
  }[r.type] || "RESSOURCE";

  // Sur clic : ouvre la modal lead-gate au lieu de naviguer directement.
  // Si pas dispo : ne fait rien (le visiteur voit le label "BIENTÔT").
  function handleClick(e) {
    e.preventDefault();
    if (!r.available) return;
    onRequest(r);
  }

  return (
    <a
      className={"lg__row" + (r.available ? "" : " is-soon")}
      href={r.available ? r.href : "#/ressources"}
      onClick={handleClick}
    >
      <p className="lg__row__label">
        {typeLabel} · {r.format}
        {!r.available && <span className="lg__row__soon"> · BIENTÔT</span>}
      </p>
      <h3 className="lg__row__title" ref={titleRef}>
        <span className="lg__marquee__inner">{r.title}</span>
      </h3>
    </a>
  );
}

// Modal lead-gate : capture email + nom + RGPD avant de donner la ressource.
// POST vers le endpoint configuré dans data.jsx (window.SITE_CONFIG.leadsEndpoint).
// Si la soumission réussit, ouvre la ressource dans un nouvel onglet.
// Si elle échoue (backoffice éteint, réseau down), on log mais on laisse quand
// même télécharger pour pas frustrer l'utilisateur — l'email sera juste perdu.
function ResourceModal({ resource, onClose }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  // Esc ferme la modal
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr("Email invalide");
      return;
    }
    if (!consent) {
      setErr("Tu dois accepter pour télécharger.");
      return;
    }
    setSubmitting(true);
    setErr("");

    const endpoint = (window.SITE_CONFIG && window.SITE_CONFIG.leadsEndpoint)
      || "http://localhost:3031/api/leads";

    try {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          resource_id: resource.id,
          consent,
        }),
      });
    } catch (e) {
      // Si le backoffice est éteint, on laisse quand même télécharger.
      // Le lead sera perdu mais on n'embête pas l'utilisateur.
      console.warn("Lead capture failed:", e);
    }

    setSubmitting(false);

    // Déclenche le téléchargement et ferme la modal.
    if (resource.href && resource.href !== "#") {
      window.open(resource.href, "_blank", "noopener");
    } else {
      alert("Le fichier n'est pas encore disponible. Tu seras prévenu(e) par email.");
    }
    onClose();
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.6)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "var(--paper)",
          color: "var(--ink)",
          maxWidth: 480,
          width: "100%",
          padding: "32px 28px",
          border: "1px solid var(--ink)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          style={{
            position: "absolute",
            top: 0, right: 0,
            background: "none",
            border: 0,
            font: "inherit",
            color: "var(--paper)",
            padding: "10px 16px",
            cursor: "pointer",
            fontSize: 18,
          }}
        >×</button>

        <p style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink)", opacity: 0.6, marginBottom: 10 }}>
          {resource.format}
        </p>
        <h3 style={{ fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: 24, lineHeight: 1.15, marginBottom: 18, letterSpacing: "-0.01em" }}>
          {resource.title}
        </h3>
        <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 24, opacity: 0.75 }}>
          Laisse-nous ton email et la ressource s'ouvre dans un nouvel onglet.
          On t'enverra aussi de temps en temps nos prochaines ressources.
        </p>

        <form onSubmit={submit}>
          <label style={{ display: "block", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6, opacity: 0.6 }}>
            Prénom (optionnel)
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px", marginBottom: 14,
              border: "1px solid var(--ink)", background: "transparent",
              fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--ink)",
            }}
          />

          <label style={{ display: "block", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6, opacity: 0.6 }}>
            Email *
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ton@email.com"
            style={{
              width: "100%", padding: "10px 12px", marginBottom: 18,
              border: "1px solid var(--ink)", background: "transparent",
              fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--ink)",
            }}
          />

          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, lineHeight: 1.5, cursor: "pointer", marginBottom: 22 }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>
              J'accepte de recevoir occasionnellement des emails de LA GRIOTHÈQUE
              (nouvelles ressources, sessions de formation). Désinscription en
              1 clic dans chaque email.
            </span>
          </label>

          {err && (
            <p style={{ color: "#d72d2d", fontSize: 12, marginBottom: 14 }}>✗ {err}</p>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "12px 18px", border: "1px solid var(--ink)",
                background: "transparent", color: "var(--ink)",
                fontFamily: "var(--font-mono)", fontSize: 12,
                textTransform: "uppercase", letterSpacing: "0.08em",
                cursor: "pointer",
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "12px 18px", border: "1px solid var(--ink)",
                background: submitting ? "var(--ink-dim)" : "var(--accent, #ffca00)",
                color: "var(--ink)",
                fontFamily: "var(--font-mono)", fontSize: 12,
                textTransform: "uppercase", letterSpacing: "0.08em",
                fontWeight: 600,
                cursor: submitting ? "wait" : "pointer",
              }}
            >
              {submitting ? "..." : "↓ Télécharger"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Ressources() {
  // Lead-gate : la ressource demandée est stockée en state.
  // Quand non-null, la modal s'ouvre avec son contexte.
  const [requested, setRequested] = useState(null);

  return (
    <section className="lg__catalogue" id="ressources">
      <PageIntro
        text={
          <>
            Worksheets, templates et guides — des outils pratiques pour
            affûter ta méthode, structurer ton activité et renforcer ta
            marque personnelle. À télécharger et à utiliser dès aujourd'hui.
          </>
        }
        sub="Gratuit · mis à jour régulièrement"
      />
      <div className="lg__rows">
        {RESOURCES.map((r) => (
          <ResourceRow key={r.id} r={r} onRequest={setRequested} />
        ))}
      </div>
      {requested && (
        <ResourceModal
          resource={requested}
          onClose={() => setRequested(null)}
        />
      )}
    </section>
  );
}

function CGV() {
  return (
    <section className="lg__cgv" id="cgv">
      <h1 className="lg__cgv__title">Conditions générales de vente</h1>
      <p className="lg__cgv__lede">
        Applicables aux prestations de formation et d'accompagnement
        proposées par <span className="lg-brand">LA GRIOTHÈQUE</span>,
        pilier formation de la SASU LES GRIOTS. Version mise à jour le
        14 mars 2026.
      </p>

      <ol className="lg__cgv__list">
        <li>
          <h2>01 — Objet et champ d'application</h2>
          <p>
            Les présentes Conditions Générales de Vente (CGV) régissent
            les relations contractuelles entre la SASU LES GRIOTS,
            organisme de formation (ci-après « LA GRIOTHÈQUE ») et toute
            personne physique ou morale (ci-après « le Client ») souscrivant
            à une formation, un workshop ou toute autre prestation proposée
            par LA GRIOTHÈQUE. Toute commande implique l'acceptation pleine
            et entière des présentes CGV.
          </p>
        </li>

        <li>
          <h2>02 — Désignation du prestataire</h2>
          <p>
            <strong>SASU LES GRIOTS</strong> · Société par actions
            simplifiée unipersonnelle au capital social de 1 000 €.
            Siège social : Paris (QPV), France.
            SIRET : à compléter · RCS Paris : à compléter.
            <strong> TVA non applicable, art. 293 B du CGI.</strong>
            Numéro de déclaration d'activité (NDA) : en cours
            d'enregistrement auprès de la DREETS Île-de-France.
            Certifié Qualiopi au titre de la catégorie « Actions de formation ».
          </p>
        </li>

        <li>
          <h2>03 — Désignation de la prestation</h2>
          <p>
            Les caractéristiques de chaque formation (objectifs, programme,
            public concerné, prérequis, durée, modalités, tarif) sont
            décrites sur la page dédiée du site lagriotheque.com et
            reprises dans la convention de formation transmise au Client
            préalablement à toute inscription.
          </p>
        </li>

        <li>
          <h2>04 — Modalités d'inscription</h2>
          <p>
            L'inscription s'effectue par email à
            <a href="mailto:formations@lesgriots.com"> formations@lesgriots.com</a>
            ou via le formulaire en ligne. Elle devient ferme à réception
            de la convention de formation signée par le Client et du
            règlement (ou du bon de prise en charge en cas de financement
            par un tiers payeur).
          </p>
        </li>

        <li>
          <h2>05 — Tarifs et modalités de paiement</h2>
          <p>
            Les tarifs sont indiqués en euros nets. <strong>TVA non
            applicable, art. 293 B du CGI</strong> — LA GRIOTHÈQUE bénéficie
            de la franchise en base de TVA. Le paiement est dû avant le
            démarrage de la session, par virement bancaire (coordonnées
            fournies sur la facture) ou par tout autre moyen accepté.
            En cas de prise en charge par un OPCO, FAF ou autre organisme
            tiers, le Client s'engage à régler directement la part non
            couverte.
          </p>
        </li>

        <li>
          <h2>06 — Délai d'accès</h2>
          <p>
            L'inscription est possible jusqu'à 7 jours ouvrés avant le
            démarrage d'une session (sous réserve de places disponibles
            et de validation du dossier de financement). La convention
            est envoyée sous 48 heures ouvrées après confirmation de
            l'inscription.
          </p>
        </li>

        <li>
          <h2>07 — Droit de rétractation</h2>
          <p>
            Conformément aux articles L221-18 et suivants du Code de la
            consommation, le Client particulier dispose d'un délai de
            <strong> 14 jours calendaires</strong> à compter de la signature
            de la convention pour se rétracter, sans avoir à justifier
            de motifs ni à payer de pénalité. Ce droit ne s'applique pas
            aux professionnels agissant dans le cadre de leur activité.
          </p>
        </li>

        <li>
          <h2>08 — Annulation et report</h2>
          <p>
            <strong>Annulation à l'initiative du Client</strong> :
            sans frais jusqu'à 14 jours avant le démarrage de la session ;
            50 % du montant retenu entre 14 et 7 jours avant ;
            100 % retenu à moins de 7 jours.
            <strong> Annulation à l'initiative de LA GRIOTHÈQUE</strong> :
            en cas de force majeure, de nombre insuffisant de stagiaires
            ou d'indisponibilité du formateur, une nouvelle date est
            proposée ou le montant intégralement remboursé.
          </p>
        </li>

        <li>
          <h2>09 — Engagements du stagiaire</h2>
          <p>
            Le stagiaire s'engage à respecter le règlement intérieur de
            la formation (transmis en amont), à participer activement aux
            sessions et à signer les feuilles d'émargement. Toute absence
            non justifiée pourra entraîner la non-délivrance du certificat
            de réalisation.
          </p>
        </li>

        <li>
          <h2>10 — Engagements de LA GRIOTHÈQUE</h2>
          <p>
            LA GRIOTHÈQUE s'engage à assurer la prestation conformément
            au programme communiqué, à mettre à disposition les moyens
            pédagogiques nécessaires, à respecter les indicateurs Qualiopi
            applicables et à délivrer un certificat de réalisation à chaque
            stagiaire ayant suivi la formation.
          </p>
        </li>

        <li>
          <h2>11 — Propriété intellectuelle</h2>
          <p>
            L'ensemble des supports pédagogiques (documents, présentations,
            templates, vidéos) reste la propriété exclusive de
            LA GRIOTHÈQUE. Ils sont mis à disposition du stagiaire dans
            le cadre strict de sa formation et ne peuvent être reproduits
            ou diffusés sans accord écrit préalable.
          </p>
        </li>

        <li>
          <h2>12 — Confidentialité & RGPD</h2>
          <p>
            Les données personnelles collectées dans le cadre de
            l'inscription sont traitées par LA GRIOTHÈQUE en sa qualité
            de responsable de traitement, à des fins de gestion des
            formations et conformément au RGPD. Le Client dispose d'un
            droit d'accès, de rectification, de suppression et de
            portabilité de ses données, exerçable par mail à
            <a href="mailto:formations@lesgriots.com"> formations@lesgriots.com</a>.
          </p>
        </li>

        <li>
          <h2>13 — Force majeure, litiges et droit applicable</h2>
          <p>
            LA GRIOTHÈQUE ne pourra être tenue responsable d'un manquement
            résultant d'un cas de force majeure. Les présentes CGV sont
            soumises au droit français. À défaut de résolution amiable,
            tout litige sera porté devant le tribunal compétent de Paris.
          </p>
        </li>
      </ol>

      <p className="lg__cgv__footer">
        Pour toute question relative aux présentes CGV, contacter
        LA GRIOTHÈQUE à
        <a href="mailto:formations@lesgriots.com"> formations@lesgriots.com</a>.
      </p>
    </section>
  );
}

function Approche() {
  return (
    <section className="lg__approche" id="approche">
      <h1 className="lg__approche__title">Notre approche</h1>
      <p className="lg__approche__lede">
        Trois points qui définissent l'ADN de <span className="lg-brand">LA GRIOTHÈQUE</span> —
        ce qui nous rend différents d'un centre de formation comme les autres.
      </p>

      <div className="lg__approche__feature">
        <p className="lg__approche__feature__h">Des intervenants en activité</p>
        <p className="lg__approche__feature__p">
          Tous nos formateurs exercent activement la pratique qu'ils
          enseignent. Pas des théoriciens qui paraphrasent — des
          praticiens qui transmettent leur méthode après l'avoir éprouvée
          sur le terrain pour <strong>Rilès, Vacra, Médine, Oumar, FILA,
          CCN Le Havre, Eesah Yasuke</strong>. Tu apprends une discipline
          en train d'être pratiquée, pas une discipline figée dans un manuel.
        </p>
      </div>

      <ApprocheAccordion />

      <Partners />
    </section>
  );
}

// Accordion 3 points — exactement comme les sections des pages formation.
// Click sur le titre = ouvre/ferme le bloc. Fermé = ligne tight ; ouvert = gros titre + body.
function ApprocheAccordion() {
  const [open, setOpen] = useState(null);
  const points = [
    {
      id: "storytelling",
      title: "Le storytelling au centre",
      intro: <>Le <strong>récit comme boussole</strong>. Stratégie, direction artistique, structure — tout en découle. Avant les outils, avant les formats, avant les plateformes, il y a l'histoire que tu portes et la façon dont les autres se la racontent.</>,
    },
    {
      id: "professionnels",
      title: "Par des professionnels en activité",
      intro: <>Universal, Sony, Accor Arena, Zéniths. Tes formateurs <strong>livrent maintenant — pas en 2015</strong>. La méthode arrive du terrain et y retourne. Pas de théorie hors-sol : ce qu'on enseigne, on le pratique encore.</>,
    },
    {
      id: "pratiques",
      title: "Formations pratiques",
      intro: <><strong>Pédagogie par le faire</strong> — tes propres récits comme matière. Tu repars avec un livrable concret, pas un certificat. Plateforme de marque, plan éditorial, vidéo finie, calendrier — utilisable dès le lundi matin.</>,
    },
  ];
  return (
    <div className="lg__approche__accordion">
      {points.map((p, i) => (
        <SectionRow
          key={p.id}
          id={"approche-" + p.id}
          title={p.title}
          index={i + 1}
          open={open === p.id}
          onToggle={() => setOpen((cur) => (cur === p.id ? null : p.id))}
        >
          <p className="lg__formation__prose">{p.intro}</p>
          <p className="lg__formation__prose lg__approche__lorem">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
            do eiusmod tempor incididunt ut labore et dolore magna aliqua.
            Ut enim ad minim veniam, quis nostrud exercitation ullamco
            laboris nisi ut aliquip ex ea commodo consequat. Duis aute
            irure dolor in reprehenderit in voluptate velit esse cillum
            dolore eu fugiat nulla pariatur.
          </p>
        </SectionRow>
      ))}
    </div>
  );
}

function TrainerRow({ t }) {
  const nameRef = useMarqueeOverflow([t.name]);
  return (
    <li className="lg__trainer">
      <p className="lg__trainer__label">FORMATEUR · 2026</p>
      <h3 className="lg__trainer__name" ref={nameRef}>
        <span className="lg__marquee__inner">{t.name}</span>
      </h3>
    </li>
  );
}

function Trainers() {
  return (
    <section className="lg__trainers" id="intervenants">
      <header className="lg__trainers__head">
        <p className="lg__trainers__kicker">INTERVENANTS · 2026 SNEAK PREVIEW</p>
        <p className="lg__trainers__intro">
          Tous nos formateurs exercent activement leur pratique. Pas de théorie
          hors-sol — vous apprenez avec des fondateurs, dirigeants, créatifs en poste.
        </p>
      </header>
      <ol className="lg__trainers__list">
        {TRAINERS.map((t) => (
          <TrainerRow key={t.id} t={t} />
        ))}
      </ol>
    </section>
  );
}

function Financement() {
  return (
    <section className="lg__financement" id="financement">
      <h2 className="lg__financement__title">
        Comment s'inscrire et quel financement&nbsp;?
      </h2>
      <div className="lg__financement__cols">
        <div className="lg__financement__col">
          <p>
            Pour toute question et inscription, écris-nous par mail&nbsp;:
          </p>
          <p>
            <a className="lg__financement__email" href="mailto:formations@lesgriots.com">
              formations@lesgriots.com
            </a>
          </p>
          <p>
            Nous répondons systématiquement sous deux jours ouvrés.
          </p>
          <p>
            Que tu sois inscrit·e à la MDA / Agessa, auto-entrepreneur·euse,
            entreprise individuelle ou dirigeant·e non salarié·e de SASU/EURL,
            tu cotises déjà pour ta formation professionnelle continue et tu
            disposes de possibilités de financement.
          </p>
        </div>
        <div className="lg__financement__col">
          <p>
            Nous t'accompagnons et simplifions tes démarches administratives
            auprès des organismes de référence — OPCO (salariés), FAF /
            FIF-PL / AGEFICE / AFDAS (indépendants selon ton statut).
            EDOF en cours, CPF à venir.
          </p>
          <p>
            <span className="lg-brand">LA GRIOTHÈQUE</span> est le pilier
            formation de la SASU LES GRIOTS, certifié Qualiopi (Actions de
            formation), Lauréat French Tech, et déclaré sous le numéro NDA
            (en cours d'enregistrement) auprès de la DREETS Île-de-France.
          </p>
          <p>
            Pour toute question d'accessibilité ou d'adaptation, merci de
            nous contacter par mail en amont de l'inscription.
          </p>
        </div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section className="lg__contact" id="contact">
      <div className="lg__contact__info">
        <p><span className="lg-brand">LA GRIOTHÈQUE</span></p>
        <p>Organisme de formation</p>
        <p>de la SASU LES GRIOTS</p>
        <p>Certifié Qualiopi</p>
        <p>&nbsp;</p>
        <p>Paris, France</p>
        <p>Implanté en QPV</p>
        <p>&nbsp;</p>
        <p><a href="mailto:formations@lesgriots.com">formations@lesgriots.com</a></p>
        <p>&nbsp;</p>
        <p><a href="https://instagram.com/lagriotheque" target="_blank" rel="noopener">instagram</a></p>
        <p><a href="https://linkedin.com" target="_blank" rel="noopener">linkedin</a></p>
        <p><a href="https://lesgriotsxstudio.com" target="_blank" rel="noopener">lesgriotsxstudio.com</a></p>
      </div>
      <div className="lg__contact__griot" aria-hidden="true">
        <GriotRing />
      </div>
      <Partners />
    </section>
  );
}

function parseRoute() {
  const h = window.location.hash || "";
  if (h.startsWith("#/")) return h.slice(2);
  return "";
}

// Sticker LES GRIOTS — accent jaune brand visible sur toutes les pages
// (réutilise l'asset du site studio). Cliquable vers la page Approche.
// Sticker jaune rond avec "LA GRIOTHÈQUE" répété en cercle sur le pourtour.
// Style "patch" graphique, rotation lente continue.
function PromoSticker() {
  return (
    <a
      href="#/approche"
      className="lg__yellow-sticker"
      title="La Griothèque"
      aria-label="La Griothèque — voir notre approche"
    >
      <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="200" cy="200" r="195" fill="var(--accent)" />
        <defs>
          <path
            id="lg-yellow-ring-path"
            d="M 200,200 m -158,0 a 158,158 0 1,1 316,0 a 158,158 0 1,1 -316,0"
          />
        </defs>
        <text className="lg__yellow-sticker__text">
          <textPath href="#lg-yellow-ring-path" startOffset="0%">LA GRIOTHÈQUE · </textPath>
        </text>
        <text className="lg__yellow-sticker__text">
          <textPath href="#lg-yellow-ring-path" startOffset="33.333%">LA GRIOTHÈQUE · </textPath>
        </text>
        <text className="lg__yellow-sticker__text">
          <textPath href="#lg-yellow-ring-path" startOffset="66.666%">LA GRIOTHÈQUE · </textPath>
        </text>
      </svg>
      {/* Griot ASCII matriciel au centre, en overlay sur le SVG */}
      <div className="lg__yellow-sticker__griot" aria-hidden="true">
        <MatrixGriot />
      </div>
    </a>
  );
}

// Section partenaires — logos sur la page à propos uniquement.
function Partners() {
  return (
    <section className="lg__partners" aria-label="Partenaires">
      <div className="lg__partners__tier">
        <p className="lg__partners__label">Ils nous ont fait confiance.</p>
        <div className="lg__partners__list">
          <a
            className="lg__partners__logo lg__partners__logo--img"
            href="https://mansa.fr"
            target="_blank"
            rel="noopener"
            aria-label="Mansa"
          >
            <img src="img/mansa.svg" alt="Mansa" />
          </a>
          <a
            className="lg__partners__logo lg__partners__logo--img"
            href="https://arty-farty.eu"
            target="_blank"
            rel="noopener"
            aria-label="Arty Farty"
          >
            <img src="img/artyfarty.svg" alt="Arty Farty" />
          </a>
          <a
            className="lg__partners__logo lg__partners__logo--img"
            href="https://lehavre.fr"
            target="_blank"
            rel="noopener"
            aria-label="Ville du Havre"
          >
            <img src="img/lehavre.svg" alt="Ville du Havre" />
          </a>
          <a
            className="lg__partners__logo lg__partners__logo--img"
            href="https://about.meta.com"
            target="_blank"
            rel="noopener"
            aria-label="Meta"
          >
            <img src="img/meta.svg" alt="Meta" />
          </a>
        </div>
      </div>
      <div className="lg__partners__tier">
        <p className="lg__partners__label">Certifié par</p>
        <div className="lg__partners__list">
          <a
            className="lg__partners__logo lg__partners__logo--img"
            href="https://travail-emploi.gouv.fr/qualiopi"
            target="_blank"
            rel="noopener"
            aria-label="Qualiopi — processus certifié"
          >
            <img src="img/qualiopi.png" alt="Qualiopi — processus certifié" />
          </a>
        </div>
      </div>
    </section>
  );
}

function App() {
  const [entered, setEntered] = useState(false);
  const [route, setRoute] = useState(parseRoute);
  const [open, setOpen] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Tracking du scroll pour basculer le mode "splash hero" sur la home.
  // Le menu apparaît dès que l'utilisateur commence à scroller (~30px).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Toggle classes sur <body> pour pilotage CSS du splash sur la home
  useEffect(() => {
    const isHome = route === "";
    document.body.classList.toggle("is-home", isHome);
    document.body.classList.toggle("is-scrolled", scrolled);
  }, [route, scrolled]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Pendant le splash : scroll / molette / touchmove / Enter / espace = entrée site
  useEffect(() => {
    if (entered) return;
    const enter = () => setEntered(true);
    const onKey = (e) => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        enter();
      }
    };
    window.addEventListener("wheel", enter, { passive: true, once: true });
    window.addEventListener("touchmove", enter, { passive: true, once: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", enter);
      window.removeEventListener("touchmove", enter);
      window.removeEventListener("keydown", onKey);
    };
  }, [entered]);

  if (!entered) {
    return <Splash onEnter={() => setEntered(true)} />;
  }

  // Garde des routes désactivées : si window.SITE_CONFIG.activePages.X === false,
  // on bloque l'accès à la page X. Mapping route → clé backoffice.
  const cfgActivePages = (typeof window !== "undefined" && window.SITE_CONFIG && window.SITE_CONFIG.activePages) || {};
  const ROUTE_TO_PAGE_KEY = {
    "catalogue": "formations",
    "workshops": "workshops",
    "agenda": "agenda",
    "ressources": "ressources",
    "approche": "approche",
    "contact": "contact",
    "cgv": "cgv",
    "financement": "financement",
  };
  // Pour les routes formations/[id] et workshops/[id], on remonte au parent
  const routeBase = route.startsWith("formations/") ? "catalogue"
    : route.startsWith("workshops/") ? "workshops"
    : route;
  const pageKey = ROUTE_TO_PAGE_KEY[routeBase];
  const isPageBlocked = pageKey && cfgActivePages[pageKey] === false;

  let page;
  if (isPageBlocked) {
    // Page désactivée → message explicite + lien retour. On ne redirige pas
    // pour qu'un visiteur qui colle une URL périmée comprenne ce qui se passe.
    page = (
      <section style={{ padding: "120px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: 18, marginBottom: 14, letterSpacing: 0 }}>
          Cette page n'est plus disponible.
        </h2>
        <p style={{ color: "var(--ink)", opacity: 0.6, marginBottom: 24 }}>
          Elle a été temporairement désactivée. Reviens plus tard ou explore le reste du site.
        </p>
        <a href="#/" className="lg__menu__link" style={{ fontSize: 16, textDecoration: "underline" }}>
          retour à l'accueil →
        </a>
      </section>
    );
  } else if (route.startsWith("formations/")) {
    const id = route.slice("formations/".length);
    const f = FORMATIONS.find((x) => x.id === id);
    page = f ? <FormationPage f={f} /> : <Catalogue />;
  } else if (route.startsWith("workshops/")) {
    const id = route.slice("workshops/".length);
    const w = WORKSHOPS.find((x) => x.id === id);
    page = w ? <WorkshopPage w={w} /> : <Workshops />;
  } else {
    switch (route) {
      case "catalogue":   page = <Catalogue />; break;
      case "workshops":   page = <Workshops />; break;
      case "agenda":      page = <Agenda />; break;
      case "ressources":  page = <Ressources />; break;
      case "approche":    page = <Approche />; break;
      case "contact":     page = <Contact />; break;
      case "cgv":         page = <CGV />; break;
      case "financement": page = <Financement />; break;
      default:            page = <Manifesto />;
    }
  }

  return (
    <>
      <Header route={route} />
      <div className="lg">
        <main>{page}</main>
        <footer className="lg__footer">
          <div className="lg__footer__cols">
            <div className="lg__footer__col">
              <a href="#/catalogue">formations</a>
              <a href="#/workshops">workshops</a>
              <a href="#/agenda">agenda</a>
              <a href="#/ressources">ressources</a>
              <a href="#/approche">notre approche</a>
              <a href="#/contact">contact</a>
            </div>
            <div className="lg__footer__col">
              <a href="https://lesgriotsxstudio.com" target="_blank" rel="noopener">les griots studio</a>
              <a href="https://lesgriotsxstudio.com" target="_blank" rel="noopener">plateforme éditoriale</a>
              <a href="https://lesgriotsxstudio.com" target="_blank" rel="noopener">agence créative</a>
            </div>
            <div className="lg__footer__col">
              <a href="https://instagram.com/lagriotheque" target="_blank" rel="noopener">instagram</a>
              <a href="https://linkedin.com" target="_blank" rel="noopener">linkedin</a>
              <a href="mailto:formations@lesgriots.com?subject=Newsletter">newsletter</a>
            </div>
            <div className="lg__footer__col">
              <p>SASU Les Griots — Paris, QPV</p>
              <p>Certifié Qualiopi · Lauréat French Tech</p>
              <p>NDA · en cours · DREETS Île-de-France</p>
              <a href="#/contact">mentions légales</a>
              <a href="#/cgv">conditions générales de vente</a>
              <div className="lg__qualiopi" aria-label="Certifié Qualiopi">
                <img
                  className="lg__qualiopi__logo"
                  src="img/qualiopi.png"
                  alt="Qualiopi — processus certifié"
                />
                <em className="lg__qualiopi__text">
                  La certification qualité a été délivrée au titre de la catégorie d'action&nbsp;: Actions de formation
                </em>
              </div>
            </div>
          </div>

          <div className="lg__footer__marquee" aria-hidden="true">
            <div className="lg__footer__marquee__track">
              <span>TRANSMETTRE — ET PERMETTRE À UNE NOUVELLE GÉNÉRATION DE BÂTIR SES RÉCITS ET CRÉER DES IMAGINAIRES&nbsp;·&nbsp;</span>
              <span>TRANSMETTRE — ET PERMETTRE À UNE NOUVELLE GÉNÉRATION DE BÂTIR SES RÉCITS ET CRÉER DES IMAGINAIRES&nbsp;·&nbsp;</span>
              <span>TRANSMETTRE — ET PERMETTRE À UNE NOUVELLE GÉNÉRATION DE BÂTIR SES RÉCITS ET CRÉER DES IMAGINAIRES&nbsp;·&nbsp;</span>
              <span>TRANSMETTRE — ET PERMETTRE À UNE NOUVELLE GÉNÉRATION DE BÂTIR SES RÉCITS ET CRÉER DES IMAGINAIRES&nbsp;·&nbsp;</span>
            </div>
          </div>
        </footer>
      </div>
      {open && <FormationDetail id={open} onClose={() => setOpen(null)} />}
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
