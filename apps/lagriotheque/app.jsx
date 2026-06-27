/* global React, ReactDOM, FORMATIONS, WORKSHOPS, TRAINERS, SESSIONS, RESOURCES, MatrixGriot */
// LA GRIOTHÈQUE — vitrine + catalogue des formations

const { useState, useEffect, useRef, useLayoutEffect } = React;

// Helper de contenu éditorial — lit window.SITE_CONTENT généré par le BO
// (apps/backoffice-griotheque → data.jsx) avec fallback sur les textes en
// dur dans les composants. Permet d'éditer la totalité du contenu depuis le
// back office sans avoir à toucher au code.
//
//   text("home.manifesto", "Texte par défaut...")  → string
//
// Si la clé existe en BO ET est non-vide, on la prend. Sinon on retombe sur
// le fallback. Donc on peut migrer les blocs un par un sans rien casser :
// tant que le BO n'a pas la clé, l'ancien texte hardcodé continue de vivre.
function text(path, fallback = "") {
  if (typeof window === "undefined" || !window.SITE_CONTENT) return fallback;
  const parts = path.split(".");
  let v = window.SITE_CONTENT;
  for (const p of parts) {
    if (v == null || typeof v !== "object") return fallback;
    v = v[p];
  }
  if (v === undefined || v === null || v === "") return fallback;
  return v;
}

// Habille la première occurrence de "LA GRIOTHÈQUE" dans un texte avec un
// span .lg-brand (qui applique le style typographique brand : police mono,
// letter-spacing serré). Sert quand on saisit du texte brut côté BO mais
// qu'on veut conserver la mise en forme du nom de marque.
function renderManifestoBrand(str) {
  if (!str) return null;
  const idx = str.indexOf("LA GRIOTHÈQUE");
  if (idx === -1) return str;
  const before = str.slice(0, idx);
  const after = str.slice(idx + "LA GRIOTHÈQUE".length);
  return (
    <>
      {before}
      <span className="lg-brand">LA GRIOTHÈQUE</span>
      {after}
    </>
  );
}

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

  // Scramble pixel : ░ ▒ ▓ █ qui se résolvent progressivement en LOADING.
  // Le mot final est éditable depuis le BO (splash.loading_target).
  useEffect(() => {
    const target = text("splash.loading_target", "LOADING");
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
      <div className="lg__splash__cue" aria-hidden="true">{text("splash.cue", "[ ENTRER ]")}</div>
    </section>
  );
}

