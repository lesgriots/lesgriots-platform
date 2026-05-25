/* global React, PROJECTS, useLang, tr, HomeIndex, MatrixGriot */
// Home — Acre-style scattered B&W thumbnail grid + optional INDEX (list) mode

const { useState: useStateH, useEffect: useEffectH, useMemo: useMemoH } = React;

// Deterministic pseudo-random so the layout stays the same across renders.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build a scattered cell list — supports two density modes.
// Derive a cell's aspect from a project's first resource. Returns either
// a CSS aspect-ratio string ("16 / 9") or null if the project has no info.
function aspectFromFirstResource(proj) {
  const first = proj && proj.resources && proj.resources[0];
  if (first && typeof first.aspect === "string" && first.aspect.includes("/")) {
    return first.aspect;
  }
  return null;
}

function useScatter(mode) {
  return useMemoH(() => {
    const rng = mulberry32(11);
    const isLarge = mode === "large";
    const COLS = isLarge ? 3 : 5;
    const cells = [];
    PROJECTS.forEach((proj, i) => {
      const r = Math.floor(i / COLS);
      const c = i % COLS;
      const sBucket = rng();
      let sizeClass;
      if (isLarge) {
        sizeClass = sBucket < 0.3 ? "md" : "lg";
      } else {
        if (sBucket < 0.20)      sizeClass = "sm";
        else if (sBucket < 0.80) sizeClass = "md";
        else                     sizeClass = "lg";
      }
      // Aspect derived from the first resource of the project if available.
      // Falls back to a deterministic random for legacy projects.
      const explicitAspect = aspectFromFirstResource(proj);
      let aspect;          // legacy class "portrait" | "landscape"
      let aspectStyle;     // inline aspect-ratio if explicit
      if (explicitAspect) {
        aspectStyle = explicitAspect;
        const parts = explicitAspect.split("/").map((p) => parseFloat(p));
        const ratio = parts[0] / parts[1];
        aspect = ratio < 1 ? "portrait" : "landscape";
      } else {
        aspect = rng() < (isLarge ? 0.55 : 0.6) ? "portrait" : "landscape";
        aspectStyle = null;
      }
      const isVideo = (proj.resources || []).some((r) => r.type === "video");
      const jitter = isLarge ? 30 : 18;
      const dx = Math.round((rng() - 0.5) * jitter);
      const dy = Math.round((rng() - 0.5) * jitter);
      cells.push({
        key: `${proj.id}-${i}`,
        r, c, sizeClass, aspect, aspectStyle, isVideo,
        dx, dy,
        proj,
      });
    });
    return cells;
  }, [mode]);
}

