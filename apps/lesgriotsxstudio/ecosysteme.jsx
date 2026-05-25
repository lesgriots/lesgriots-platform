/* global React, MatrixGriot, useLang, Type */
// Ecosystem — minimalist solar system in 3D space:
//   the Griot is the sun, planets orbit, and the viewer navigates with
//   - mouse wheel  → zoom in/out (Z axis)
//   - shift+wheel  → pan up/down (Y axis)
//   - click+drag in the void → pan freely (X/Y) with momentum on release.
//   Inertia is implemented via requestAnimationFrame so the motion
//   feels like a joystick: continuous while you're inputting, drifts
//   to a stop after.

const { useState: useStateE, useEffect: useEffectE, useRef: useRefE } = React;

function EcoView() {
  const lang = useLang();

  // Each site is a "planet": elliptical orbit with rx/ry radii (in vmin),
  // starting angle, period, dot size, and a poster/video preview shown
  // in the bg on hover. When `videoSrc` is set, a <video> autoplays.
  const sites = [
    {
      id: "lesgriots",
      name: "LES GRIOTS",
      kicker: lang === "fr" ? "PLATEFORME ÉDITORIALE" : "EDITORIAL PLATFORM",
      url: "https://lesgriots.com",
      rx: 24, ry: 16,         // squashed ellipse
      startAngle: 200,
      period: 60,
      size: 14,
      poster: "img/p-monument.jpg",
      preview: "img/preview-lesgriots.png",  // screenshot homepage
      // Placeholder : à remplacer par un screencast du vrai site lesgriots.com.
      // Peut être un chemin local (img/xxx.mp4) ou un URL externe (Bunny, R2…).
      videoSrc: "img/indigo-cristal-thumb.mp4",
      description: lang === "fr"
        ? "Plateforme éditoriale dédiée aux récits inattendus de l'Afrique et de ses diasporas. Une parole ancienne, une voix nouvelle."
        : "Editorial platform devoted to the untold stories of Africa and its diasporas. An ancient voice, a new century.",
    },
    {
      id: "lesgriotsxstudio",
      name: "LESGRIOTSxSTUDIO",
      kicker: lang === "fr" ? "AGENCE CRÉATIVE" : "CREATIVE STUDIO",
      url: "https://lesgriotsxstudio.com",
      current: true,
      rx: 36, ry: 26,
      startAngle: 40,
      period: 90,
      size: 18,
      poster: "img/atavisme-01.jpg",
      preview: "img/atavisme-01.jpg",  // TODO: vrai screenshot homepage
      // Placeholder : à remplacer par un screencast du site studio.
      videoSrc: "img/nike-thumb.mp4",
      description: lang === "fr"
        ? "Studio créatif : stratégie narrative, direction artistique et production audiovisuelle pour artistes, marques et institutions."
        : "Creative studio: narrative strategy, art direction and audiovisual production for artists, brands and institutions.",
    },
    {
      id: "lagriotheque",
      name: "LA GRIOTHÈQUE",
      kicker: lang === "fr" ? "PILIER FORMATION" : "TRAINING PILLAR",
      url: "https://lagriotheque.com",
      rx: 50, ry: 38,
      startAngle: 290,
      period: 130,
      size: 12,
      poster: "img/florale-01.jpg",
      preview: "img/florale-01.jpg",  // TODO: vrai screenshot homepage
      // Placeholder : à remplacer par un screencast du site Griothèque.
      videoSrc: "img/indigo-cristal-thumb.mp4",
      description: lang === "fr"
        ? "École de transmission pour la nouvelle génération créative. Formations courtes, méthodes éprouvées sur le terrain, certifiée Qualiopi."
        : "School of transmission for the next creative generation. Short formats, methods proven in the field, Qualiopi-certified.",
    },
  ];

  const [hovered, setHovered] = useStateE(null);
  const [pointer, setPointer] = useStateE({ x: 0, y: 0 });
  const active = hovered != null ? sites[hovered] : null;
  const planeRef = useRefE(null);

  // Track mouse position to position the terminal next to the cursor.
  useEffectE(() => {
    const onMove = (e) => setPointer({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // 3D navigation — drive the plane via direct DOM transforms in a rAF
  // loop, so the motion feels like a joystick (velocity-based, with
  // momentum and damping) and we don't re-render React 60×/s.
  useEffectE(() => {
    const root = document.querySelector(".eco-solar");
    const plane = planeRef.current;
    if (!root || !plane) return;

    const pos = { x: 0, y: 0, z: 0 };
    const vel = { x: 0, y: 0, z: 0 };
    const drag = { active: false, lastX: 0, lastY: 0 };

    // Clamp position so the system never disappears
    const CLAMP = { xy: 600, zMin: -800, zMax: 600 };

    const apply = () => {
      const x = Math.max(-CLAMP.xy, Math.min(CLAMP.xy, pos.x));
      const y = Math.max(-CLAMP.xy, Math.min(CLAMP.xy, pos.y));
      const z = Math.max(CLAMP.zMin, Math.min(CLAMP.zMax, pos.z));
      // Slight tilt proportional to current motion for a subtle "lean"
      const tiltX = Math.max(-12, Math.min(12, -vel.y * 0.4));
      const tiltY = Math.max(-12, Math.min(12,  vel.x * 0.4));
      plane.style.transform =
        `translate3d(${x}px, ${y}px, ${z}px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
    };
    apply();

    let raf;
    const tick = () => {
      const DAMP = 0.9;
      pos.x += vel.x;
      pos.y += vel.y;
      pos.z += vel.z;
      vel.x *= DAMP;
      vel.y *= DAMP;
      vel.z *= DAMP;
      if (Math.abs(vel.x) < 0.05) vel.x = 0;
      if (Math.abs(vel.y) < 0.05) vel.y = 0;
      if (Math.abs(vel.z) < 0.05) vel.z = 0;
      apply();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Wheel:
    //  - plain wheel  → Z (zoom in/out)
    //  - shift+wheel  → Y (pan vertical)
    //  - trackpad deltaX → X (pan horizontal)
    const onWheel = (e) => {
      e.preventDefault();
      if (e.shiftKey) {
        vel.y -= e.deltaY * 0.4;
      } else {
        vel.z -= e.deltaY * 0.5;
      }
      if (e.deltaX) vel.x -= e.deltaX * 0.4;
    };

    // Drag in the void → joystick pan
    const onDown = (e) => {
      if (e.target.closest(".eco-solar__planet")) return;
      drag.active = true;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      root.classList.add("is-dragging");
    };
    const onMove = (e) => {
      if (!drag.active) return;
      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      // Inject the drag delta as velocity — momentum carries on after release
      vel.x = vel.x * 0.4 + dx * 0.6;
      vel.y = vel.y * 0.4 + dy * 0.6;
    };
    const onUp = () => {
      drag.active = false;
      root.classList.remove("is-dragging");
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mouseleave", onUp);

    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mouseleave", onUp);
    };
  }, []);

  const open = (s) => {
    if (s.current) return;
    window.open(s.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="eco-solar">
      {/* ============================================================
          MOBILE — 3 sections empilées, une par univers. Cachée en desktop
          via CSS. Le tap pour ouvrir le site marche tout de suite, pas
          besoin de hover (qui n'existe pas en touch).
          ============================================================ */}
      <div className="eco-mobile" aria-label="Ecosystem on mobile">
        {/* Intro : griot ASCII + texte d'accroche */}
        <div className="eco-mobile__hero">
          <div className="eco-mobile__hero__griot" aria-hidden="true">
            <MatrixGriot />
          </div>
          <p className="eco-mobile__hero__lead">
            {lang === "fr"
              ? "Trois univers, une même galaxie. Cliquez sur une planète pour entrer."
              : "Three universes, one same galaxy. Tap a planet to enter."}
          </p>
        </div>

        {/* Liste compacte style YARD/INITIATIVES — thumbnail 16/9 à gauche
            + titre/kicker à droite avec typewriter en cascade (style About).
            Tap n'importe où dans la ligne ouvre le site. */}
        <ul className="eco-mobile__list">
          {sites.map((s, i) => {
            // Délais de cascade : chaque ligne démarre après la précédente.
            // Au sein d'une ligne, le kicker attend que le nom soit tapé.
            const NAME_SPEED = 30;
            const KICKER_SPEED = 22;
            const ROW_GAP = 200;
            // Délai du nom de cette ligne = somme des durées des lignes précédentes
            const prevRowsDuration = sites.slice(0, i).reduce((acc, p) => {
              return acc + p.name.length * NAME_SPEED + p.kicker.length * KICKER_SPEED + ROW_GAP;
            }, 0);
            const nameDelay = 200 + prevRowsDuration;
            const kickerDelay = nameDelay + s.name.length * NAME_SPEED + 80;
            const hereDelay = kickerDelay + s.kicker.length * KICKER_SPEED + 100;
            const isLastRow = i === sites.length - 1;
            return (
            <li
              key={"m-" + s.id}
              className={"eco-mobile__row" + (s.current ? " is-current" : "")}
              onClick={() => open(s)}
            >
              <div className="eco-mobile__row__thumb" aria-hidden="true">
                {s.videoSrc ? (
                  <video src={s.videoSrc} poster={s.poster} autoPlay muted loop playsInline />
                ) : (
                  <img src={s.preview || s.poster} alt="" loading="lazy" />
                )}
              </div>
              <div className="eco-mobile__row__text">
                <h2 className="eco-mobile__row__name">
                  <Type
                    text={s.name}
                    speed={NAME_SPEED}
                    delay={nameDelay}
                    cursor={isLastRow && !s.current ? "always" : "while"}
                    key={"em-n-" + s.id + "-" + lang}
                  />
                </h2>
                <p className="eco-mobile__row__kicker">
                  <Type
                    text={s.kicker}
                    speed={KICKER_SPEED}
                    delay={kickerDelay}
                    cursor={isLastRow && !s.current ? "always" : "while"}
                    key={"em-k-" + s.id + "-" + lang}
                  />
                </p>
                {s.current && (
                  <p className="eco-mobile__row__here">
                    <Type
                      text={lang === "fr" ? "VOUS ÊTES ICI" : "YOU ARE HERE"}
                      speed={KICKER_SPEED}
                      delay={hereDelay}
                      cursor="always"
                      key={"em-h-" + s.id + "-" + lang}
                    />
                  </p>
                )}
              </div>
            </li>
            );
          })}
        </ul>
      </div>

      {/* ============================================================
          DESKTOP — vue solaire interactive (vue d'origine). Cachée en
          mobile via CSS.
          ============================================================ */}
      {/* Background preview of the hovered planet — video if available,
          otherwise the poster image. Fades in/out. */}
      <div className={"eco-solar__bg" + (active ? " is-active" : "")} aria-hidden="true">
        {active && (active.videoSrc ? (
          <video
            key={active.id}
            src={active.videoSrc}
            poster={active.poster}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <div
            className="eco-solar__bg__img"
            style={{ backgroundImage: `url(${active.poster})` }}
          />
        ))}
        <div className="eco-solar__bg__veil"></div>
      </div>

      {/* The whole plane (sun + orbits + planets) — its transform is
          driven by the rAF loop above, written directly to the DOM. */}
      <div ref={planeRef} className="eco-solar__plane">
        {/* Sun = the central griot */}
        <div className="eco-solar__sun" aria-hidden="true">
          <MatrixGriot />
        </div>

        {/* Orbits — elliptical, with rx/ry per site */}
        {sites.map((s) => (
          <div
            key={"o-" + s.id}
            className="eco-solar__orbit"
            style={{
              width: s.rx * 2 + "vmin",
              height: s.ry * 2 + "vmin",
            }}
          />
        ))}

        {/* Planet anchors — translate-only animation around the ellipse,
            so the planet itself stays upright and round (no rotation/scale). */}
        {sites.map((s, i) => (
          <div
            key={"p-" + s.id}
            className="eco-solar__anchor"
            style={{
              "--rx": s.rx + "vmin",
              "--ry": s.ry + "vmin",
              animationDuration: s.period + "s",
              animationDelay: `${-s.startAngle / 360 * s.period}s`,
            }}
          >
            <button
              className={
                "eco-solar__planet" +
                (s.current ? " is-current" : "") +
                (hovered === i ? " is-hover" : "")
              }
              style={{
                /* Shift the button up by half the dot's height so the
                   dot's centre lies exactly on the orbit line. */
                transform: `translate(-50%, ${-s.size / 2}px)`,
              }}
              onClick={() => open(s)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
              aria-label={s.name}
            >
              <span
                className="eco-solar__planet__dot"
                style={{ width: s.size + "px", height: s.size + "px" }}
              />
              <span className="eco-solar__planet__label">{s.name}</span>
            </button>
          </div>
        ))}
      </div>

      {/* Fenêtre terminal au hover — bar mac-style + screenshot site + bio typewriter
          Position : suit le curseur, avec clamp pour rester dans le viewport */}
      {active && (() => {
        const W = 360;          // term width
        const H = 420;          // approx term height (shot 16:10 + texte + padding)
        const GAP = 18;         // gap from cursor
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        // Default : à droite + en bas du curseur, flip si pas la place
        let left = pointer.x + GAP;
        let top = pointer.y + GAP;
        if (left + W + 12 > vw) left = pointer.x - W - GAP;
        if (top + H + 12 > vh) top = Math.max(12, vh - H - 12);
        if (left < 12) left = 12;
        if (top < 12) top = 12;
        return (
        <div className="eco-solar__overlay" key={active.id} style={{ left, top }}>
          {/* Fenêtre terminal : exactement comme celle du menu (1 dot jaune) */}
          <div className="eco-solar__term">
            <div className="eco-solar__term__bar">
              <span className="eco-solar__term__dots" aria-hidden="true">
                <span className="d d--y"></span>
              </span>
              <span className="eco-solar__term__title">
                ~ {active.id}.sh
              </span>
              <span className="eco-solar__term__x">×</span>
            </div>
            <div className="eco-solar__term__shot" aria-hidden="true">
              <img src={active.preview || active.poster} alt="" />
            </div>
          </div>
          {/* Texte EXTÉRIEUR au terminal — sous la fenêtre */}
          <div className="eco-solar__info">
            <p className="eco-solar__info__kicker">[{active.kicker}]</p>
            <p className="eco-solar__info__desc">
              <Type
                text={active.description.toUpperCase()}
                speed={12}
                delay={0}
                cursor="always"
                key={"eco-desc-" + active.id}
              />
            </p>
            <p className="eco-solar__info__cta">
              {active.current
                ? "› " + (lang === "fr" ? "VOUS ÊTES ICI" : "YOU ARE HERE")
                : "› " + (lang === "fr" ? "OUVRIR" : "OPEN") + " " + active.url.replace(/^https?:\/\//, "")}
            </p>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

window.EcoView = EcoView;