function Manifesto() {
  const [videoReady, setVideoReady] = useState(false);
  const [loadingText, setLoadingText] = useState("00000000");
  // Onglet actif de la section "LATEST" : formations (défaut) ou workshops.
  // Cliquer "Workshops" affiche la liste juste en dessous, sans changer de page.
  const [latestTab, setLatestTab] = useState("formations");
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
        {/* Bouton "Voir la vidéo" retiré — la vidéo joue déjà en autoplay
            loop muted sur le hero. Le code playFullVideo est conservé au
            cas où on voudrait le réactiver plus tard. */}
        {!videoReady && (
          <div className="lg__hero-yard__loading" aria-live="polite">
            {loadingText}
          </div>
        )}
        <div className="lg__hero-yard__brand" aria-hidden="true">
          <GriotRing />
        </div>
        <p className="lg__hero-yard__wordmark" aria-hidden="true">LA&nbsp;GRIOTHÈQUE</p>
        {/* Lien "Prochaines sessions" désactivé sur le hero d'arrivée —
            redondant avec la nav et l'agenda accessible depuis le menu. */}
        <div className="lg__hero-yard__tagline">
          <p>
            {text("home.hero_tagline_line1", "L'école de transmission")}<br />
            {text("home.hero_tagline_line2", "pour la nouvelle génération")}<br />
            {text("home.hero_tagline_line3", "créative.")}
          </p>
        </div>
        <div className="lg__hero-yard__scrollhint" aria-hidden="true">
          ↓ scroll
        </div>
        <PromoSticker />
      </section>

      {/* Manifeste — prose sous le hero. Le texte est éditable depuis le BO
          (section "home" → manifesto). On remplace ici le 1er "LA GRIOTHÈQUE"
          par un span .lg-brand pour conserver le style typographique
          historique, indépendamment du texte saisi en BO. */}
      <section className="lg__manifesto">
        <div className="lg__manifeste lg__manifeste--hero">
          <div className="lg__manifeste__prose">
            <p>{renderManifestoBrand(text(
              "home.manifesto",
              "LA GRIOTHÈQUE est une école dédiée à la transmission de méthodes éprouvées sur le terrain, au croisement de la direction artistique, du récit de marque et de la production. Dans un paysage culturel saturé, où trop de talents avancent sans cadre et trop de récits puissants se dissipent faute de structure, nous offrons aux artistes, aux créatifs et aux entrepreneurs de la prochaine génération les outils pour bâtir leur récit et créer de nouveaux imaginaires."
            ))}</p>
          </div>
        </div>
      </section>

      {/* LATEST — liste des formations à l'affiche, style YARD. L'onglet
          Workshops n'apparaît que s'il y a au moins un workshop dispo. */}
      <section className="lg__latest">
        <div className="lg__latest__tabs">
          <span
            className={latestTab === "formations" ? "is-active" : ""}
            role="button"
            tabIndex={0}
            style={{ cursor: "pointer", color: latestTab === "formations" ? undefined : "var(--ink-3)" }}
            onClick={() => setLatestTab("formations")}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLatestTab("formations"); } }}
          >{text("home.latest_tab_formations", "Nos formations")}</span>
          {typeof WORKSHOPS !== "undefined" && WORKSHOPS.some((w) => w.available) && (
            <span
              className={latestTab === "workshops" ? "is-active" : ""}
              role="button"
              tabIndex={0}
              style={{ cursor: "pointer", color: latestTab === "workshops" ? undefined : "var(--ink-3)" }}
              onClick={() => setLatestTab("workshops")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLatestTab("workshops"); } }}
            >{text("home.latest_tab_workshops", "Workshops")}</span>
          )}
        </div>
        <div className="lg__latest__list">
          {(latestTab === "workshops"
            ? WORKSHOPS.filter((w) => w.available)
            : FORMATIONS.filter((f) => f.available)
          ).map((item) => (
            <a
              key={item.id}
              href={(latestTab === "workshops" ? "#/workshops/" : "#/formations/") + item.id}
              className="lg__latest__row"
            >
              <span className="lg__latest__row__left">
                {item.discipline
                  ? item.discipline.split(" · ")[0].toLowerCase()
                  : (latestTab === "workshops" ? "workshop" : "formation")}
              </span>
              <h3 className="lg__latest__row__title">{item.title}</h3>
              <span className="lg__latest__row__right">
                {item.duration ? item.duration.split(" · ").pop().toLowerCase() : ""}
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

// Affichage de la durée : on retire le préfixe "XH · " ou "XH·" si présent,
// pour ne garder que la partie "X jours" / "X journée(s)".
// Choix éditorial Moos : jamais d'heures sur le site (les heures sont en
// interne pour le calcul OPCO, le visiteur lit en jours).
// Ex : "7H · 1 JOURNÉE" → "1 JOURNÉE" ; "14H · 2 JOURS" → "2 JOURS".
function formatDuration(d) {
  if (!d) return "";
  // Sépare sur " · " et garde tous les segments qui ne contiennent pas "H"
  // (heures, ex : "7H", "14h") en tant qu'unité de temps.
  const parts = String(d).split(/\s*·\s*/).map((p) => p.trim()).filter(Boolean);
  const noHours = parts.filter((p) => !/^\d+\s*h(eure)?s?$/i.test(p));
  // Si tout était des heures, on garde le brut (au moins on affiche qqch).
  return (noHours.length > 0 ? noHours : parts).join(" · ");
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

// Détecte si un workshop / une formation est gratuit. Une valeur vide, "0€",
// "0 €", "gratuit" ou "free" (insensible à la casse) compte comme gratuit.
function isFree(item) {
  if (!item || !item.price) return true;
  const p = String(item.price).trim().toLowerCase();
  if (p === "") return true;
  if (p.includes("gratuit") || p === "free" || p.includes("offert")) return true;
  if (/^0\s*€?$/.test(p)) return true;
  return false;
}

// Pour les workshops payants avec un lien de paiement Stripe (Payment Link)
// configuré dans le backoffice, on renvoie ce lien direct ; sinon on retombe
// sur le mailto de réservation classique.
function ctaHref(item, session) {
  if (!isFree(item) && item.stripePaymentLink) {
    return item.stripePaymentLink;
  }
  return bookingHref(item, session);
}
function ctaLabel(item) {
  // Libellés des CTA — éditables depuis le BO (section "cta"). Le template
  // payer_template peut contenir {price} qui est remplacé par le prix de
  // l'item courant. La flèche → est ajoutée systématiquement.
  if (isFree(item)) {
    return text("cta.demande_label", "Réserver gratuitement") + " →";
  }
  if (item.stripePaymentLink) {
    const tmpl = text("cta.payer_template", "Payer {price}");
    return tmpl.replace("{price}", item.price || "") + " →";
  }
  return text("cta.reserve_label", "Réserver une place") + " →";
}
function ctaIsExternal(item) {
  if (isFree(item) || !item.stripePaymentLink) return false;
  // Hash internes (page checkout démo) → on reste dans le même onglet
  return /^https?:\/\//i.test(item.stripePaymentLink);
}

// Bannière CTA horizontale (style SCA NABA) qui chevauche le bas de la vidéo.
// Tagline en haut, séparateur, puis colonnes : prochaines sessions / formateur
// / tarif + bouton réserver. Sur mobile, tout passe en stack vertical.
function CtaBanner({ item, nextSession, tagline, upcoming, title, kind }) {
  // Workshops : vente directe, on n'affiche pas le contexte Qualiopi (CPF /
  // OPCO / mentions fiscales formelles).
  const isQualiopi = kind !== "workshop";
  const finance = isQualiopi
    ? [item.cpf && "CPF", item.opco && "OPCO"].filter(Boolean).join(" · ")
    : "";
  // 2-3 prochaines dates max dans la colonne sessions
  const sessionDates = (upcoming || []).slice(0, 3);
  // Formateur(s) : peut être objet seul ou tableau
  const trainers = Array.isArray(item.trainer)
    ? item.trainer
    : item.trainer
      ? [item.trainer]
      : [];
  return (
    <div className="lg__cta-banner" aria-label="Informations clés et réservation">
      {title && <h2 className="lg__cta-banner__title">{title}</h2>}
      {tagline && <p className="lg__cta-banner__tagline">{tagline}</p>}
      <hr className="lg__cta-banner__rule" />
      <div className="lg__cta-banner__grid">
        <div className="lg__cta-banner__col">
          <p className="lg__cta-banner__col__k">Prochaines sessions</p>
          {sessionDates.length > 0 ? (
            sessionDates.map((s) => (
              <p key={s.id} className="lg__cta-banner__col__v">
                {sessionDateLabel(s)}
              </p>
            ))
          ) : (
            <p className="lg__cta-banner__col__v lg__cta-banner__col__v--muted">
              Dates à venir
            </p>
          )}
        </div>
        {trainers.length > 0 && (
          <div className="lg__cta-banner__col">
            <p className="lg__cta-banner__col__k">
              {trainers.length > 1 ? "Formateurs" : "Formateur"}
            </p>
            {trainers.map((t, i) => (
              <p key={t.id || t.name || i} className="lg__cta-banner__col__v">
                {t.name}
              </p>
            ))}
          </div>
        )}
        <div className="lg__cta-banner__col">
          <p className="lg__cta-banner__col__k">Tarif</p>
          <p className="lg__cta-banner__col__v">
            {item.price || "—"}
          </p>
          <p className="lg__cta-banner__col__v lg__cta-banner__col__v--small">
            {isQualiopi
              ? `Exonéré de TVA (art. 293 B CGI)${finance ? " · " + finance : ""}`
              : "TVA 20 % incluse · paiement unique"}
          </p>
        </div>
        <div className="lg__cta-banner__col lg__cta-banner__col--cta">
          <a
            className="lg__cta-banner__btn"
            href={ctaHref(item, nextSession)}
            {...(ctaIsExternal(item) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {ctaLabel(item)}
          </a>
        </div>
      </div>
    </div>
  );
}

// Modale de capture de leads pour télécharger le programme PDF. L'utilisateur
// renseigne nom + email + téléphone (optionnel). Submit → ouvre un mailto vers
// formations@lesgriots.com avec les infos préremplies (côté Moos : répondre
// avec le PDF en pièce jointe). Confirmation affichée après envoi.
function DownloadModal({ item, onClose }) {
  // URL du webhook Make.com qui orchestre : Notion (stockage lead) +
  // Gmail (envoi PDF programme) + Slack (notification Moos). Configurable via
  // window.SITE_CONFIG.leadsWebhookUrl ; fallback mailto si non défini ou
  // si la requête échoue (l'utilisateur n'est jamais bloqué).
  const WEBHOOK_URL =
    (typeof window !== "undefined" &&
      window.SITE_CONFIG &&
      window.SITE_CONFIG.leadsWebhookUrl) ||
    null;
  const [step, setStep] = useState("form"); // "form" | "sending" | "sent" | "error"
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);

  // Fermer à Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // URL du PDF programme — par défaut on cherche dans /img/programmes/{id}.pdf
  // (convention). On peut override via item.programmePdfUrl côté data.
  const programmePdfUrl =
    item.programmePdfUrl || `img/programmes/${item.id}.pdf`;

  // Déclenche le téléchargement direct du PDF côté client (pas d'envoi mail).
  const triggerPdfDownload = () => {
    try {
      const a = document.createElement("a");
      a.href = programmePdfUrl;
      a.download = `programme-${item.id}.pdf`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.warn("[pdf download] failed", e);
    }
  };

  // Fallback : ouvre un mailto si le webhook ne répond pas (réseau, blocage,
  // env non configuré). Le lead n'est pas perdu, le PDF est quand même
  // téléchargé côté client.
  const fallbackMailto = () => {
    const subject = encodeURIComponent(`Demande du programme — ${item.title}`);
    const body = encodeURIComponent(
      "Bonjour,\n\n" +
      `Je viens de télécharger le programme « ${item.title} » et je souhaite être recontacté·e pour prendre rendez-vous.\n\n` +
      "Mes coordonnées :\n" +
      `Prénom : ${firstName}\n` +
      `Nom : ${lastName}\n` +
      `Téléphone : ${phone}\n` +
      `Email : ${email}\n` +
      "\nMerci !\n"
    );
    window.location.href = `mailto:formations@lesgriots.com?subject=${subject}&body=${body}`;
  };

  const submit = async (e) => {
    e.preventDefault();
    // Payload envoyé au webhook Make. Make crée le lead dans Notion et
    // envoie un mail de remerciement + prise de RDV (Cal.com / Calendly).
    // Le PDF programme n'est PAS envoyé par mail — il est téléchargé
    // directement côté client juste après.
    const payload = {
      firstName,
      lastName,
      email,
      phone,
      formation: {
        id: item.id,
        title: item.title,
        cpf: !!item.cpf,
        rs: item.rs || null,
        price: item.price || null,
      },
      consent: true,
      source: "lagriotheque-download-modal",
      submittedAt: new Date().toISOString(),
      pageUrl: typeof window !== "undefined" ? window.location.href : null,
    };

    // 1) Déclenche le téléchargement direct du PDF (priorité user).
    triggerPdfDownload();

    // 2) Notifie le backend (Make webhook) — crée le lead + mail RDV.
    if (!WEBHOOK_URL) {
      fallbackMailto();
      setStep("sent");
      return;
    }
    setStep("sending");
    try {
      const r = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Webhook returned " + r.status);
      setStep("sent");
    } catch (err) {
      console.warn("[lead webhook] failed, falling back to mailto", err);
      fallbackMailto();
      setStep("sent");
    }
  };

  return (
    <div className="lg__modal" onClick={onClose} role="dialog" aria-modal="true">
      <div className="lg__modal__panel" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="lg__modal__close"
          onClick={onClose}
          aria-label="Fermer"
        >
          [ × Fermer ]
        </button>
        {(step === "form" || step === "sending") ? (
          <>
            <p className="lg__modal__kicker">Programme détaillé</p>
            <h2 className="lg__modal__title">{item.title}</h2>
            <p className="lg__modal__intro">
              Télécharge le programme PDF complet — contenu, objectifs,
              modalités, tarifs et démarches de financement. On te recontacte
              ensuite par email pour prendre rendez-vous.
            </p>
            <form className="lg__modal__form" onSubmit={submit}>
              <div className="lg__modal__row">
                <label className="lg__modal__field">
                  <span className="lg__modal__field__k">Prénom *</span>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    autoFocus
                  />
                </label>
                <label className="lg__modal__field">
                  <span className="lg__modal__field__k">Nom *</span>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </label>
              </div>
              <label className="lg__modal__field">
                <span className="lg__modal__field__k">Téléphone *</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </label>
              <label className="lg__modal__field">
                <span className="lg__modal__field__k">Email *</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="lg__modal__consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                />
                <span>
                  J'accepte d'être recontacté·e par LES GRIOTS au sujet de cette
                  formation. Tes données ne sont jamais partagées.
                </span>
              </label>
              <button
                type="submit"
                className="lg__modal__submit"
                disabled={step === "sending"}
              >
                {step === "sending" ? "Envoi en cours…" : "↓ Télécharger le programme"}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="lg__modal__kicker">C'est parti</p>
            <h2 className="lg__modal__title">Merci, {firstName} 👋</h2>
            <p className="lg__modal__intro">
              Le programme PDF se télécharge sur ton appareil maintenant.
              Si le téléchargement n'a pas démarré,{" "}
              <a href={programmePdfUrl} download={`programme-${item.id}.pdf`}>
                clique ici
              </a>.
            </p>
            <p className="lg__modal__intro">
              On te recontacte par email à <strong>{email}</strong> pour te
              proposer un créneau d'échange et répondre à tes questions sur la
              formation.
            </p>
            <button
              type="button"
              className="lg__modal__submit"
              onClick={onClose}
            >
              Fermer
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ProgramPage({ item, kind }) {
  const titleRef = useFitOne(160);
  const titleSentinelRef = useRef(null);
  const headerRef = useRef(null);
  const heroRef = useRef(null);
  const [showTitleInNav, setShowTitleInNav] = useState(false);
  const [pastVideo, setPastVideo] = useState(false);
  const [activeTab, setActiveTab] = useState("presentation");
  const [titleStuck, setTitleStuck] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const tabContentRef = useRef(null);

  // Au clic sur un onglet : change l'onglet actif. Pas de scroll auto — le
  // menu sticky est un sélecteur de contenu, pas une nav par ancre. Le
  // contenu de l'onglet remplace l'ancien à la même position dans la page.
  const selectTab = (tabId) => {
    setActiveTab(tabId);
  };

  // Quand on change d'onglet, on scrolle horizontalement la barre d'onglets
  // pour amener le bouton actif au centre (utile sur mobile où les onglets
  // sont en scroll horizontal).
  useEffect(() => {
    const btn = document.querySelector(".lg__tabs .lg__tabs__btn.is-active");
    if (btn && typeof btn.scrollIntoView === "function") {
      btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeTab]);

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


  // Onglets style SENZA — 10 onglets qui couvrent toute l'info nécessaire à
  // la décision d'achat. Chaque onglet rend un sous-ensemble de sections
  // empilées. Certains onglets sont masqués dynamiquement (ex : Certification
  // si la formation n'est ni CPF ni certifiante).
  // Onglets différents selon le KIND :
  // - "workshop" → vue commerciale épurée (vente pure, pas de cadre Qualiopi).
  // - "formation" → vue complète Qualiopi (présentation, certif, indicateurs,
  //   financement OPCO/CPF, accessibilité, etc.).
  const TAB_GROUPS = kind === "workshop"
    ? [
        {
          id: "presentation",
          label: "Présentation",
          sections: ["description", "public", "prerequis"],
        },
        {
          id: "programme",
          label: "Programme",
          sections: ["programme", "objectifs"],
        },
        {
          id: "sessions",
          label: "Sessions / Lieu",
          sections: ["lieu", "formateur"],
        },
        { id: "contact", label: "Contact", sections: ["contact"] },
      ]
    : [
        {
          id: "presentation",
          label: "Présentation",
          sections: ["description", "public", "prerequis"],
        },
        { id: "objectifs", label: "Objectifs", sections: ["objectifs"] },
        {
          id: "programme",
          label: "Programme",
          sections: ["programme", "duree", "moyens"],
        },
        ...((item.cpf || item.rs)
          ? [{ id: "certification", label: "Certification", sections: ["certification"] }]
          : []),
        { id: "griotheque", label: "La Griothèque", sections: ["griotheque", "indicateurs"] },
        {
          id: "financement",
          label: "Financement",
          sections: ["tarif", "delai"],
        },
        { id: "avis", label: "Avis", sections: ["avis"] },
        {
          id: "sessions",
          label: "Sessions / Lieu",
          sections: ["lieu", "formateur", "accessibilite", "evaluation"],
        },
        { id: "faq", label: "FAQ", sections: ["faq"] },
        { id: "contact", label: "Contact", sections: ["contact"] },
      ];

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

      {/* Barre d'onglets sticky — placée juste sous le titre. Sur desktop :
          tous les onglets affichés avec points • entre eux (style menu).
          Sur mobile : flèches ← → pour naviguer onglet par onglet (style SUPSI). */}
      <div className="lg__tabs" role="tablist" aria-label="Sections de la formation">
        <button
          type="button"
          className="lg__tabs__nav lg__tabs__nav--prev"
          aria-label="Onglet précédent"
          onClick={() => {
            const idx = TAB_GROUPS.findIndex((g) => g.id === activeTab);
            const prev = (idx - 1 + TAB_GROUPS.length) % TAB_GROUPS.length;
            selectTab(TAB_GROUPS[prev].id);
          }}
        >
          ←
        </button>
        <div className="lg__tabs__scroll">
          {TAB_GROUPS.map((g, i) => (
            <React.Fragment key={g.id}>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === g.id}
                aria-controls="tab-content"
                className={"lg__tabs__btn" + (activeTab === g.id ? " is-active" : "")}
                onClick={() => selectTab(g.id)}
              >
                {g.label}
              </button>
              {i < TAB_GROUPS.length - 1 && (
                <span className="lg__tabs__sep" aria-hidden="true">•</span>
              )}
            </React.Fragment>
          ))}
        </div>
        <a
          className="lg__tabs__cta"
          href={ctaHref(item, nextSession)}
          {...(ctaIsExternal(item) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {isFree(item) ? "Réserver →" : (item.stripePaymentLink ? "Payer →" : "Réserver →")}
        </a>
        <button
          type="button"
          className="lg__tabs__nav lg__tabs__nav--next"
          aria-label="Onglet suivant"
          onClick={() => {
            const idx = TAB_GROUPS.findIndex((g) => g.id === activeTab);
            const next = (idx + 1) % TAB_GROUPS.length;
            selectTab(TAB_GROUPS[next].id);
          }}
        >
          →
        </button>
      </div>

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
          {f.media.credit && (
            <p className="lg__formation__hero__credit">{f.media.credit}</p>
          )}
          <PromoSticker />
        </div>
      )}

      {/* Bannière CTA horizontale qui chevauche le bas de la vidéo. */}
      <CtaBanner
        item={item}
        title={f.title}
        nextSession={nextSession}
        tagline={f.tagline}
        upcoming={upcoming}
        kind={kind}
      />

      {/* Layout 2 colonnes style SENZA / Clearance Kit : contenu de l'onglet
          à gauche, sidebar CTA sticky à droite. Sur mobile : 1 col + sidebar
          en bas en barre fixe. */}
      <div className="lg__formation__layout">
      <div className="lg__formation__main">

      {/* Zone de contenu des onglets — affiche les sections du groupe actif,
          empilées les unes sous les autres (plus d'accordéon). Le filtrage se
          fait via TAB_GROUPS plus haut. */}
      <div className="lg__formation__sections" id="tab-content" ref={tabContentRef}>
      {(() => {
        const allSections = [
        {
          id: "description",
          title: "Description",
          body: f.description ? <p className="lg__formation__prose">{f.description}</p> : null,
        },
        {
          id: "objectifs",
          title: "Objectifs pédagogiques",
          body:
            f.objectives && f.objectives.length > 0 ? (
              <div className="lg__obj">
                {f.objectives.map((o, i) => (
                  <details key={i} className="lg__obj__item" open={i === 0}>
                    <summary className="lg__obj__head">
                      <span className="lg__obj__num">{String(i + 1).padStart(2, "0")}</span>
                      <span className="lg__obj__text">{o}</span>
                      <span className="lg__obj__chev" aria-hidden="true">+</span>
                    </summary>
                    <div className="lg__obj__body">
                      <p>
                        À l'issue de cet objectif, l'apprenant·e est capable de
                        mettre en œuvre cette compétence dans un cadre
                        professionnel concret. Les indicateurs de réussite sont
                        évalués lors des mises en situation prévues au programme.
                      </p>
                    </div>
                  </details>
                ))}
              </div>
            ) : null,
        },
        {
          id: "programme",
          title: "Programme",
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
          title: "Public",
          body: f.audience ? <p className="lg__formation__prose">{f.audience}</p> : null,
        },
        {
          id: "prerequis",
          title: "Pré-requis",
          body: f.prerequisites ? (
            <ul className="lg__formation__bullets">
              {f.prerequisites
                .split(/\.\s+/)
                .map((s) => s.trim().replace(/\.$/, ""))
                .filter((s) => s.length > 0)
                .map((s, i) => (
                  <li key={i}>{s}.</li>
                ))}
            </ul>
          ) : null,
        },
        {
          id: "duree",
          title: "Durée",
          body: (
            <p className="lg__formation__prose">
              {formatDuration(f.duration) || "—"}
              {f.format ? <> · {f.format.toLowerCase()}</> : null}
            </p>
          ),
        },
        {
          id: "lieu",
          title: "Lieu",
          body: f.location ? <p className="lg__formation__prose">{f.location}</p> : null,
        },
        {
          id: "formateur",
          title: "Formateur",
          body: f.trainer ? <TrainerCard trainer={f.trainer} /> : null,
        },
        {
          id: "moyens",
          title: "Moyens pédagogiques",
          body: f.methods ? <p className="lg__formation__prose">{f.methods}</p> : null,
        },
        {
          id: "evaluation",
          title: "Évaluation",
          body: f.evaluation ? <p className="lg__formation__prose">{f.evaluation}</p> : null,
        },
        {
          id: "indicateurs",
          title: "Indicateurs",
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
          title: "Délai d'accès",
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
          title: "Accessibilité",
          body: f.accessibility ? <p className="lg__formation__prose">{f.accessibility}</p> : null,
        },
        {
          id: "tarif",
          title: "Tarif",
          body: (
            <p className="lg__formation__prose">
              <strong>{f.price || "—"} HT</strong> — montant net à payer.
              {" "}LES GRIOTS bénéficie de la franchise en base de TVA
              (art. 293 B du CGI), aucune TVA n'est ajoutée.
              {(f.cpf || f.opco) && (
                <> Prise en charge possible {f.opco ? "OPCO" : ""}{f.cpf && f.opco ? " · " : ""}{f.cpf ? "CPF" : ""}.</>
              )}
            </p>
          ),
        },
        // ============== Nouvelles sections style SENZA ==============
        {
          id: "certification",
          title: "Certification",
          body: f.cpf ? (
            <div className="lg__formation__prose">
              <p>
                Cette formation est <strong>éligible CPF</strong>.
                {f.rs && (
                  <> Elle prépare à la certification <strong>{f.rs}</strong>
                    {f.certifier && <> délivrée par <strong>{f.certifier}</strong></>}.
                  </>
                )}
              </p>
              {f.franceCompetencesUrl && (
                <p>
                  <a href={f.franceCompetencesUrl} target="_blank" rel="noopener noreferrer">
                    Consulter la fiche France Compétences →
                  </a>
                </p>
              )}
              {f.cpfUrl && (
                <p>
                  <a href={f.cpfUrl} target="_blank" rel="noopener noreferrer">
                    S'inscrire directement via Mon Compte Formation →
                  </a>
                </p>
              )}
            </div>
          ) : (
            <p className="lg__formation__prose">
              Cette formation n'est pas certifiante. Pour nos formations éligibles
              CPF, consulte le <a href="#/catalogue">catalogue</a>.
            </p>
          ),
        },
        {
          id: "griotheque",
          title: "La Griothèque",
          body: (
            <div className="lg__formation__prose">
              <p className="lg__approche__lede">
                Trois points qui définissent l'ADN de <span className="lg-brand">LA GRIOTHÈQUE</span>
                {" "}— ce qui nous rend différents d'un centre de formation comme les autres.
              </p>
              <div className="lg__approche-mini">
                <div className="lg__approche-mini__point">
                  <h4 className="lg__approche-mini__title">Le storytelling au centre</h4>
                  <p>
                    Le <strong>récit comme boussole</strong>. Stratégie,
                    direction artistique, structure — tout en découle. Avant les
                    outils, avant les formats, avant les plateformes, il y a
                    l'histoire que tu portes et la façon dont les autres se la
                    racontent.
                  </p>
                </div>
                <div className="lg__approche-mini__point">
                  <h4 className="lg__approche-mini__title">Par des professionnels en activité</h4>
                  <p>
                    Universal, Sony, Accor Arena, Zéniths. Tes formateurs{" "}
                    <strong>livrent maintenant — pas en 2015</strong>. La
                    méthode arrive du terrain et y retourne. Pas de théorie
                    hors-sol : ce qu'on enseigne, on le pratique encore.
                  </p>
                </div>
                <div className="lg__approche-mini__point">
                  <h4 className="lg__approche-mini__title">Formations pratiques</h4>
                  <p>
                    <strong>Pédagogie par le faire</strong> — tes propres récits
                    comme matière. Tu repars avec un livrable concret, pas un
                    certificat. Plateforme de marque, plan éditorial, vidéo
                    finie, calendrier — utilisable dès le lundi matin.
                  </p>
                </div>
              </div>
              <p>
                <strong>LA GRIOTHÈQUE</strong> est le pilier formation de la
                SASU LES GRIOTS, certifié <strong>Qualiopi</strong> (Actions de
                formation), Lauréat French Tech, et déclaré sous le numéro NDA
                28760747176 auprès de la DREETS Normandie.
              </p>
            </div>
          ),
        },
        {
          id: "avis",
          title: "Avis",
          body: (
            <p className="lg__formation__prose">
              Les premiers avis seront publiés à l'issue des sessions 2025-2026.
              La Griothèque démarre sa première promotion en 2025 — les
              indicateurs de satisfaction et de recommandation seront accessibles
              ici dès le bilan de la promo.
            </p>
          ),
        },
        {
          id: "faq",
          title: "Questions fréquentes",
          body: (
            <div className="lg__formation__prose lg__faq">
              {/* FAQ générique — toutes les questions/réponses sont éditables
                  depuis le BO (section "faq"). Les réponses 1 (CPF) et 4
                  (accessibilité) ont une logique conditionnelle :
                  - CPF : on prend a_cpf_yes ou a_cpf_no selon f.cpf
                  - Handicap : on prend le texte custom de la formation si défini,
                    sinon le fallback générique du BO. */}
              <h4>{text("faq.q_cpf", "Puis-je financer cette formation via mon CPF ?")}</h4>
              <p>
                {f.cpf
                  ? text("faq.a_cpf_yes", "Oui, cette formation est éligible CPF. Tu peux t'inscrire directement depuis Mon Compte Formation.")
                  : text("faq.a_cpf_no", "Cette formation n'est pas éligible CPF, mais des prises en charge OPCO ou FAF sont possibles selon ton statut. Contacte-nous pour étudier un montage.")}
              </p>
              <h4>{text("faq.q_delais", "Quels sont les délais d'inscription ?")}</h4>
              <p>
                {text("faq.a_delais", "Réponse à toute demande sous 48h ouvrées. Inscription possible jusqu'à 14 jours avant le démarrage de la session, dans la limite des places disponibles.")}
              </p>
              <h4>{text("faq.q_apres", "Que se passe-t-il après la formation ?")}</h4>
              <p>
                {text("faq.a_apres", "Tu reçois une attestation de fin de formation. Pour les formations certifiantes, le passage de certification est intégré. Nous gardons le contact via notre newsletter et l'accès à la communauté Griothèque.")}
              </p>
              <h4>{text("faq.q_handicap", "La formation est-elle accessible aux personnes en situation de handicap ?")}</h4>
              <p>
                {f.accessibility
                  ? f.accessibility
                  : text("faq.a_handicap_fallback", "Oui. Contacte notre référent handicap pour un entretien préalable et adapter les modalités à ta situation.")}
              </p>
            </div>
          ),
        },
        {
          id: "contact",
          title: "Contact",
          body: (
            <div className="lg__formation__prose">
              <p>
                Une question sur cette formation, sur le financement, ou sur
                l'inscription ? Écris-nous.
              </p>
              <ul>
                <li>
                  <strong>Email :</strong>{" "}
                  <a href={`mailto:formations@lesgriots.com?subject=Question%20—%20${encodeURIComponent(f.title)}`}>
                    formations@lesgriots.com
                  </a>
                </li>
                <li>
                  <strong>Référent handicap :</strong>{" "}
                  <a href="mailto:formations@lesgriots.com?subject=Accessibilité">
                    formations@lesgriots.com
                  </a>
                </li>
                <li>
                  <strong>Réserver :</strong>{" "}
                  <a
                    href={ctaHref(item, nextSession)}
                    {...(ctaIsExternal(item) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    {ctaLabel(item)}
                  </a>
                </li>
              </ul>
            </div>
          ),
        },
      ];
        const activeGroup = TAB_GROUPS.find((g) => g.id === activeTab) || TAB_GROUPS[0];
        const visible = activeGroup.sections
          .map((id) => allSections.find((s) => s.id === id))
          .filter(Boolean);
        return visible.map((s, i) => {
          // Première section : titre H2 principal (toujours visible).
          if (i === 0) {
            return (
              <div className="lg__tabsec" id={s.id} key={s.id}>
                <h2 className="lg__tabsec__title">
                  <span className="lg__tabsec__label">{s.title}</span>
                </h2>
                <div className="lg__tabsec__body">{s.body}</div>
              </div>
            );
          }
          // Sections suivantes : accordéon déroulant (style objectifs).
          return (
            <details
              className="lg__tabsec lg__tabsec--sub lg__tabsec--coll"
              id={s.id}
              key={s.id}
            >
              <summary className="lg__tabsec__head">
                <span className="lg__tabsec__label">{s.title}</span>
                <span className="lg__tabsec__chev" aria-hidden="true">+</span>
              </summary>
              <div className="lg__tabsec__body">{s.body}</div>
            </details>
          );
        });
      })()}
      </div>

      </div>{/* /.lg__formation__main */}

      <aside className="lg__formation__side" aria-label="Réservation">
        <div className="lg__cta-mini">
          {/* Nom de la formation tout en haut de la carte — repère pour le
              lecteur qui scrolle dans le contenu. */}
          <p className="lg__cta-mini__title">{f.title}</p>
          <div className="lg__cta-mini__head">
            <strong className="lg__cta-mini__price">
              {f.price || "—"}
            </strong>
            <span className="lg__cta-mini__hint">
              {f.duration ? formatDuration(f.duration) : ""}
              {f.duration ? " · " : ""}
              {kind === "workshop" ? "TVA 20 % incluse" : "Exonéré de TVA"}
            </span>
          </div>
          {kind !== "workshop" && (f.cpf || f.rs) && (
            <p className="lg__cta-mini__cert">
              <span aria-hidden="true">✓</span> Formation certifiante
              {f.rs && <span className="lg__cta-mini__cert__code"> · RS {f.rs}</span>}
            </p>
          )}
          {kind !== "workshop" && (f.cpf || f.opco || f.rs) && (
            <div className="lg__cta-mini__badges">
              {f.cpf && <span>CPF</span>}
              {f.opco && <span>OPCO</span>}
              {f.rs && <span>RS {f.rs}</span>}
            </div>
          )}
          <ul className="lg__cta-mini__meta">
            {f.format && <li>{f.format}</li>}
            {nextSession && <li>{sessionDateLabel(nextSession)}</li>}
          </ul>
          <a
            className="lg__cta-mini__btn"
            href={ctaHref(item, nextSession)}
            {...(ctaIsExternal(item) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {ctaLabel(item)}
          </a>
          <button
            type="button"
            className="lg__cta-mini__btn lg__cta-mini__btn--ghost"
            onClick={() => setDownloadOpen(true)}
          >
            ↓ Télécharger le programme
          </button>
          <a
            className="lg__cta-mini__sub"
            href="mailto:formations@lesgriots.com?subject=Devis%20OPCO%20%2F%20FAF"
          >
            Étudier un financement
          </a>
        </div>
      </aside>
      </div>{/* /.lg__formation__layout */}

      {downloadOpen && (
        <DownloadModal
          item={item}
          onClose={() => setDownloadOpen(false)}
        />
      )}

      {/* Bloc CTA final pleine largeur en bas de page — la vidéo de la
          formation tourne en background avec un voile sombre par-dessus. */}
      <div className="lg__cta-final">
        {f.media && f.media.type === "video" ? (
          <video
            className="lg__cta-final__bg"
            src={f.media.src}
            poster={f.media.poster}
            autoPlay
            loop
            muted
            playsInline
            aria-hidden="true"
          />
        ) : f.media && (
          <img
            className="lg__cta-final__bg"
            src={f.media.src}
            alt=""
            aria-hidden="true"
          />
        )}
        <div className="lg__cta-final__veil" aria-hidden="true" />
        <div className="lg__cta-final__inner">
          <p className="lg__cta-final__kicker">Prêt à commencer ?</p>
          <h2 className="lg__cta-final__title">{f.title}</h2>
          {f.price && (
            <p className="lg__cta-final__price">
              {f.price}
              <span className="lg__cta-final__price__ht">
                {" "}{kind === "workshop" ? "TTC" : "HT"}
              </span>
            </p>
          )}
          <a
            className="lg__cta-final__btn"
            href={ctaHref(item, nextSession)}
            {...(ctaIsExternal(item) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {ctaLabel(item)}
          </a>
        </div>
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

        {/* Badge CPF : visible en haut de l'overview pour qu'on sache
            immédiatement si la formation est éligible CPF + code RS si
            elle est certifiante. Lien optionnel vers la fiche France
            Compétences. */}
        {f.cpf && (
          <div className="lg__detail__cpf-badge" aria-label="Formation éligible CPF">
            <span className="lg__detail__cpf-badge__main">[ ÉLIGIBLE CPF ]</span>
            {f.rs && (
              <span className="lg__detail__cpf-badge__rs">
                · Certification <strong>{f.rs}</strong>
                {f.certifier && <> · Certificateur {f.certifier}</>}
              </span>
            )}
            {f.franceCompetencesUrl && (
              <a
                className="lg__detail__cpf-badge__link"
                href={f.franceCompetencesUrl}
                target="_blank"
                rel="noopener noreferrer">
                · Voir la fiche France Compétences →
              </a>
            )}
          </div>
        )}

        <div className="lg__detail__grid">
          <div>
            <h6>DURÉE</h6>
            <p>{formatDuration(f.duration)}</p>
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
          {/* CTA prioritaire Mon Compte Formation pour les formations
              éligibles CPF (avec un cpfUrl) — financement direct depuis
              le compte personnel de formation du candidat. */}
          {f.cpf && f.cpfUrl && (
            <a
              className="lg__btn lg__btn--primary lg__btn--cpf"
              href={f.cpfUrl}
              target="_blank"
              rel="noopener noreferrer">
              S'INSCRIRE VIA MON COMPTE FORMATION →
            </a>
          )}
          <a className={"lg__btn" + (f.cpf && f.cpfUrl ? "" : " lg__btn--primary")} href="mailto:formations@lesgriots.com?subject=Inscription%20%E2%80%94%20{title}">
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

// Page de checkout custom alimentée par Stripe Elements — le visiteur
// paie SUR le site lagriotheque, on n'envoie plus vers buy.stripe.com.
// Flow :
//   1. La page POST /api/stripe/create-payment-intent (backoffice) →
//      reçoit un client_secret Stripe
//   2. Stripe Elements monte un Payment Element (champs CB sécurisés,
//      Apple Pay, Google Pay, Link…) avec ce client_secret
//   3. Au submit : stripe.confirmPayment() valide le paiement et redirige
//      vers la page de merci (return_url)
function CheckoutStripe({ item }) {
  const PK = (typeof window !== "undefined" && window.SITE_CONFIG && window.SITE_CONFIG.stripePublishableKey) || null;
  const ENDPOINT = (typeof window !== "undefined" && window.SITE_CONFIG && window.SITE_CONFIG.stripeCheckoutEndpoint) || null;

  const [step, setStep] = useState("init"); // init | ready | submitting | error
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const paymentElementRef = useRef(null);
  const linkAuthRef = useRef(null);
  const addressRef = useRef(null);

  // Initialisation : charge Stripe.js → crée le PaymentIntent → monte les Elements
  useEffect(() => {
    if (!PK || !ENDPOINT) {
      setStep("error");
      setError("Configuration Stripe manquante (clé publique ou endpoint).");
      return;
    }
    if (typeof window.Stripe !== "function") {
      setStep("error");
      setError("Stripe.js n'a pas pu être chargé. Vérifie ta connexion.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // 1. POST au backend pour créer le PaymentIntent
        const r = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workshopId: item.id }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || ("Backend error " + r.status));
        }
        const { clientSecret } = await r.json();
        if (cancelled) return;

        // 2. Init Stripe + Elements avec le client_secret
        const stripe = window.Stripe(PK, { locale: "fr" });
        stripeRef.current = stripe;
        const elements = stripe.elements({
          clientSecret,
          // Style : aligne sur la palette du site
          appearance: {
            theme: "stripe",
            variables: {
              fontFamily: '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              colorPrimary: "#000000",
              colorBackground: "#ffffff",
              colorText: "#000000",
              colorDanger: "#cc3333",
              fontSizeBase: "15px",
              spacingUnit: "4px",
              borderRadius: "0px",
            },
            rules: {
              ".Input": {
                border: "1px solid #000000",
                boxShadow: "none",
                padding: "12px 14px",
              },
              ".Input:focus": {
                border: "2px solid #000000",
                boxShadow: "none",
              },
              ".Label": {
                fontFamily: '"Geist Mono", monospace',
                fontSize: "10px",
                fontWeight: "500",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#6b6b6b",
              },
              ".Tab": {
                border: "1px solid #000000",
                borderRadius: "0px",
              },
              ".Tab--selected": {
                borderColor: "#000000",
                backgroundColor: "#000000",
                color: "#ffffff",
              },
            },
          },
        });
        elementsRef.current = elements;

        // 3. Monte les Elements
        // - linkAuthentication : email + auto-login Stripe Link
        // - paymentElement : carte, Apple Pay, Google Pay, etc.
        // - addressElement : adresse de facturation
        const linkAuth = elements.create("linkAuthentication");
        linkAuth.mount("#lg-link-auth");
        linkAuth.on("change", (e) => setEmail(e.value.email || ""));
        linkAuthRef.current = linkAuth;

        const payment = elements.create("payment", {
          layout: "tabs",
          defaultValues: { billingDetails: { name: "" } },
        });
        payment.mount("#lg-payment");
        paymentElementRef.current = payment;

        const address = elements.create("address", {
          mode: "billing",
          allowedCountries: ["FR", "BE", "CH", "LU", "DE", "ES", "IT", "GB"],
          defaultValues: { country: "FR" },
          fields: { phone: "auto" },
        });
        address.mount("#lg-address");
        address.on("change", (e) => {
          if (e.value?.name) setName(e.value.name);
        });
        addressRef.current = address;

        setStep("ready");
      } catch (err) {
        console.error("[checkout] init failed", err);
        if (!cancelled) {
          setStep("error");
          setError(err.message || "Impossible d'initialiser le paiement.");
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [item.id]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (step !== "ready") return;
    if (!stripeRef.current || !elementsRef.current) return;
    setStep("submitting");
    setError("");
    const { error: stripeErr } = await stripeRef.current.confirmPayment({
      elements: elementsRef.current,
      confirmParams: {
        return_url: window.location.origin + window.location.pathname + "#/merci?ws=" + encodeURIComponent(item.id),
        receipt_email: email || undefined,
      },
    });
    if (stripeErr) {
      setError(stripeErr.message || "Paiement refusé.");
      setStep("ready");
    }
    // Si succès, Stripe redirige automatiquement vers return_url
  };

  // Décomposition HT / TVA / TTC à partir du prix
  const breakdown = (() => {
    const m = (item.price || "").match(/(\d[\d.,\s]*)/);
    const ttc = m ? parseFloat(m[1].replace(/\s/g, "").replace(",", ".")) : null;
    if (ttc == null) return null;
    const ht = ttc / 1.2;
    const vat = ttc - ht;
    const fmt = (n) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
    return { ht: fmt(ht), vat: fmt(vat), ttc: fmt(ttc) };
  })();

  return (
    <section className="lg__checkout">
      <div className="lg__checkout__grid">
        {/* === Colonne gauche : récap produit === */}
        <div className="lg__checkout__product">
          <p className="lg__checkout__kicker">LA GRIOTHÈQUE · {item.discipline || "WORKSHOP"}</p>
          <h1 className="lg__checkout__product__title">{item.title}</h1>
          {item.tagline && (
            <p className="lg__checkout__product__tagline">{item.tagline}</p>
          )}
          {item.media && (
            <div className="lg__checkout__product__media">
              {item.media.type === "video" ? (
                <video src={item.media.src} poster={item.media.poster} autoPlay loop muted playsInline />
              ) : (
                <img src={item.media.src} alt={item.title} />
              )}
            </div>
          )}
          <ul className="lg__checkout__product__meta">
            {item.duration && <li><span>Durée</span><span>{formatDuration(item.duration)}</span></li>}
            {item.format && <li><span>Format</span><span>{item.format}</span></li>}
            {item.trainer && <li><span>Formateur</span><span>{Array.isArray(item.trainer) ? item.trainer.map((t) => t.name).join(", ") : item.trainer.name}</span></li>}
            {item.location && <li><span>Lieu</span><span>{item.location.split(".")[0]}</span></li>}
          </ul>
          {breakdown && (
            <ul className="lg__checkout__product__breakdown">
              <li><span>Sous-total HT</span><span>{breakdown.ht}</span></li>
              <li><span>TVA 20 %</span><span>{breakdown.vat}</span></li>
            </ul>
          )}
          <div className="lg__checkout__product__total">
            <span>Total à payer</span>
            <strong>{item.price || "—"}</strong>
          </div>
          <p className="lg__checkout__product__hint">
            TVA 20 % incluse — paiement unique, sans abonnement.
          </p>
        </div>

        {/* === Colonne droite : Stripe Elements === */}
        <form className="lg__checkout__form" onSubmit={onSubmit}>
          {step === "init" && (
            <p className="lg__checkout__loading">Chargement du paiement sécurisé…</p>
          )}
          {step === "error" && (
            <div className="lg__checkout__alert">
              <p><strong>Une erreur est survenue.</strong></p>
              <p>{error}</p>
            </div>
          )}

          <h2 className="lg__checkout__form__section">Email</h2>
          <div id="lg-link-auth" className="lg__checkout__stripe-mount" />

          <h2 className="lg__checkout__form__section">Adresse de facturation</h2>
          <div id="lg-address" className="lg__checkout__stripe-mount" />

          <h2 className="lg__checkout__form__section">Paiement</h2>
          <div id="lg-payment" className="lg__checkout__stripe-mount" />

          {error && step === "ready" && (
            <p className="lg__checkout__error">{error}</p>
          )}

          <button
            type="submit"
            className="lg__checkout__btn lg__checkout__btn--pay"
            disabled={step !== "ready"}
          >
            {step === "submitting" ? "Paiement en cours…" : `🔒 Payer ${item.price || ""}`}
          </button>

          <p className="lg__checkout__form__secured">
            Paiement sécurisé par Stripe · PCI DSS · 3D Secure
          </p>
        </form>
      </div>
    </section>
  );
}

// Ancienne page démo gardée comme fallback si la config Stripe manque.
function CheckoutDemo({ item }) {
  const [email, setEmail] = useState("");
  const [cardNum, setCardNum] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [name, setName] = useState("");
  const [tos, setTos] = useState(false);
  const [step, setStep] = useState("form"); // "form" | "success"

  const onSubmit = (e) => {
    e.preventDefault();
    setStep("success");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (step === "success") {
    return (
      <section className="lg__checkout">
        <div className="lg__checkout__success">
          <p className="lg__checkout__demo-tag">DÉMO — paiement non réel</p>
          <h1 className="lg__checkout__success__title">Merci !</h1>
          <p className="lg__checkout__success__lede">
            Ta réservation pour <strong>« {item.title} »</strong> est confirmée.
          </p>
          <p className="lg__checkout__success__hint">
            Un email de confirmation a été envoyé à{" "}
            <strong>{email || "ton.email@exemple.com"}</strong> (simulé).
            Tu vas recevoir les détails pratiques (date, lieu, support) dans les
            48h.
          </p>
          <div className="lg__checkout__success__actions">
            <a href="#/" className="lg__checkout__btn lg__checkout__btn--ghost">
              ← Retour à l'accueil
            </a>
            <a
              href={`#/${item.id.startsWith("ws-") ? "workshops" : "formations"}/${item.id}`}
              className="lg__checkout__btn lg__checkout__btn--ghost"
            >
              Revoir la fiche
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="lg__checkout">
      <div className="lg__checkout__demo-banner">
        ⚠ Page de DÉMO — aucune transaction réelle n'est effectuée. Aucune CB
        n'est nécessaire (tu peux laisser les champs vides).
      </div>
      <div className="lg__checkout__grid">
        {/* Colonne gauche : récap produit */}
        <div className="lg__checkout__product">
          <p className="lg__checkout__kicker">LA GRIOTHÈQUE · {item.discipline || "FORMATION"}</p>
          <h1 className="lg__checkout__product__title">{item.title}</h1>
          {item.tagline && (
            <p className="lg__checkout__product__tagline">{item.tagline}</p>
          )}
          {item.media && (
            <div className="lg__checkout__product__media">
              {item.media.type === "video" ? (
                <video src={item.media.src} poster={item.media.poster} autoPlay loop muted playsInline />
              ) : (
                <img src={item.media.src} alt={item.title} />
              )}
            </div>
          )}
          <ul className="lg__checkout__product__meta">
            {item.duration && <li><span>Durée</span><span>{formatDuration(item.duration)}</span></li>}
            {item.format && <li><span>Format</span><span>{item.format}</span></li>}
            {item.trainer && <li><span>Formateur</span><span>{Array.isArray(item.trainer) ? item.trainer.map((t) => t.name).join(", ") : item.trainer.name}</span></li>}
            {item.location && <li><span>Lieu</span><span>{item.location.split(".")[0]}</span></li>}
          </ul>
          {(() => {
            // Décompose le prix TTC en HT + TVA 20 % pour la transparence.
            // Marche si item.price est une chaîne du type "300 €", "300€",
            // "300 EUR". Si on ne parvient pas à parser, on n'affiche que le
            // total tel quel.
            const m = (item.price || "").match(/(\d[\d.,\s]*)/);
            const ttc = m ? parseFloat(m[1].replace(/\s/g, "").replace(",", ".")) : null;
            const ht = ttc != null ? ttc / 1.2 : null;
            const vat = ttc != null ? ttc - ht : null;
            const fmt = (n) =>
              n != null
                ? n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
                : "—";
            return (
              <>
                {ttc != null && (
                  <ul className="lg__checkout__product__breakdown">
                    <li>
                      <span>Sous-total HT</span>
                      <span>{fmt(ht)}</span>
                    </li>
                    <li>
                      <span>TVA 20 %</span>
                      <span>{fmt(vat)}</span>
                    </li>
                  </ul>
                )}
                <div className="lg__checkout__product__total">
                  <span>Total à payer (TTC)</span>
                  <strong>{item.price || "—"}</strong>
                </div>
                <p className="lg__checkout__product__hint">
                  TVA 20 % incluse — paiement unique, sans abonnement.
                </p>
              </>
            );
          })()}
        </div>

        {/* Colonne droite : formulaire de paiement (faux) */}
        <form className="lg__checkout__form" onSubmit={onSubmit}>
          <h2 className="lg__checkout__form__section">Ton compte</h2>
          <label className="lg__checkout__field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton.email@exemple.com"
            />
          </label>

          <h2 className="lg__checkout__form__section">Paiement</h2>
          <div className="lg__checkout__method lg__checkout__method--active">
            <span className="lg__checkout__method__radio" aria-hidden="true">●</span>
            <span className="lg__checkout__method__label">💳 Carte bancaire</span>
          </div>
          <label className="lg__checkout__field">
            <span>Numéro de carte</span>
            <input
              type="text"
              value={cardNum}
              onChange={(e) => setCardNum(e.target.value)}
              placeholder="1234 1234 1234 1234"
              maxLength={19}
            />
          </label>
          <div className="lg__checkout__row">
            <label className="lg__checkout__field">
              <span>Expiration</span>
              <input
                type="text"
                value={exp}
                onChange={(e) => setExp(e.target.value)}
                placeholder="MM / AA"
                maxLength={7}
              />
            </label>
            <label className="lg__checkout__field">
              <span>CVC</span>
              <input
                type="text"
                value={cvc}
                onChange={(e) => setCvc(e.target.value)}
                placeholder="CVC"
                maxLength={4}
              />
            </label>
          </div>

          <h2 className="lg__checkout__form__section">Coordonnées</h2>
          <label className="lg__checkout__field">
            <span>Nom complet</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prénom Nom"
            />
          </label>

          <label className="lg__checkout__tos">
            <input
              type="checkbox"
              checked={tos}
              onChange={(e) => setTos(e.target.checked)}
            />
            <span>
              J'accepte les <a href="#/cgv">CGV</a> et la{" "}
              <a href="#/confidentialite">politique de confidentialité</a>.
            </span>
          </label>

          <button type="submit" className="lg__checkout__btn lg__checkout__btn--pay">
            🔒 Payer {item.price || "—"}
          </button>

          <p className="lg__checkout__form__secured">
            Paiement sécurisé — démo. En prod ce bouton ouvrira Stripe Checkout.
          </p>
        </form>
      </div>
    </section>
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
        text={text(
          "catalogue.intro",
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
        )}
        sub={text("catalogue.sub", "Lorem ipsum · dolor sit amet · consectetur")}
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
        text={text(
          "workshops_page.intro",
          "Workshops résidentiels et intensifs courts pour les indépendants déjà en activité — format immersif, groupes restreints, accompagnement individuel sur projet réel."
        )}
        sub={text(
          "workshops_page.sub",
          "2026. Paris & en résidence. Sur sélection de dossier."
        )}
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
const DAYS_FR = [
  "Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi",
];

// Renvoie la date complète "Mercredi 15 avril 2026" si on a year/month/day,
// sinon le mois+année seul ("Avril 2026"), sinon le brut ("Date à confirmer").
// On capitalise la 1re lettre — typo française classique.
function fullDateLabel(dateInfo) {
  if (!dateInfo || dateInfo.monthIdx === undefined) return "";
  if (dateInfo.day) {
    // Date JS pour récupérer le jour de la semaine (0 = dimanche)
    const d = new Date(dateInfo.year, dateInfo.monthIdx, dateInfo.day);
    const dow = DAYS_FR[d.getDay()];
    const month = (MONTHS_FR[dateInfo.monthIdx] || "").toLowerCase();
    return `${dow} ${dateInfo.day} ${month} ${dateInfo.year}`;
  }
  // Pas de jour précis → on garde le monthLabel (ex: "Avril 2026")
  return dateInfo.monthLabel || "";
}

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
  // Date complète "Mercredi 15 avril 2026" — choix éditorial validé avec Moos.
  const dateLong = fullDateLabel(dateInfo);
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
          {/* Date complète sur une seule ligne, sans la séparation jour/mois.
              Le rendu lit comme une phrase courte ("Mercredi 15 avril 2026")
              au lieu de plaquer un numéro géant + un mois en mono caps. */}
          <div className="lg__ag__date__full">{dateLong}</div>
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
            {item?.duration && <Pair label="Durée" value={formatDuration(item.duration)} />}
            {item?.format && <Pair label="Format" value={item.format} />}
            {/* Lieu : priorité au lieu défini sur la session (s.location),
                sinon on retombe sur celui de la formation/workshop (item.location). */}
            {(s.location || item?.location) && (
              <Pair label="Lieu" value={s.location || item.location} />
            )}
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
              <div style={{ fontSize: 13 }}>{formatDuration(item.duration)}</div>
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

// Libellé lisible d'un type de ressource (réutilisé par la ligne et la page).
function resourceTypeLabel(type) {
  return {
    template: "TEMPLATE",
    guide: "GUIDE",
    article: "ARTICLE",
    video: "VIDÉO",
    outil: "OUTIL",
  }[type] || "RESSOURCE";
}

function ResourceRow({ r }) {
  const titleRef = useMarqueeOverflow([r.title]);
  const typeLabel = resourceTypeLabel(r.type);

  // Sur clic : navigue vers la page détail de la ressource (#/ressources/<id>).
  // Le téléchargement (avec capture email) se fait depuis cette page.
  return (
    <a
      className={"lg__row" + (r.available ? "" : " is-soon")}
      href={`#/ressources/${r.id}`}
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
  // Étape post-submit : "form" → "done" (affiche la confirmation 2.5s avant fermeture)
  const [step, setStep] = useState("form");

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

  // Déclenche un VRAI téléchargement (pas window.open qui ouvre en nouvel onglet).
  // L'attribut `download` force le navigateur à sauvegarder le fichier au lieu
  // de l'afficher inline. Marche pour les URLs same-origin (nos PDFs servis par
  // le site) ; pour les URLs externes, le download attr est ignoré et on
  // retombe sur un nouvel onglet, c'est OK aussi.
  function triggerDownload(href) {
    const a = document.createElement("a");
    a.href = href;
    a.download = ""; // garde le nom de fichier d'origine
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

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

    // Déclenche le téléchargement + bascule sur l'écran de confirmation.
    // Auto-close après 2.5s pour que le visiteur voie bien le message.
    if (resource.href && resource.href !== "#") {
      triggerDownload(resource.href);
      setStep("done");
      setTimeout(() => onClose(), 2500);
    } else {
      alert("Le fichier n'est pas encore disponible. Tu seras prévenu(e) par email dès qu'il sera prêt.");
      onClose();
    }
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

        {step === "done" ? (
          /* Écran de confirmation — visible 2.5s avant fermeture auto.
             Permet au visiteur de comprendre que (1) son email est enregistré
             et (2) le téléchargement vient de démarrer (au cas où le fichier
             arrive direct dans son dossier Téléchargements sans aucune fanfare). */
          <div style={{ padding: "8px 0 12px" }}>
            <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 14 }}>
              ✓ Merci{name ? `, ${name}` : ""} — ton email est enregistré.
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 18, opacity: 0.75 }}>
              Le téléchargement vient de démarrer (regarde ton dossier <em>Téléchargements</em>).
              Si rien ne s'est lancé, clique ici :
            </p>
            <a
              href={resource.href}
              download
              target="_blank"
              rel="noopener"
              style={{
                display: "inline-block",
                padding: "10px 18px",
                border: "1px solid var(--ink)",
                background: "var(--ink)",
                color: "var(--paper)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                textDecoration: "none",
              }}
            >
              ↓ Télécharger à nouveau
            </a>
            <p style={{ fontSize: 11, opacity: 0.5, marginTop: 18 }}>
              Cette fenêtre se fermera dans quelques secondes.
            </p>
          </div>
        ) : (
        <>
        <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 24, opacity: 0.75 }}>
          Laisse-nous ton email et le téléchargement démarre dans la foulée.
          On t'enverra aussi occasionnellement nos prochaines ressources.
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
        </>
        )}
      </div>
    </div>
  );
}

function Ressources() {
  return (
    <section className="lg__catalogue" id="ressources">
      <PageIntro
        text={text(
          "ressources.intro",
          "Worksheets, templates et guides — des outils gratuits pour structurer ton récit, affûter ta méthode et renforcer ta marque personnelle. À télécharger et à utiliser dès aujourd'hui."
        )}
        sub={text("ressources.sub", "Gratuites · mises à jour régulièrement")}
      />
      <div className="lg__rows">
        {RESOURCES.map((r) => (
          <ResourceRow key={r.id} r={r} />
        ))}
      </div>
    </section>
  );
}

// Page détail d'une ressource — inspirée des pages produit The Futur :
// couverture, accroche, description, "ce que tu obtiens", crédit auteur, et
// un gros CTA de téléchargement qui ouvre la modal de capture email.
function ResourcePage({ r }) {
  const [requested, setRequested] = useState(false);
  const typeLabel = resourceTypeLabel(r.type);

  // Description : un paragraphe par ligne vide. "Ce que tu obtiens" : une puce par ligne.
  const paras = (r.description || "").split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const inside = (r.whatsInside || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const coverSrc = r.cover && r.cover.trim() ? r.cover : null;

  return (
    <section className="lg__resource" id="ressource">
      <a className="lg__resource__back" href="#/ressources">← toutes les ressources</a>

      <div className="lg__resource__grid">
        {/* Colonne média : couverture + carte de téléchargement */}
        <aside className="lg__resource__aside">
          <div className="lg__resource__cover">
            {coverSrc
              ? <img src={coverSrc} alt={r.title} loading="lazy" />
              : <div className="lg__resource__cover--ph" aria-hidden="true">{typeLabel}</div>}
          </div>
          <div className="lg__resource__card">
            <p className="lg__resource__card__meta">{typeLabel}{r.format ? " · " + r.format : ""}</p>
            <p className="lg__resource__card__price">GRATUIT</p>
            {r.available ? (
              <button className="lg__btn lg__btn--primary lg__resource__cta" onClick={() => setRequested(true)}>
                Télécharger ▶
              </button>
            ) : (
              <button className="lg__btn lg__resource__cta" disabled>Bientôt disponible</button>
            )}
            <p className="lg__resource__card__note">Envoyé par email · sans spam · désinscription en 1 clic</p>
          </div>
        </aside>

        {/* Colonne contenu */}
        <div className="lg__resource__body">
          <p className="lg__resource__kicker">{typeLabel}</p>
          <h1 className="lg__resource__title">{r.title}</h1>
          {r.subtitle && <p className="lg__resource__subtitle">{r.subtitle}</p>}
          {r.author && <p className="lg__resource__author">Par {r.author}</p>}

          {paras.length > 0 && (
            <div className="lg__resource__desc">
              {paras.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          )}

          {inside.length > 0 && (
            <div className="lg__resource__inside">
              <h2 className="lg__resource__h2">Ce que tu obtiens</h2>
              <ul>
                {inside.map((it, i) => <li key={i}>{it}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>

      {requested && (
        <ResourceModal resource={r} onClose={() => setRequested(false)} />
      )}
    </section>
  );
}

function CGV() {
  return (
    <section className="lg__cgv" id="cgv">
      <h1 className="lg__cgv__title">{text("cgv.title", "Conditions générales de vente")}</h1>
      <p className="lg__cgv__lede">
        {renderManifestoBrand(text(
          "cgv.lede",
          "Applicables aux prestations de formation et d'accompagnement proposées par LA GRIOTHÈQUE, pilier formation de la SASU LES GRIOTS. Version mise à jour le 14 mars 2026."
        ))}
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
            Siège social : 80 avenue du 8 mai 1945, 76610 Le Havre, France.
            SIREN : 902 628 684 · RCS Le Havre 902 628 684 · SIRET : 902 628 684 00018.
            <strong> TVA non applicable, art. 293 B du CGI.</strong>
            Numéro de déclaration d'activité (NDA) : 28760747176, enregistré
            auprès de la DREETS Normandie.
            Spécialité de formation : techniques de l'image et du son,
            métiers connexes du spectacle.
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
            tout litige sera porté devant le tribunal compétent du Havre (siège social).
          </p>
        </li>
      </ol>

      <p className="lg__cgv__footer">
        {text(
          "cgv.footer_contact",
          "Pour toute question relative aux présentes CGV, contacter LA GRIOTHÈQUE à formations@lesgriots.com."
        )}
      </p>
    </section>
  );
}

// Mentions légales — page obligatoire (Loi LCEN 2004).
// Reprend exactement les classes .lg__cgv pour la cohérence de mise en page :
// même typo, même rythme, même style éditorial SUPSI.
function MentionsLegales() {
  return (
    <section className="lg__cgv" id="mentions-legales">
      <h1 className="lg__cgv__title">{text("mentions_legales.title", "Mentions légales")}</h1>
      <p className="lg__cgv__lede">
        {text(
          "mentions_legales.lede",
          "Informations légales relatives au site lagriotheque.com, édité par la SASU LES GRIOTS. Conformément à la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN). Version au 25 mai 2026."
        )}
      </p>

      <ol className="lg__cgv__list">
        <li>
          <h2>01 — Éditeur du site</h2>
          <p>
            <strong>SASU LES GRIOTS</strong>, Société par actions simplifiée
            unipersonnelle au capital de 1 000 €.<br />
            Siège social : 80 avenue du 8 mai 1945, 76610 Le Havre, France.<br />
            SIREN : 902 628 684 — RCS Le Havre 902 628 684 — SIRET : 902 628 684 00018.<br />
            Code APE : 5911B (Production de films institutionnels et publicitaires).<br />
            TVA non applicable, art. 293 B du CGI (franchise en base).<br />
            Numéro de déclaration d'activité (NDA) : 28760747176, enregistré
            auprès de la DREETS Normandie.<br />
            Spécialité de formation : techniques de l'image et du son,
            métiers connexes du spectacle.<br />
            Certifié Qualiopi au titre de la catégorie « Actions de formation ».
          </p>
        </li>

        <li>
          <h2>02 — Directeur de la publication</h2>
          <p>
            Moustapha COULIBALY, en sa qualité de président de la SASU
            LES GRIOTS.<br />
            Contact :{" "}
            <a href="mailto:formations@lesgriots.com">formations@lesgriots.com</a>
          </p>
        </li>

        <li>
          <h2>03 — Hébergeur</h2>
          <p>
            Le site est hébergé par <strong>OVH SAS</strong>, société par
            actions simplifiée au capital de 50 909 766,40 €.<br />
            Siège social : 2 rue Kellermann, 59100 Roubaix, France.<br />
            RCS Lille Métropole : 424 761 419.<br />
            Téléphone : 09 72 10 10 07.<br />
            Site web :{" "}
            <a href="https://www.ovhcloud.com" target="_blank" rel="noopener">
              www.ovhcloud.com
            </a>
          </p>
        </li>

        <li>
          <h2>04 — Propriété intellectuelle</h2>
          <p>
            L'ensemble du contenu du site (textes, images, vidéos, logos,
            structure, code, ressources téléchargeables) est la propriété
            exclusive de la SASU LES GRIOTS, sauf mention contraire explicite.
            Toute reproduction, représentation, modification ou exploitation,
            totale ou partielle, sans autorisation écrite préalable, est
            interdite et constitue une contrefaçon sanctionnée par les
            articles L. 335-2 et suivants du Code de la propriété intellectuelle.
          </p>
        </li>

        <li>
          <h2>05 — Marques et noms commerciaux</h2>
          <p>
            « LA GRIOTHÈQUE » et « LES GRIOTS » sont les noms commerciaux
            utilisés par la SASU LES GRIOTS dans le cadre de son activité.
            Toute utilisation non autorisée de ces dénominations,
            reproduction du logo ou imitation susceptible de créer une
            confusion est susceptible d'engager la responsabilité de son
            auteur sur le fondement de la concurrence déloyale et du
            parasitisme.
          </p>
        </li>

        <li>
          <h2>06 — Données personnelles</h2>
          <p>
            Le traitement des données personnelles collectées via ce site
            (notamment via le formulaire de demande de ressources) est régi
            par notre <a href="#/confidentialite">Politique de confidentialité</a>.
          </p>
        </li>

        <li>
          <h2>07 — Cookies</h2>
          <p>
            Ce site n'utilise pas de cookies de traçage (analytics, publicité,
            réseaux sociaux). Seuls des cookies techniques strictement
            nécessaires au fonctionnement du site peuvent être utilisés (ex :
            préférences d'affichage). Ils ne nécessitent pas de consentement
            au titre de l'article 82 de la loi Informatique et Libertés.
          </p>
        </li>

        <li>
          <h2>08 — Liens externes</h2>
          <p>
            Le site peut contenir des liens vers des sites externes. LES GRIOTS
            décline toute responsabilité quant au contenu de ces sites tiers.
          </p>
        </li>

        <li>
          <h2>09 — Droit applicable</h2>
          <p>
            Les présentes mentions légales sont régies par le droit français.
            Tout litige relèvera de la compétence des tribunaux du ressort du
            siège social (Le Havre).
          </p>
        </li>
      </ol>

      <p className="lg__cgv__footer">
        {text(
          "mentions_legales.footer_contact",
          "Pour toute question relative à ces mentions, contacter formations@lesgriots.com."
        )}
      </p>
    </section>
  );
}

// Politique de confidentialité — obligatoire RGPD (Règlement UE 2016/679).
// Décrit qui collecte, quoi, pourquoi, combien de temps, avec qui, et les droits
// de la personne concernée. Conforme aux recommandations CNIL.
function Confidentialite() {
  return (
    <section className="lg__cgv" id="confidentialite">
      <h1 className="lg__cgv__title">{text("confidentialite.title", "Politique de confidentialité")}</h1>
      <p className="lg__cgv__lede">
        {renderManifestoBrand(text(
          "confidentialite.lede",
          "Comment LA GRIOTHÈQUE traite les données personnelles collectées via ce site. Conforme au Règlement général sur la protection des données (RGPD, UE 2016/679) et à la Loi Informatique et Libertés. Version au 25 mai 2026."
        ))}
      </p>

      <ol className="lg__cgv__list">
        <li>
          <h2>01 — Responsable de traitement</h2>
          <p>
            <strong>SASU LES GRIOTS</strong><br />
            80 avenue du 8 mai 1945, 76610 Le Havre, France.<br />
            SIREN 902 628 684 — RCS Le Havre.<br />
            Contact :{" "}
            <a href="mailto:formations@lesgriots.com">formations@lesgriots.com</a>
          </p>
        </li>

        <li>
          <h2>02 — Données collectées</h2>
          <p>
            Nous collectons uniquement les données strictement nécessaires
            aux finalités décrites ci-dessous :
          </p>
          <ul>
            <li><strong>Email</strong> (obligatoire pour télécharger une ressource ou demander une session)</li>
            <li><strong>Prénom</strong> (facultatif, pour personnaliser les communications)</li>
            <li><strong>Consentement</strong> (case cochée pour accepter ces conditions)</li>
            <li><strong>Identifiant et date</strong> de la demande (généré automatiquement)</li>
          </ul>
          <p>
            Aucune donnée sensible (santé, opinion, origine, etc.) n'est
            collectée. Aucun cookie de traçage n'est déposé.
          </p>
        </li>

        <li>
          <h2>03 — Finalités du traitement</h2>
          <p>
            Vos données sont utilisées pour :
          </p>
          <ul>
            <li>vous transmettre la ressource demandée ;</li>
            <li>vous informer occasionnellement de nos nouvelles ressources,
              sessions de formation ou actualités pédagogiques (si vous avez
              donné votre consentement) ;</li>
            <li>répondre à vos demandes de contact.</li>
          </ul>
          <p>
            <strong>Base légale :</strong> votre consentement explicite
            (article 6.1.a du RGPD), donné via la case à cocher du formulaire.
          </p>
        </li>

        <li>
          <h2>04 — Durée de conservation</h2>
          <p>
            Vos données sont conservées <strong>3 ans à compter de votre
            dernier contact actif</strong> (téléchargement, ouverture d'email,
            réponse). Au-delà, elles sont supprimées de nos bases.
          </p>
        </li>

        <li>
          <h2>05 — Destinataires des données</h2>
          <p>
            Vos données sont accessibles uniquement aux personnes habilitées
            de LA GRIOTHÈQUE. Elles peuvent être traitées par nos
            sous-traitants techniques strictement pour les besoins de
            fonctionnement du service :
          </p>
          <ul>
            <li>hébergeur du site (OVH SAS, France)</li>
            <li>fournisseur d'envoi d'email transactionnel (si activé ultérieurement)</li>
          </ul>
          <p>
            Vos données ne sont <strong>jamais vendues, louées ou cédées</strong>{" "}
            à des tiers à des fins commerciales.
          </p>
        </li>

        <li>
          <h2>06 — Transferts hors UE</h2>
          <p>
            Toutes nos données sont stockées sur des serveurs situés en Union
            européenne (OVH, France). Aucun transfert hors UE n'a lieu dans
            le cadre du fonctionnement normal du site.
          </p>
        </li>

        <li>
          <h2>07 — Vos droits</h2>
          <p>
            Conformément au RGPD, vous disposez à tout moment des droits suivants
            sur vos données personnelles :
          </p>
          <ul>
            <li>droit d'<strong>accès</strong> à vos données ;</li>
            <li>droit de <strong>rectification</strong> des données inexactes ;</li>
            <li>droit à l'<strong>effacement</strong> (« droit à l'oubli ») ;</li>
            <li>droit à la <strong>limitation</strong> du traitement ;</li>
            <li>droit à la <strong>portabilité</strong> de vos données (export) ;</li>
            <li>droit d'<strong>opposition</strong> au traitement ;</li>
            <li>droit de <strong>retirer votre consentement</strong> à tout moment ;</li>
            <li>droit de définir des <strong>directives post-mortem</strong>.</li>
          </ul>
          <p>
            Pour exercer ces droits, écrivez-nous à{" "}
            <a href="mailto:formations@lesgriots.com">formations@lesgriots.com</a>
            {" "}avec votre demande. Nous y répondons sous 30 jours.
          </p>
        </li>

        <li>
          <h2>08 — Réclamation auprès de la CNIL</h2>
          <p>
            Si vous estimez que vos droits ne sont pas respectés, vous pouvez
            adresser une réclamation à la Commission Nationale de l'Informatique
            et des Libertés (CNIL) :{" "}
            <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener">
              www.cnil.fr/fr/plaintes
            </a>{" "}
            — ou par courrier à 3 place de Fontenoy, 75007 Paris.
          </p>
        </li>

        <li>
          <h2>09 — Sécurité</h2>
          <p>
            Nous mettons en œuvre les mesures techniques et organisationnelles
            appropriées pour protéger vos données : chiffrement HTTPS du site,
            accès restreint à la base de données, sauvegardes régulières,
            authentification renforcée du back-office.
          </p>
        </li>

        <li>
          <h2>10 — Modifications de cette politique</h2>
          <p>
            La présente politique peut évoluer pour refléter de nouvelles
            obligations légales ou de nouveaux traitements. La date en haut
            de page indique la dernière mise à jour. Pour les modifications
            substantielles, vous serez informé par email si vous figurez dans
            notre base de contacts.
          </p>
        </li>
      </ol>

      <p className="lg__cgv__footer">
        Pour toute question relative à vos données personnelles, contactez-nous à
        <a href="mailto:formations@lesgriots.com"> formations@lesgriots.com</a>.
      </p>
    </section>
  );
}

function Approche() {
  // Le lede contient le nom de marque qu'on veut habiller en .lg-brand ;
  // on utilise renderManifestoBrand pour le faire automatiquement à partir
  // du texte saisi en BO.
  return (
    <section className="lg__approche" id="approche">
      <h1 className="lg__approche__title">{text("approche.title", "Notre approche")}</h1>
      <p className="lg__approche__lede">
        {renderManifestoBrand(text(
          "approche.lede",
          "Trois points qui définissent l'ADN de LA GRIOTHÈQUE — ce qui nous rend différents d'un centre de formation comme les autres."
        ))}
      </p>

      <ApprocheAccordion />

      <Partners />
    </section>
  );
}

// Accordion 3 points — exactement comme les sections des pages formation.
// Click sur le titre = ouvre/ferme le bloc. Fermé = ligne tight ; ouvert = gros titre + body.
// Les titres et corps des 3 piliers viennent du BO (section "approche" →
// pilier1_title / pilier1_body / ...). Fallback : les textes historiques.
function ApprocheAccordion() {
  const [open, setOpen] = useState(null);
  const points = [
    {
      id: "storytelling",
      title: text("approche.pilier1_title", "Le storytelling au centre"),
      intro: text(
        "approche.pilier1_body",
        "Le récit comme boussole. Stratégie, direction artistique, structure — tout en découle. Avant les outils, avant les formats, avant les plateformes, il y a l'histoire que tu portes et la façon dont les autres se la racontent."
      ),
    },
    {
      id: "professionnels",
      title: text("approche.pilier2_title", "Par des professionnels en activité"),
      intro: text(
        "approche.pilier2_body",
        "Universal, Sony, Accor Arena, Zéniths. Tes formateurs livrent maintenant — pas en 2015. La méthode arrive du terrain et y retourne. Pas de théorie hors-sol : ce qu'on enseigne, on le pratique encore."
      ),
    },
    {
      id: "pratiques",
      title: text("approche.pilier3_title", "Formations pratiques"),
      intro: text(
        "approche.pilier3_body",
        "Pédagogie par le faire — tes propres récits comme matière. Tu repars avec un livrable concret, pas un certificat. Plateforme de marque, plan éditorial, vidéo finie, calendrier — utilisable dès le lundi matin."
      ),
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
        {text("financement.title", "Comment s'inscrire et quel financement ?")}
      </h2>
      <div className="lg__financement__cols">
        <div className="lg__financement__col">
          <p>{text("financement.col1_intro", "Pour toute question et inscription, écris-nous par mail :")}</p>
          <p>
            <a
              className="lg__financement__email"
              href={"mailto:" + text("financement.col1_email", "formations@lesgriots.com")}
            >
              {text("financement.col1_email", "formations@lesgriots.com")}
            </a>
          </p>
          <p>{text("financement.col1_response", "Nous répondons systématiquement sous deux jours ouvrés.")}</p>
          <p>{text(
            "financement.col1_eligibility",
            "Que tu sois inscrit·e à la MDA / Agessa, auto-entrepreneur·euse, entreprise individuelle ou dirigeant·e non salarié·e de SASU/EURL, tu cotises déjà pour ta formation professionnelle continue et tu disposes de possibilités de financement."
          )}</p>
        </div>
        <div className="lg__financement__col">
          <p>{text(
            "financement.col2_intro",
            "Nous t'accompagnons et simplifions tes démarches administratives auprès des organismes de référence — OPCO (salariés), FAF / FIF-PL / AGEFICE / AFDAS (indépendants selon ton statut). EDOF en cours, CPF à venir."
          )}</p>
          <p>{renderManifestoBrand(text(
            "financement.col2_qualiopi",
            "LA GRIOTHÈQUE est le pilier formation de la SASU LES GRIOTS, certifié Qualiopi (Actions de formation), Lauréat French Tech, et déclaré sous le numéro NDA 28760747176 auprès de la DREETS Normandie — spécialité techniques de l'image et du son, métiers connexes du spectacle."
          ))}</p>
          <p>{text(
            "financement.col2_accessibility",
            "Pour toute question d'accessibilité ou d'adaptation, merci de nous contacter par mail en amont de l'inscription."
          )}</p>
        </div>
      </div>
    </section>
  );
}

function Contact() {
  // Tout est éditable depuis le BO (section "contact"). On ré-applique le
  // span .lg-brand sur la 1re ligne via renderManifestoBrand pour garder le
  // style typographique du nom de marque.
  const email = text("contact.email", "formations@lesgriots.com");
  return (
    <section className="lg__contact" id="contact">
      <div className="lg__contact__info">
        <p>{renderManifestoBrand(text("contact.line1", "LA GRIOTHÈQUE"))}</p>
        <p>{text("contact.line2", "Organisme de formation")}</p>
        <p>{text("contact.line3", "de la SASU LES GRIOTS")}</p>
        <p>{text("contact.line4", "Certifié Qualiopi")}</p>
        <p>&nbsp;</p>
        <p>{text("contact.location_main", "Présentiel à Paris")}</p>
        <p>{text("contact.location_hq", "Siège social — Le Havre")}</p>
        <p>&nbsp;</p>
        <p><a href={"mailto:" + email}>{email}</a></p>
        <p>&nbsp;</p>
        <p>
          <a href={text("contact.instagram_url", "https://instagram.com/lagriotheque")} target="_blank" rel="noopener">
            {text("contact.instagram_label", "instagram")}
          </a>
        </p>
        <p>
          <a href={text("contact.linkedin_url", "https://linkedin.com")} target="_blank" rel="noopener">
            {text("contact.linkedin_label", "linkedin")}
          </a>
        </p>
        <p>
          <a href={text("contact.studio_url", "https://lesgriotsxstudio.com")} target="_blank" rel="noopener">
            {text("contact.studio_label", "lesgriotsxstudio.com")}
          </a>
        </p>
      </div>
      <div className="lg__contact__griot" aria-hidden="true">
        <GriotRing />
      </div>
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
            href="#"
            target="_blank"
            rel="noopener"
            aria-label="Les Révélations — L'image de demain"
          >
            <img src="img/les-revelations.svg" alt="Les Révélations — L'image de demain" />
          </a>
          <a
            className="lg__partners__logo lg__partners__logo--img"
            href="https://lesdetermines.fr"
            target="_blank"
            rel="noopener"
            aria-label="Les Déterminés"
          >
            <img src="img/les-determines.svg" alt="Les Déterminés" />
          </a>
        </div>
      </div>
    </section>
  );
}

function App() {
  // Splash affiché uniquement à la première arrivée dans la session du navigateur.
  // Au refresh ou navigation interne, sessionStorage retient qu'on l'a déjà vu.
  const [entered, setEntered] = useState(() => {
    try {
      return sessionStorage.getItem("lg:splashSeen") === "1";
    } catch (e) {
      return false;
    }
  });
  const markEntered = () => {
    setEntered(true);
    try { sessionStorage.setItem("lg:splashSeen", "1"); } catch (e) {}
  };
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
    const enter = () => markEntered();
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
    return <Splash onEnter={() => markEntered()} />;
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
    : route.startsWith("ressources/") ? "ressources"
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
  } else if (route.startsWith("checkout/")) {
    // Page de checkout démo (simulation Stripe) — pour tester l'expérience
    // d'achat sans configurer un vrai compte Stripe.
    const id = route.slice("checkout/".length);
    const item =
      (typeof WORKSHOPS !== "undefined" && WORKSHOPS.find((x) => x.id === id)) ||
      (typeof FORMATIONS !== "undefined" && FORMATIONS.find((x) => x.id === id));
    // Stripe Elements (custom checkout sur le site). Si la config est absente,
    // on retombe sur la page démo.
    const hasStripe = typeof window !== "undefined" && window.SITE_CONFIG
      && window.SITE_CONFIG.stripePublishableKey
      && window.SITE_CONFIG.stripeCheckoutEndpoint;
    page = item
      ? (hasStripe ? <CheckoutStripe item={item} /> : <CheckoutDemo item={item} />)
      : <Catalogue />;
  } else if (route.startsWith("ressources/")) {
    const id = route.slice("ressources/".length);
    const r = RESOURCES.find((x) => x.id === id);
    page = r ? <ResourcePage r={r} /> : <Ressources />;
  } else {
    switch (route) {
      case "catalogue":   page = <Catalogue />; break;
      case "workshops":   page = <Workshops />; break;
      case "agenda":      page = <Agenda />; break;
      case "ressources":  page = <Ressources />; break;
      case "approche":    page = <Approche />; break;
      case "contact":     page = <Contact />; break;
      case "cgv":             page = <CGV />; break;
      case "mentions-legales":page = <MentionsLegales />; break;
      case "confidentialite": page = <Confidentialite />; break;
      case "financement":     page = <Financement />; break;
      default:                page = <Manifesto />;
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
              <a href="https://lesgriotsxstudio.com" target="_blank" rel="noopener">{text("footer.col2_studio_label", "les griots studio")}</a>
              <a href="https://lesgriotsxstudio.com" target="_blank" rel="noopener">{text("footer.col2_plateforme_label", "plateforme éditoriale")}</a>
              <a href="https://lesgriotsxstudio.com" target="_blank" rel="noopener">{text("footer.col2_agence_label", "agence créative")}</a>
            </div>
            <div className="lg__footer__col">
              <a href="https://instagram.com/lagriotheque" target="_blank" rel="noopener">instagram</a>
              <a href="https://linkedin.com" target="_blank" rel="noopener">linkedin</a>
              <a href="mailto:formations@lesgriots.com?subject=Newsletter">newsletter</a>
            </div>
            <div className="lg__footer__col">
              {/* Les infos société (SIREN, RCS, NDA, DREETS, etc.) sont
                  centralisées sur la page Mentions légales pour ne pas alourdir
                  le footer — accessibles en un clic via le lien ci-dessous. */}
              <a href="#/mentions-legales">mentions légales</a>
              <a href="#/confidentialite">politique de confidentialité</a>
              <a href="#/cgv">conditions générales de vente</a>
              <div className="lg__qualiopi" aria-label="Certifié Qualiopi">
                <img
                  className="lg__qualiopi__logo"
                  src="img/qualiopi.png"
                  alt="Qualiopi — processus certifié"
                />
                <em className="lg__qualiopi__text">
                  {text("footer.qualiopi_caption", "La certification qualité a été délivrée au titre de la catégorie d'action : Actions de formation")}
                </em>
              </div>
            </div>
          </div>

          {/* Marquee : on duplique le texte 4× pour que le défilement
              CSS soit fluide sans saut, peu importe la longueur du texte
              saisi côté BO. */}
          <div className="lg__footer__marquee" aria-hidden="true">
            <div className="lg__footer__marquee__track">
              {Array.from({ length: 4 }).map((_, i) => (
                <span key={i}>
                  {text("footer.marquee", "TRANSMETTRE — ET PERMETTRE À UNE NOUVELLE GÉNÉRATION DE BÂTIR SES RÉCITS ET CRÉER DES IMAGINAIRES")}
                  &nbsp;·&nbsp;
                </span>
              ))}
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