function HomeView({ onOpenProject, onNavigate }) {
  const lang = useLang();
  const [time, setTime] = useStateH("");
  const [videoHover, setVideoHover] = useStateH(null);
  const [indexHover, setIndexHover] = useStateH(null);
  const [hoveredKey, setHoveredKey] = useStateH(null);
  const [mode, setMode] = useStateH("compact"); // "compact" | "large" | "index"
  // Map projectId → "W/H" string. Rempli au load du cover (image ou vidéo).
  // Permet à chaque cellule de prendre le ratio natif de son média plutôt
  // qu'un ratio aléatoire ou forcé.
  const [realAspects, setRealAspects] = useStateH({});
  function recordAspect(projId, w, h) {
    if (!w || !h) return;
    setRealAspects((m) => (m[projId] ? m : { ...m, [projId]: `${w} / ${h}` }));
  }
  // Only compute scatter cells for grid modes (skip in INDEX mode)
  const cells = useScatter(mode === "large" ? "large" : "compact");
  const isIndex = mode === "index";

  useEffectH(() => {
    const tick = () => {
      const d = new Date();
      setTime(d.toLocaleTimeString("fr-FR", {
        hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Paris",
      }));
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  // Lock mode to "compact" on mobile (only THUMB exists there)
  useEffectH(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 760px)");
    const enforce = () => { if (mq.matches) setMode("compact"); };
    enforce();
    mq.addEventListener && mq.addEventListener("change", enforce);
    return () => mq.removeEventListener && mq.removeEventListener("change", enforce);
  }, []);

  return (
    <div className={"ahome ahome--" + mode}>
      {/* ASCII griot fade in the bottom-right corner — visible on S/L/I */}
      <div className="ahome__griot" aria-hidden="true">
        <MatrixGriot />
      </div>
      {/* Top corners */}
      <div className="ahome__top">
        <div className="ahome__brand">a.cre<sup>®</sup></div>
      </div>

      {/* Size toggle — bottom-left, terminal style.
          On mobile we only expose THUMB (FRAME and DATA are desktop-only). */}
      <div className="ahome__size">
        <button
          className={mode === "compact" ? "is-active" : ""}
          onClick={() => setMode("compact")}>THUMB</button>
        <span className="sep ahome__size--desktop">/</span>
        <button
          className={"ahome__size--desktop " + (mode === "large" ? "is-active" : "")}
          onClick={() => setMode("large")}>FRAME</button>
        <span className="sep ahome__size--desktop">/</span>
        <button
          className={"ahome__size--desktop " + (mode === "index" ? "is-active" : "")}
          onClick={() => setMode("index")}
          title="Data view">DATA</button>
      </div>

      {isIndex ? (
        <HomeIndex onOpenProject={onOpenProject} onHover={(i) => setIndexHover(i)} />
      ) : (
        /* Scattered grid */
        <div
          className={"ahome__grid" + (hoveredKey ? " has-hover" : "")}
          onMouseLeave={() => { setVideoHover(null); setHoveredKey(null); }}
        >
          {cells.map((cell) => {
            // If the project has a `thumbVideo` (a tiny pre-rendered ~5s teaser),
            // use it as the cell preview. Otherwise fall back to the full
            // first resource if it's a real video file.
            const first = cell.proj.resources && cell.proj.resources[0];
            const firstIsRealVideo = first
              && first.type === "video"
              && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(first.src || "");
            const cellVideo = cell.proj.thumbVideo
              || (firstIsRealVideo ? first.src : null);
            return (
            <button
              key={cell.key}
              className={
                "ahome__cell" +
                ` ahome__cell--${cell.sizeClass}` +
                ` ahome__cell--${cell.aspect}` +
                (cellVideo ? " ahome__cell--video" : "") +
                (hoveredKey === cell.key ? " is-hovered" : "")
              }
              style={{
                gridColumn: cell.c + 1,
                gridRow: cell.r + 1,
                // Jitter exposé en CSS vars — le transform final est composé
                // dans styles.css (translate + rotation par nth-child sur
                // mobile pour le côté "destructuré" sans casser le drag JS).
                "--jx": `${cell.dx}px`,
                "--jy": `${cell.dy}px`,
                transform: `translate(var(--jx), var(--jy))`,
                // Priorité au ratio réel détecté au load > ratio annoncé
                // sur la première resource > rien (laisse la classe CSS).
                aspectRatio: realAspects[cell.proj.id] || cell.aspectStyle || undefined,
              }}
              onClick={() => onOpenProject(cell.proj.id)}
              onMouseEnter={() => {
                setHoveredKey(cell.key);
                if (cell.isVideo || cellVideo) setVideoHover(cell);
              }}
              onMouseLeave={() => {
                setHoveredKey((k) => (k === cell.key ? null : k));
                if (cell.isVideo || cellVideo) setVideoHover((v) => (v && v.key === cell.key ? null : v));
              }}
              aria-label={cell.proj.name}
            >
              {hoveredKey === cell.key && (
                <span className="ahome__cell__label" aria-hidden="true">
                  <Type
                    text={cell.proj.name}
                    speed={26}
                    cursor="while"
                    key={"n-" + cell.key}
                  />
                  <span className="ahome__cell__label__client">
                    <Type
                      text={cell.proj.client || "—"}
                      speed={26}
                      delay={cell.proj.name.length * 26 + 150}
                      cursor="while"
                      key={"c-" + cell.key}
                    />
                  </span>
                  <span className="ahome__cell__label__role">
                    <Type
                      text={
                        (Array.isArray(cell.proj.role)
                          ? cell.proj.role.join(" / ")
                          : cell.proj.role)
                        || (cell.proj.tags || []).slice(0, 2).join(" / ")
                        || "—"
                      }
                      speed={26}
                      delay={cell.proj.name.length * 26 + (cell.proj.client || "—").length * 26 + 300}
                      cursor="always"
                      key={"r-" + cell.key}
                    />
                  </span>
                </span>
              )}
              {cellVideo ? (
                <video
                  src={cellVideo}
                  poster={cell.proj.cover}
                  autoPlay
                  muted
                  loop
                  playsInline
                  /* Safety fallback in case the source is the full video
                     rather than a pre-rendered thumb: cap at 5s. */
                  onTimeUpdate={(e) => {
                    if (!cell.proj.thumbVideo && e.currentTarget.currentTime >= 5) {
                      e.currentTarget.currentTime = 0;
                    }
                  }}
                  /* Aspect-ratio dynamique : on lit la dimension native
                     une fois la métadata vidéo chargée. */
                  onLoadedMetadata={(e) => recordAspect(cell.proj.id, e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
                />
              ) : (
                <img
                  src={cell.proj.cover}
                  alt=""
                  loading="lazy"
                  onLoad={(e) => recordAspect(cell.proj.id, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
                />
              )}
              {/* icône caméra retirée — gâchait l'esthétique des cellules */}
            </button>
            );
          })}
        </div>
      )}

      {/* Fullscreen preview backdrop — shown when hovering any cell in S/L
          modes (or any row in DATA mode). Uses the project's thumbVideo or
          first real video resource if present; falls back to the cover image. */}
      {(() => {
        let bgProj = null;
        if (isIndex) {
          bgProj = indexHover != null ? PROJECTS[indexHover] : null;
        } else if (hoveredKey) {
          const hc = cells.find((c) => c.key === hoveredKey);
          bgProj = hc ? hc.proj : null;
        }
        if (!bgProj) {
          return (
            <div className="ahome__bg" aria-hidden="true">
              <div className="ahome__bg__grain"></div>
              <div className="ahome__bg__veil"></div>
            </div>
          );
        }
        const first = bgProj.resources && bgProj.resources[0];
        const videoSrc = bgProj.thumbVideo
          || (first && first.type === "video"
              && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(first.src || "")
              ? first.src : null);
        return (
          <div className="ahome__bg is-active" aria-hidden="true"
               style={!videoSrc ? { backgroundImage: `url(${bgProj.cover})` } : {}}>
            {videoSrc && (
              <video
                key={bgProj.id}
                className="ahome__bg__video"
                src={videoSrc}
                poster={bgProj.cover}
                autoPlay
                muted
                loop
                playsInline
              />
            )}
            <div className="ahome__bg__grain"></div>
            <div className="ahome__bg__veil"></div>
          </div>
        );
      })()}
    </div>
  );
}

window.HomeView = HomeView;

/* ============================================================
   HomeMobile — 3-col staggered grid (rendered on mobile)
   ============================================================ */

// Compact "services" line derived from a project's tags
function hmServices(p) {
  const t = (p.tags || []).map((x) => x.toUpperCase());
  const out = [];
  if (t.includes("CAMPAIGN") || t.includes("LOOKBOOK")) out.push("CAMPAIGN");
  if (t.includes("EDITORIAL") || t.includes("PHOTOGRAPHY")) out.push("EDITORIAL");
  if (t.includes("MUSIC VIDEO")) out.push("MUSIC VIDEO");
  if (t.includes("FILM") || t.includes("SHORT FILM") || t.includes("DOCUMENTARY")) out.push("FILM");
  if (t.includes("STAGE")) out.push("STAGE");
  if (t.includes("MOVEMENT")) out.push("MOVEMENT");
  return out.length ? out.join(", ") : (p.role || "—");
}

function HomeMobile({ onOpenProject }) {
  // Insert a brand mark "lesgriots®" between projects every BRAND_EVERY items.
  const BRAND_EVERY = 5;

  return (
    <div className="hm">
      {PROJECTS.map((p, i) => {
        const isFirstRealVideo =
          p.resources && p.resources[0]
          && p.resources[0].type === "video"
          && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(p.resources[0].src || "");
        const insertBrand = i > 0 && i % BRAND_EVERY === 0;
        return (
          <React.Fragment key={p.id}>
            {insertBrand && (
              <div className="hm__brand" aria-hidden="true">lesgriots<sup>®</sup></div>
            )}
            <button
              className="hm__card"
              onClick={() => onOpenProject(p.id)}
              aria-label={p.name}>
              {isFirstRealVideo ? (
                <video
                  src={p.resources[0].src}
                  poster={p.cover}
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <img src={p.cover} alt={p.name} loading="lazy" />
              )}
              {/* icône caméra retirée — gâchait l'esthétique des cellules */}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

window.HomeMobile = HomeMobile;
