/* global React, PROJECTS, useLang, tr */
// Project Viewer — image/video stage in centre + right-side rail
// + InfoOverlay panel that slides up over a black backdrop.

const { useState: useStateV, useEffect: useEffectV, useRef: useRefV } = React;

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
}

function ViewerView({ projectId, onClose }) {
  const project = PROJECTS.find((p) => p.id === projectId) || PROJECTS[0];
  const lang = useLang();
  const [resIdx, setResIdx] = useStateV(0);
  const [showInfo, setShowInfo] = useStateV(false);
  const [playing, setPlaying] = useStateV(false);
  const [progress, setProgress] = useStateV(0);
  const [fullscreen, setFullscreen] = useStateV(false);
  // Mute is global across the viewer session — keep the user choice
  // when they pick a different video resource.
  const [muted, setMuted] = useStateV(true);
  const stageKey = useRefV(0);
  const viewerRef = useRefV(null);
  const videoRef = useRefV(null);
  const imgRef = useRefV(null);
  // Largeur réelle du média (vidéo ou image), mesurée à chaque resize/load
  // pour caler la barre de lecture vidéo en dessous à la même largeur.
  const [mediaWidth, setMediaWidth] = useStateV(null);
  React.useEffect(() => {
    const el = videoRef.current || imgRef.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setMediaWidth(Math.round(w));
    };
    update();
    const t = setTimeout(update, 200); // re-mesure après le load
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [resIdx, projectId]);

  // Real browser fullscreen — uses the Fullscreen API on the viewer element.
  // Keeps the React `fullscreen` state in sync with `document.fullscreenElement`
  // so the layout class (.viewer--video) follows the actual fullscreen status.
  const toggleFullscreen = React.useCallback(() => {
    const el = viewerRef.current;
    if (!el) return;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fsEl) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (req) {
        try { req.call(el); } catch (e) {}
      } else {
        // Fallback for browsers without API support — toggle the CSS-only mode
        setFullscreen((f) => !f);
      }
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (exit) {
        try { exit.call(document); } catch (e) {}
      } else {
        setFullscreen(false);
      }
    }
  }, []);

  useEffectV(() => {
    const onChange = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      setFullscreen(!!fsEl);
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const resources = project.resources.slice(0, 10);
  const active = resources[resIdx];

  // Detect if active.src points to a real video file (mp4/mov/webm) —
  // these get rendered as a <video> with controls wired to the element.
  // Otherwise we fall back to the legacy simulated playback over the
  // placeholder image.
  const isRealVideo = active.type === "video" &&
    /\.(mp4|mov|webm|m4v)(\?|$)/i.test(active.src || "");

  // Reset state when switching resources
  useEffectV(() => {
    setProgress(0);
    setPlaying(active.type === "video");
    stageKey.current += 1;
  }, [resIdx, projectId]);

  // Legacy simulated progress (only for video resources WITHOUT a real
  // .mp4 src — kept so the existing placeholder demos still animate).
  useEffectV(() => {
    if (!playing || active.type !== "video" || isRealVideo) return;
    const id = setInterval(() => {
      setProgress((p) => {
        const dur = active.duration || 60;
        if (p >= dur) { setPlaying(false); return dur; }
        return p + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [playing, active, isRealVideo]);

  // Real <video> wiring — react to play state, mute, and progress updates.
  useEffectV(() => {
    const v = videoRef.current;
    if (!isRealVideo || !v) return;
    if (playing) {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => setPlaying(false));
    } else {
      v.pause();
    }
  }, [playing, isRealVideo, resIdx]);

  useEffectV(() => {
    const v = videoRef.current;
    if (v) v.muted = muted;
  }, [muted, resIdx, isRealVideo]);

  function pickResource(i) {
    setResIdx(i);
    setShowInfo(false);
  }

  function togglePlay() {
    if (active.type !== "video") return;
    setPlaying((p) => !p);
  }

  function seek(e) {
    if (active.type !== "video") return;
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    if (isRealVideo && videoRef.current && videoRef.current.duration) {
      videoRef.current.currentTime = videoRef.current.duration * ratio;
    } else {
      setProgress((active.duration || 60) * ratio);
    }
  }

  const dur = (isRealVideo && videoRef.current && videoRef.current.duration)
    ? videoRef.current.duration
    : (active.duration || 60);
  const pct = active.type === "video" ? (progress / dur) * 100 : 0;
  const isVideo = active.type === "video";

  // No more auto-exit fullscreen when switching to a non-video resource —
  // the browser fullscreen now applies to images too.

  const N = resources.length;
  const goPrev = React.useCallback(() => setResIdx((i) => (i - 1 + N) % N), [N]);
  const goNext = React.useCallback(() => setResIdx((i) => (i + 1) % N), [N]);

  useEffectV(() => {
    const onKey = (e) => {
      // Escape is handled natively by the browser when in fullscreen mode.
      if (showInfo) return;
      if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      else if (e.key === "f" || e.key === "F") {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showInfo, goPrev, goNext, toggleFullscreen]);

  // Compact location code shown in the top-right corner on mobile
  // (style inspired by the reference layout). e.g. "DAKAR-09.25"
  const locCode = ((project.location || "").split(",")[0].trim().toUpperCase() + "-" + (project.date || "")).replace(/\s+/g, "");

  return (
    <div ref={viewerRef} className={"viewer" + (fullscreen ? " viewer--video viewer--fs" : "")}>
      {/* Mobile-only HUD — overlays the viewer in 4 corners */}
      <div className="viewer__hud" aria-hidden="false">
        <div className="viewer__hud__tl">
          <div className="viewer__hud__brand">[ LESGRIOTSXSTUDIO ]</div>
          <button className="viewer__hud__link" onClick={() => setShowInfo((s) => !s)}>
            [ {showInfo ? "CLOSE" : "INFORMATION"} ]
          </button>
          <button className="viewer__hud__link" onClick={onClose}>[ BACK ]</button>
        </div>
        <div className="viewer__hud__tr">
          <span className="viewer__hud__code">{locCode}</span>
          <button
            className="viewer__hud__fs"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
            [&nbsp;{fullscreen ? "⤢" : "⤡"}&nbsp;]
          </button>
        </div>
      </div>

      <div className="viewer__main">
        <div className="viewer__stage fade-in" key={stageKey.current}>
          {/* Wrapper du média uniquement — sa largeur sert de référence pour
              caler la barre de lecture juste en dessous, à la même largeur. */}
          <div className="viewer__media-wrap">
            {isRealVideo ? (
              <video
                ref={videoRef}
                src={active.src}
                loop
                playsInline
                muted={muted}
                autoPlay
                onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onLoadedMetadata={(e) => setProgress(e.currentTarget.currentTime || 0)}
              />
            ) : (
              <img ref={imgRef} src={active.src} alt={active.label} />
            )}
          </div>

          {/* Barre de lecture exactement à la largeur du média — PAUSE collé
              au bord gauche de la vidéo, SOUND collé au bord droit. */}
          {active.type === "video" && (
            <div
              className="viewer__controls viewer__controls--fixed"
              style={mediaWidth ? { width: mediaWidth + "px" } : undefined}
            >
              <button
                className="play-btn"
                onClick={togglePlay}
                aria-label={playing ? "Pause" : "Play"}>
                {playing ? "PAUSE" : "PLAY"}
              </button>
              <div className="bar" onClick={seek}>
                <div className="bar__fill" style={{ width: pct + "%" }}></div>
              </div>
              <span className="time">
                {fmtTime(progress)} / <span className="total">{fmtTime(dur)}</span>
              </span>
              <button
                className={"mute-btn" + (muted ? " is-muted" : "")}
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? "Unmute" : "Mute"}
                title={muted ? "Unmute" : "Mute"}>
                SOUND
              </button>
            </div>
          )}

          {/* Edge tap zones — left = prev, right = next (zones invisibles) */}
          <button className="viewer__edge viewer__edge--prev" onClick={goPrev} aria-label="Previous resource" />
          <button className="viewer__edge viewer__edge--next" onClick={goNext} aria-label="Next resource" />
          {(
            <button
              className="viewer__fs"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen (F)"}>
              {fullscreen ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
                  <path d="M9 4v5H4 M15 4v5h5 M9 20v-5H4 M15 20v-5h5"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
                  <path d="M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5"/>
                </svg>
              )}
            </button>
          )}
        </div>

      </div>

      <div className="viewer__rail">
        {resources.map((r, i) => {
          // Logique miniature : on prend ce qu'on peut afficher comme image.
          // 1. poster s'il existe (recommandé pour les vidéos hébergées)
          // 2. src si c'est une image (legacy : certaines vidéos ont un .jpg
          //    en src qui sert de poster — on garde ce comportement)
          // 3. fallback <video> qui montre la 1ère frame si c'est vraiment une
          //    URL vidéo (.mp4, .mov…)
          // 4. tiret si tout est vide
          const isVideo = r.type === "video";
          const isRealVideoSrc = r.src && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(r.src);
          const previewSrc = r.poster || (isRealVideoSrc ? null : r.src);
          return (
            <button
              key={i}
              className={"viewer__thumb" + (i === resIdx ? " active" : "")}
              onClick={() => pickResource(i)}
              aria-label={r.label}>
              {previewSrc ? (
                <img src={previewSrc} alt="" loading="lazy" />
              ) : isRealVideoSrc ? (
                <video
                  src={r.src}
                  muted
                  playsInline
                  preload="metadata"
                  // Se positionne sur ~1 seconde pour montrer une frame
                  // représentative (la 1ère est souvent un fondu noir ou
                  // une mire — 1s ≈ 25-30e frame, on est dans le contenu).
                  onLoadedMetadata={(e) => { try { e.currentTarget.currentTime = 1; } catch {} }}
                />
              ) : (
                <span className="viewer__thumb__missing">—</span>
              )}
              {isVideo && <span className="viewer__thumb__play">▶</span>}
            </button>
          );
        })}
      </div>

      <InfoOverlay
        open={showInfo}
        project={project}
        active={active}
        onClose={() => setShowInfo(false)}
      />

      <div className="utilbar">
        <button onClick={onClose}>
          [ <Type text={tr("viewer.close", lang)} speed={20} delay={200} cursor="never" key={"vc-"+lang} /> ]
        </button>
        <button onClick={() => setShowInfo((s) => !s)}>
          [ <Type text={showInfo ? tr("viewer.project", lang) : tr("viewer.info", lang)} speed={20} delay={350} cursor="never" key={(showInfo ? "info-on" : "info-off")+"-"+lang} /> ]
        </button>
        <span><Type text={`${project.location} — ${project.date}`} speed={18} delay={500} cursor="never" /></span>
      </div>
    </div>
  );
}

function InfoOverlay({ open, project, active, onClose }) {
  const credits = Object.entries(project.credits);
  const col1 = credits.slice(0, 2);
  const col2 = credits.slice(2, 4);
  const col3 = credits.slice(4);

  // Source vidéo preview pour le fond — même logique que le hover de la
  // home Work : thumbVideo si dispo, sinon 1ère resource vidéo réelle.
  const firstRes = project.resources && project.resources[0];
  const firstIsRealVideo = firstRes
    && firstRes.type === "video"
    && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(firstRes.src || "");
  const bgVideo = project.thumbVideo || (firstIsRealVideo ? firstRes.src : null);

  return (
    <div className={"infos" + (open ? " open" : "")}>
      {/* Fond : vidéo preview en B&W + zoom-in + veil radial, comme le
          hover de la page Work. Fallback : image cover. */}
      <div className="infos__bg">
        {bgVideo ? (
          <video
            key={project.id + "-info-bg"}
            src={bgVideo}
            poster={project.cover}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : project.cover ? (
          <div
            className="infos__bg__img"
            style={{ backgroundImage: `url(${project.cover})` }}
          />
        ) : null}
        <div className="infos__bg__veil" />
      </div>
      <div className="infos__inner">
        <div className="infos__cols">
          {[col1, col2, col3].map((col, ci) => (
            <div className="infos__col" key={ci}>
              {col.map(([cat, names]) => (
                <div key={cat}>
                  <span style={{ color: "#6b6660", display: "block", marginBottom: 6 }}>{cat}</span>
                  <div className="row">{names.map((n, i) => <a key={i}>{n}</a>)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="infos__footer">
          {project.tags.map((t, i) => <a key={i}>{t}</a>)}
        </div>
      </div>
    </div>
  );
}

window.ViewerView = ViewerView;
