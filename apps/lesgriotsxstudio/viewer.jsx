/* global React, PROJECTS, useLang, tr, Type */
// Project Viewer — image/video stage in centre + right-side rail
// + InfoOverlay panel that slides up over a black backdrop.

const { useState: useStateV, useEffect: useEffectV, useRef: useRefV } = React;

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
}

function ViewerView({ projectId, onClose, onSwitchProject }) {
  const project = PROJECTS.find((p) => p.id === projectId) || PROJECTS[0];
  const lang = useLang();
  const [resIdx, setResIdx] = useStateV(0);
  const [showInfo, setShowInfo] = useStateV(false);
  // Mobile only — toggle pour afficher la galerie en grille (style Renell
  // Medrano). Visible uniquement quand le projet a plus d'un media.
  const [showOverview, setShowOverview] = useStateV(false);
  // On synchronise un flag sur <body> pour blurrer le viewer derrière
  // (même mécanique que body.menu-open sur mobile). Cleanup au démontage.
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("overview-open", showOverview);
    return () => { document.body.classList.remove("overview-open"); };
  }, [showOverview]);
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
  // Référence sur l'instance YT.Player (créée à la volée pour les resources
  // type "youtube"). Permet de piloter le player YouTube depuis notre bar
  // custom (PAUSE/SOUND/FULL) au lieu de laisser apparaître l'UI YouTube.
  const ytPlayerRef = useRefV(null);
  const ytIframeRef = useRefV(null);
  // Refs sur le player bar + la utilbar pour pouvoir centrer verticalement
  // la caption "PROJET · CLIENT" entre ces deux ancres.
  const controlsRef = useRefV(null);
  const utilbarRef = useRefV(null);
  // Ref sur le rail de miniatures pour l'effet "dock macOS" (magnification
  // au survol — la miniature sous le curseur grossit, ses voisines un peu,
  // les autres taille normale).
  const railRef = useRefV(null);
  // Position Y centrée du caption (en px depuis le top du viewport).
  // null tant qu'on n'a pas mesuré → la caption ne s'affiche pas.
  const [captionY, setCaptionY] = useStateV(null);
  // Largeur réelle du média (vidéo ou image), mesurée à chaque resize/load
  // pour caler la barre de lecture vidéo en dessous à la même largeur.
  // Exposée aussi via la fonction `remeasureMedia` qu'on déclenche depuis
  // les callbacks onLoad/onLoadedMetadata pour garantir une mesure correcte
  // dès que les vraies dimensions du média sont disponibles.
  const [mediaWidth, setMediaWidth] = useStateV(null);
  const remeasureMedia = React.useCallback(() => {
    const el = videoRef.current || imgRef.current;
    if (!el) return;
    const w = el.getBoundingClientRect().width;
    if (w > 0) setMediaWidth(Math.round(w));
  }, []);
  React.useEffect(() => {
    const el = videoRef.current || imgRef.current;
    if (!el) return;
    remeasureMedia();
    // Re-mesures différées : le navigateur a parfois besoin d'un tick pour
    // que les vraies dimensions soient stables (surtout après transition
    // d'un média à l'autre, ou changement de viewport).
    const t1 = setTimeout(remeasureMedia, 50);
    const t2 = setTimeout(remeasureMedia, 200);
    const t3 = setTimeout(remeasureMedia, 500);
    const ro = new ResizeObserver(remeasureMedia);
    ro.observe(el);
    window.addEventListener("resize", remeasureMedia);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      ro.disconnect();
      window.removeEventListener("resize", remeasureMedia);
    };
  }, [resIdx, projectId, remeasureMedia]);

  // Hover sur le rail : seule la miniature sous le curseur se décale à
  // gauche (zéro agrandissement, zéro push des voisines). Les autres restent
  // strictement immobiles.
  React.useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    if (typeof window !== "undefined"
        && window.matchMedia("(hover: none)").matches) return;

    const SHIFT_X = -36; // px de décalage gauche du thumb sous le curseur
    let raf = null;
    let lastClosest = null;

    const resetAll = () => {
      rail.querySelectorAll(".viewer__thumb").forEach((el) => {
        el.style.setProperty("--mag-x", "0px");
      });
      lastClosest = null;
    };
    const onMove = (e) => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const thumbs = Array.from(rail.querySelectorAll(".viewer__thumb"));
        if (!thumbs.length) return;
        // Trouve le thumb dont le centre Y est le plus proche du curseur.
        const cy = e.clientY;
        let closest = null;
        let minD = Infinity;
        thumbs.forEach((el) => {
          const r = el.getBoundingClientRect();
          const center = r.top + r.height / 2;
          const d = Math.abs(cy - center);
          if (d < minD) { minD = d; closest = el; }
        });
        if (closest !== lastClosest) {
          // On nettoie l'ancien shift et on applique sur le nouveau.
          thumbs.forEach((el) => el.style.setProperty("--mag-x", "0px"));
          if (closest) closest.style.setProperty("--mag-x", SHIFT_X + "px");
          lastClosest = closest;
        }
      });
    };
    rail.addEventListener("mousemove", onMove);
    rail.addEventListener("mouseleave", resetAll);
    return () => {
      rail.removeEventListener("mousemove", onMove);
      rail.removeEventListener("mouseleave", resetAll);
      if (raf) cancelAnimationFrame(raf);
      resetAll();
    };
  }, [resIdx, projectId]);

  // Positionnement vertical de la caption "PROJET · CLIENT".
  // - Desktop : centrée entre le bas du player bar et le haut de la utilbar
  // - Mobile (utilbar masquée) : juste en dessous du player bar / de la vidéo
  // Re-mesure à chaque changement de média (mediaWidth) et à chaque resize.
  React.useEffect(() => {
    const updateCaption = () => {
      const c = controlsRef.current;
      const u = utilbarRef.current;
      // Ancre haute = bas du player bar (ou du média si pas de bar).
      const topAnchor = c
        ? c.getBoundingClientRect().bottom
        : (videoRef.current || imgRef.current)?.getBoundingClientRect().bottom;
      if (topAnchor == null) { setCaptionY(null); return; }
      // Utilbar visible (desktop) ? On regarde si l'élément a une dimension.
      const utilRect = u ? u.getBoundingClientRect() : null;
      const utilVisible = utilRect && utilRect.height > 0 && utilRect.top > 0;
      if (utilVisible) {
        // Desktop : milieu entre ancre haute et utilbar
        setCaptionY(Math.round((topAnchor + utilRect.top) / 2));
      } else {
        // Mobile (utilbar display:none) : projmeta centrée verticalement
        // entre le bas du média (topAnchor) et le bord bas du viewport.
        // Comme ça la projmeta "flotte" toujours au milieu de l'espace
        // libre quelle que soit la hauteur du média (portrait → moins
        // d'espace en bas, projmeta proche du média ; landscape → plus
        // d'espace en bas, projmeta plus basse mais centrée).
        const vh = window.innerHeight || document.documentElement.clientHeight || 800;
        setCaptionY(Math.round((topAnchor + vh) / 2));
      }
    };
    updateCaption();
    const t1 = setTimeout(updateCaption, 60);
    const t2 = setTimeout(updateCaption, 220);
    window.addEventListener("resize", updateCaption);
    window.addEventListener("scroll", updateCaption, { passive: true });
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", updateCaption);
      window.removeEventListener("scroll", updateCaption);
    };
  }, [mediaWidth, resIdx, projectId, fullscreen]);

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
  // Clamp resIdx aux bornes des resources du projet courant. Au switch
  // de projet (via onSwitchProject sur edge tap), le state resIdx est
  // conservé alors que la liste des resources change. Si le nouveau
  // projet a moins de resources que l'ancien, resources[resIdx] devient
  // undefined et tout le render crash. Le useEffect plus bas reset
  // resIdx à 0 sur le tick suivant, mais on a besoin d'un guard pour
  // le 1er render après le changement de projectId.
  const safeResIdx = Math.min(resIdx, resources.length - 1);
  const active = resources[safeResIdx] || resources[0];

  // Detect if active.src points to a real video file (mp4/mov/webm) —
  // these get rendered as a <video> with controls wired to the element.
  // Otherwise we fall back to the legacy simulated playback over the
  // placeholder image.
  const isRealVideo = active.type === "video" &&
    /\.(mp4|mov|webm|m4v)(\?|$)/i.test(active.src || "");

  // Reset resIdx à 0 quand on change de projet — sinon le resIdx (qui
  // est conservé dans le state) peut être hors-borne sur le nouveau projet
  // (si le nouveau projet a moins de resources que le précédent), et
  // `active = resources[resIdx]` devient undefined → crash. Sépare de
  // l'effet "reset progress" plus bas pour éviter race condition.
  useEffectV(() => {
    setResIdx(0);
  }, [projectId]);

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

  // Synchro mute pour YouTube
  useEffectV(() => {
    const p = ytPlayerRef.current;
    if (!p) return;
    if (muted && p.mute) p.mute();
    else if (!muted && p.unMute) p.unMute();
  }, [muted, resIdx]);

  // ============================================================
  // YouTube IFrame Player API — chargement script + instanciation
  // ============================================================
  // Charge le script API YouTube une seule fois pour toute la session.
  // window.onYouTubeIframeAPIReady est appelé par YouTube quand prêt.
  useEffectV(() => {
    if (typeof window === "undefined") return;
    if (window.YT && window.YT.Player) return;
    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) return;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    document.body.appendChild(tag);
  }, []);

  // Crée / détruit l'instance YT.Player quand la resource active devient
  // (ou n'est plus) un type "youtube". On crée le player APRÈS que l'iframe
  // soit montée dans le DOM (effet sur ytIframeRef + ID YouTube).
  React.useEffect(() => {
    if (!isYouTube) {
      // Si on quitte une resource YouTube, on détruit l'ancien player.
      if (ytPlayerRef.current && ytPlayerRef.current.destroy) {
        try { ytPlayerRef.current.destroy(); } catch (e) {}
      }
      ytPlayerRef.current = null;
      return;
    }
    const url = active.src || "";
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
    if (!ytMatch) return;
    const videoId = ytMatch[1];

    function instantiate() {
      const iframe = ytIframeRef.current;
      if (!iframe || !window.YT || !window.YT.Player) return false;
      try {
        ytPlayerRef.current = new window.YT.Player(iframe, {
          events: {
            onReady: (ev) => {
              if (muted) ev.target.mute();
              ev.target.playVideo();
              remeasureMedia();
            },
            onStateChange: (ev) => {
              // 1 = playing, 2 = paused, 0 = ended
              if (ev.data === 1) setPlaying(true);
              else if (ev.data === 2 || ev.data === 0) setPlaying(false);
            },
          },
        });
        return true;
      } catch (e) {
        return false;
      }
    }

    // Si l'API est déjà chargée, on instancie direct ; sinon on attend.
    if (window.YT && window.YT.Player) {
      instantiate();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prev) prev();
        instantiate();
      };
    }

    return () => {
      if (ytPlayerRef.current && ytPlayerRef.current.destroy) {
        try { ytPlayerRef.current.destroy(); } catch (e) {}
      }
      ytPlayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.src, isYouTube, resIdx, projectId]);

  // Poll la position de lecture YouTube pour mettre à jour progress (la
  // barre de lecture custom) toutes les 250ms quand on joue une vidéo YT.
  useEffectV(() => {
    if (!isYouTube || !playing) return;
    const id = setInterval(() => {
      const p = ytPlayerRef.current;
      if (p && p.getCurrentTime) setProgress(p.getCurrentTime());
    }, 250);
    return () => clearInterval(id);
  }, [isYouTube, playing, resIdx]);

  function pickResource(i) {
    setResIdx(i);
    setShowInfo(false);
  }

  const isYouTube = active.type === "youtube";
  const isMediaPlayable = active.type === "video" || isYouTube;

  function togglePlay() {
    if (!isMediaPlayable) return;
    if (isYouTube && ytPlayerRef.current) {
      // L'état playing est mis à jour par l'event onStateChange du YT player.
      const state = ytPlayerRef.current.getPlayerState && ytPlayerRef.current.getPlayerState();
      // 1 = playing, 2 = paused, autres = autres
      if (state === 1) ytPlayerRef.current.pauseVideo();
      else ytPlayerRef.current.playVideo();
      return;
    }
    setPlaying((p) => !p);
  }

  function seek(e) {
    if (!isMediaPlayable) return;
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    if (isYouTube && ytPlayerRef.current) {
      const d = ytPlayerRef.current.getDuration && ytPlayerRef.current.getDuration();
      if (d) ytPlayerRef.current.seekTo(d * ratio, true);
      return;
    }
    if (isRealVideo && videoRef.current && videoRef.current.duration) {
      videoRef.current.currentTime = videoRef.current.duration * ratio;
    } else {
      setProgress((active.duration || 60) * ratio);
    }
  }

  // Durée et pourcentage de progression, ajustés pour les 3 types :
  // - YouTube : duration depuis le YT player, progress mis à jour par interval
  // - Vidéo self-hosted : duration depuis l'élément <video>
  // - Vidéo simulée (legacy) : duration depuis active.duration en data
  const dur = isYouTube && ytPlayerRef.current && ytPlayerRef.current.getDuration
    ? (ytPlayerRef.current.getDuration() || active.duration || 60)
    : (isRealVideo && videoRef.current && videoRef.current.duration)
      ? videoRef.current.duration
      : (active.duration || 60);
  const pct = isMediaPlayable ? (progress / dur) * 100 : 0;
  const isVideo = active.type === "video";

  // No more auto-exit fullscreen when switching to a non-video resource —
  // the browser fullscreen now applies to images too.

  const N = resources.length;
  // Navigation entre resources du projet courant. Comportement aux bornes :
  // - À la 1ère resource, clic prev → switch sur le projet précédent (si
  //   onSwitchProject est dispo) sinon on wrap sur la dernière resource.
  // - À la dernière resource, clic next → switch sur le projet suivant.
  // - Sinon comportement normal (i ± 1).
  // On utilise safeResIdx (et pas resIdx brut) pour les boundary checks :
  // sinon, au tick juste après un switch de projet, resIdx peut être stale
  // (= dernière resource du projet précédent, hors-borne sur le nouveau) et
  // la comparaison resIdx === N - 1 retournerait false → on dépasserait
  // au lieu de switcher correctement.
  const goPrev = React.useCallback(() => {
    if (safeResIdx === 0 && onSwitchProject) {
      onSwitchProject("prev");
      return;
    }
    setResIdx((i) => (i - 1 + N) % N);
  }, [N, safeResIdx, onSwitchProject]);
  const goNext = React.useCallback(() => {
    if (safeResIdx === N - 1 && onSwitchProject) {
      onSwitchProject("next");
      return;
    }
    setResIdx((i) => (i + 1) % N);
  }, [N, safeResIdx, onSwitchProject]);

  useEffectV(() => {
    const onKey = (e) => {
      // Escape is handled natively by the browser when in fullscreen mode.
      if (showInfo) return;
      // En fullscreen, on bloque la navigation gallery (← / →). Le fullscreen
      // est conçu pour focus sur UNE vidéo unique : pour revenir au projet,
      // l'utilisateur doit sortir du fullscreen (Esc ou bouton FS). On laisse
      // F / Esc passer.
      if (fullscreen && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      else if (e.key === "f" || e.key === "F") {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showInfo, fullscreen, goPrev, goNext, toggleFullscreen]);

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
          {/* Bouton fullscreen retiré du HUD mobile : il est déjà dans
              la barre player (icône SVG à droite de SOUND). */}
        </div>
      </div>

      <div className="viewer__main">
        <div className="viewer__stage fade-in" key={stageKey.current}>
          {/* Wrapper média = display:flex column, width:fit-content. Le wrap
              prend la largeur exacte du média (vidéo ou image), et la barre
              de lecture vit À L'INTÉRIEUR avec align-self:stretch → elle
              hérite mécaniquement de la largeur du média, plus besoin du
              JS mediaWidth pour caler la largeur. La barre est aussi le
              voisin DOM direct de la vidéo → littéralement collée dessous,
              sans gap parasite injecté par le flex parent du stage. */}
          <div className="viewer__media-wrap">
            {/* Ligne optionnelle au-dessus du média : nom de la resource
                (active.label). Mêmes taille / espacement / animation que
                la projmeta sous le média — typewriter cascade via Type
                component pour cohérence visuelle. Re-monté à chaque
                changement de resource (clé inclut resIdx) pour rejouer
                l'animation à chaque nouveau média. */}
            {active.label && (
              <div className="viewer__media-label" aria-label="Resource label">
                <Type
                  text={active.label}
                  speed={26}
                  cursor="always"
                  key={"label-" + projectId + "-" + resIdx}
                />
              </div>
            )}
            {active.type === "youtube" ? (
              /* Embed YouTube ou Vimeo piloté par l'API IFrame Player.
                 - URL params anti-branding : controls=0, modestbranding=1,
                   rel=0 (pas de suggestions), iv_load_policy=3 (annotations
                   off), showinfo=0, disablekb=1, fs=0, playsinline=1, enablejsapi=1
                 - Click-shield (div transparent en absolute par-dessus) :
                   capture les clics → togglePlay, et bloque l'accès à l'UI
                   YouTube qui apparaît au hover/pause.
                 - L'instance YT.Player est créée via useEffect plus haut. */
              (() => {
                const url = active.src || "";
                const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
                const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d{6,})/i);
                let embedUrl = null;
                if (ytMatch) {
                  const id = ytMatch[1];
                  embedUrl = `https://www.youtube.com/embed/${id}?enablejsapi=1&controls=0&modestbranding=1&rel=0&iv_load_policy=3&showinfo=0&disablekb=1&fs=0&playsinline=1&autoplay=1&mute=${muted ? 1 : 0}&origin=${encodeURIComponent(window.location.origin)}`;
                } else if (vimeoMatch) {
                  embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}?title=0&byline=0&portrait=0&controls=0&autoplay=1`;
                }
                if (!embedUrl) return <div style={{ color: "var(--ink-dim)", padding: 20 }}>URL non reconnue : {url}</div>;
                return (
                  <div style={{
                    position: "relative",
                    width: "min(80vw, calc((100vh - 340px) * 16 / 9))",
                    aspectRatio: "16 / 9",
                    maxHeight: "calc(100vh - 340px)",
                  }}>
                    <iframe
                      ref={ytIframeRef}
                      src={embedUrl}
                      title={active.label}
                      frameBorder="0"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      onLoad={remeasureMedia}
                      style={{
                        display: "block",
                        width: "100%",
                        height: "100%",
                        border: 0,
                        background: "#000",
                      }}
                    />
                    {/* Plus de masques opaques — ils étaient visibles
                        comme des bandes noires moches même pendant la
                        lecture (à cause du delay sur le state YouTube).
                        Le click-shield ci-dessous suffit à empêcher
                        l'interaction avec l'UI YouTube. */}
                    {/* Click-shield au-dessus de tout : capture les clics
                        utilisateur pour togglePlay et bloque l'accès à
                        TOUTE l'UI YouTube (suggestions, miniatures fin de
                        vidéo, logo YouTube, etc.). z-index max. */}
                    <div
                      onClick={togglePlay}
                      style={{
                        position: "absolute",
                        inset: 0,
                        cursor: "pointer",
                        background: "transparent",
                        zIndex: 3,
                      }}
                      aria-label="Toggle play/pause"
                    />
                  </div>
                );
              })()
            ) : isRealVideo ? (
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
                onLoadedMetadata={(e) => {
                  setProgress(e.currentTarget.currentTime || 0);
                  // Dès qu'on a la métadonnée (= dimensions réelles), on remesure
                  // pour que la barre de lecture s'aligne pile sur la largeur.
                  remeasureMedia();
                }}
                onLoadedData={remeasureMedia}
                onClick={togglePlay}
                /* cursor géré globalement dans styles.css (.viewer__media-wrap
                   video) pour appliquer le curseur custom mustard. Pas de
                   cursor: pointer inline qui écraserait. */
              />
            ) : (
              <img
                ref={imgRef}
                src={active.src}
                alt={active.label}
                onLoad={remeasureMedia}
              />
            )}

          {/* Barre de lecture — voisin DOM direct du média, donc rendue
              juste en dessous dans le flex column de media-wrap. width
              géré 100 % via CSS (align-self:stretch sur le bar dans
              media-wrap qui est fit-content). L'inline-style mediaWidth
              reste comme fallback pour les cas où fit-content ne suffit
              pas (vieux navigateurs). */}
          {/* Barre custom pour vidéos self-hosted ET YouTube/Vimeo (via API
              IFrame). Pour YouTube : les boutons appellent ytPlayerRef
              (playVideo/pauseVideo/mute/unMute/seekTo), pour les vidéos
              self-hosted ils manipulent l'élément <video> direct. */}
          {(active.type === "video" || active.type === "youtube") && (
            <div
              ref={controlsRef}
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
                className="mute-btn"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? "Unmute" : "Mute"}
                title={muted ? "Unmute" : "Mute"}>
                {/* Le label = l'action que le clic déclenche, comme PLAY/PAUSE :
                    son actif → "MUTE" (cliquer coupe le son)
                    muté     → "SOUND" (cliquer remet le son). */}
                {muted ? "SOUND" : "MUTE"}
              </button>
              {/* Bouton plein écran in-bar — même SVG que le bouton flottant
                  (4 flèches qui partent / convergent vers les coins). */}
              <button
                className="fs-btn"
                onClick={toggleFullscreen}
                aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen (F)"}>
                {fullscreen ? (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
                    <path d="M9 4v5H4 M15 4v5h5 M9 20v-5H4 M15 20v-5h5"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square">
                    <path d="M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5"/>
                  </svg>
                )}
              </button>
            </div>
          )}
          </div>{/* end .viewer__media-wrap (englobe media + barre player) */}

          {/* Edge tap zones — left = prev, right = next (zones invisibles) */}
          <button className="viewer__edge viewer__edge--prev" onClick={goPrev} aria-label="Previous resource" />
          <button className="viewer__edge viewer__edge--next" onClick={goNext} aria-label="Next resource" />
          {/* Le bouton fullscreen flottant a été retiré : la même icône SVG
              est désormais dans la barre player à droite (.fs-btn) — pas
              besoin de doublon. La classe CSS .viewer__fs reste dans
              styles.css au cas où, mais n'est plus rendue. */}
        </div>

      </div>

      {/* Calcul dynamique de la largeur des thumbs pour que tout rentre
          dans 70vh sans scroll. On somme les "ratios inverses" (height/width)
          de chaque resource pour estimer la hauteur totale, puis on en
          déduit la largeur max possible. Heuristique simple sans accès
          au DOM. */}
      <div
        className="viewer__rail"
        ref={railRef}
        style={{
          "--rail-thumb-w": (() => {
            const N = resources.length;
            if (N <= 1) return "100px";
            // Somme des height/width ratios. Si aspect manque, on suppose 1:1.
            const totalRatio = resources.reduce((sum, r) => {
              const parts = (typeof r.aspect === "string" && r.aspect.includes("/"))
                ? r.aspect.split("/").map((p) => parseFloat(p))
                : [1, 1];
              const w = parts[0] || 1;
              const h = parts[1] || 1;
              return sum + (h / w);
            }, 0);
            // 70vh dispo, gap 10px entre chaque thumb.
            // hauteur totale = totalRatio × thumb_w + gaps
            // → thumb_w = (70vh - gaps) / totalRatio
            // 70vh on doesn't have, on calcule en vh : (70 - gaps_vh) / totalRatio
            // Plus simple : on calc en CSS avec calc.
            return `min(100px, calc((70vh - ${(N - 1) * 10}px) / ${totalRatio.toFixed(2)}))`;
          })(),
        }}
      >
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
          // Pas de aspect-ratio inline — on laisse exclusivement le
          // media (img / video) dicter sa hauteur via width: 100% +
          // height: auto en CSS. Comme ça même si r.aspect est mal
          // renseigné (par défaut "16/9" posé par le BO sur une image
          // 4:3), c'est l'image native qui fait foi. Le bouton wrappe.
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

      {/* Caption nom du projet + client + rôle + compteur — centrée
          verticalement entre la barre player et la utilbar du bas.
          Animation typewriter <Type> identique au hover Work.
          Key=projectId pour rejouer le typing à chaque changement de projet.
          Masquée quand l'overlay INFORMATION est ouvert.

          Le caret permanent ("always") cascade TOUJOURS sur la DERNIÈRE
          ligne visible (counter > role > client > name), garantissant
          qu'il reste affiché peu importe les données manquantes du projet. */}
      {(project.name || project.client) && captionY != null && !showInfo && (() => {
        const role = Array.isArray(project.role) ? project.role.join(" / ") : project.role;
        const roleText = role || (project.tags || []).slice(0, 2).join(" / ");
        const hasCounter = resources.length > 1;
        const hasRole = !!roleText;
        const hasClient = !!project.client;
        const counterText = hasCounter
          ? `${String(safeResIdx + 1).padStart(2, "0")} / ${String(resources.length).padStart(2, "0")}`
          : "";
        // Délais cumulés (approximation char * speed)
        const dName = 0;
        const dClient = (project.name || "").length * 26 + 150;
        const dRole = dClient + (project.client || "").length * 26 + 150;
        const dCounter = dRole + roleText.length * 26 + 150;
        return (
          <div
            className="viewer__projmeta"
            style={{ top: captionY + "px" }}
          >
            {project.name && (
              <span className="viewer__projmeta__name">
                <Type
                  text={project.name}
                  speed={26}
                  delay={dName}
                  cursor={!hasClient && !hasRole && !hasCounter ? "always" : "while"}
                  key={"projmeta-name-" + projectId}
                />
              </span>
            )}
            {hasClient && (
              <span className="viewer__projmeta__client">
                <Type
                  text={project.client}
                  speed={26}
                  delay={dClient}
                  cursor={!hasRole && !hasCounter ? "always" : "while"}
                  key={"projmeta-client-" + projectId}
                />
              </span>
            )}
            {hasRole && (
              <span className="viewer__projmeta__role">
                <Type
                  text={roleText}
                  speed={26}
                  delay={dRole}
                  cursor={!hasCounter ? "always" : "while"}
                  key={"projmeta-role-" + projectId}
                />
              </span>
            )}
            {hasCounter && (
              <span className="viewer__projmeta__counter" aria-live="polite">
                <Type
                  text={counterText}
                  speed={26}
                  delay={dCounter}
                  cursor="always"
                  key={"projmeta-counter-" + projectId + "-" + resIdx}
                />
              </span>
            )}
          </div>
        );
      })()}

      <div className="utilbar" ref={utilbarRef}>
        {/* CLOSE à gauche, INFORMATION à droite. Le LIEU—DATE a été
            retiré (l'info est désormais dans l'overlay InfoOverlay
            uniquement). Le bouton OVERVIEW est en dehors de la utilbar
            (cf. .viewer__overview-trigger ci-dessous) car la spécificité
            CSS `.utilbar > button { display: inline-flex }` empêchait de
            le cacher sur desktop. */}
        <button onClick={onClose}>
          [ <Type text={tr("viewer.close", lang)} speed={20} delay={200} cursor="never" key={"vc-"+lang} /> ]
        </button>
        <button onClick={() => setShowInfo((s) => !s)}>
          [ <Type text={showInfo ? tr("viewer.project", lang) : tr("viewer.info", lang)} speed={20} delay={350} cursor="never" key={(showInfo ? "info-on" : "info-off")+"-"+lang} /> ]
        </button>
      </div>

      {/* Bouton OVERVIEW standalone — mobile-only via CSS @media.
          Positionné centré en bas, entre la projmeta et la utilbar.
          Visible seulement quand le projet a plusieurs ressources et
          quand l'overlay info n'est pas ouvert. */}
      {resources.length > 1 && !showInfo && (
        <button
          className="viewer__overview-trigger"
          onClick={() => setShowOverview((s) => !s)}
          aria-label={tr("viewer.overview", lang)}
        >
          [ {showOverview ? tr("viewer.close", lang) : tr("viewer.overview", lang)} ]
        </button>
      )}

      {/* INFORMATION trigger standalone — mobile-only, bas-droit, miroir
          de OVERVIEW (qui est bas-gauche). Plain text, pas d'effet Type.
          Disparaît quand le panel OVERVIEW est ouvert pour ne pas
          encombrer la zone d'interaction du drawer. */}
      {!showOverview && (
        <button
          className="viewer__info-trigger"
          onClick={() => setShowInfo((s) => !s)}
          aria-label={tr("viewer.info", lang)}
        >
          [ {showInfo ? tr("viewer.close", lang) : tr("viewer.info", lang)} ]
        </button>
      )}

      {/* Backdrop tap-to-close — couvre la moitié supérieure (au-dessus du
          panel). Tap dessus → ferme le drawer en glissant vers le bas.
          Mobile only via @media (sur desktop le drawer ne s'ouvre jamais). */}
      {resources.length > 1 && (
        <div
          className={"viewer__overview-backdrop" + (showOverview ? " is-open" : "")}
          onClick={() => setShowOverview(false)}
          aria-hidden="true"
        />
      )}

      {/* Panel OVERVIEW — slide-up depuis le bas, couvre la moitié inférieure.
          Le viewer derrière est blurré (via body.overview-open).
          Tap sur un thumb → jump à cette resource + ferme le panel.
          Mobile only (CSS @media). On garde le DOM monté pour l'anim de
          sortie ; CSS gère display:none sur desktop. */}
      {resources.length > 1 && (
        <div
          className={"viewer__overview" + (showOverview ? " is-open" : "")}
          role="dialog"
          aria-label="Overview"
          aria-hidden={!showOverview}
        >
          <div className="viewer__overview__head">
            <span className="viewer__overview__title">
              {/* Typewriter — relance à chaque ouverture du panel via la
                  key (incluant showOverview), avec caret permanent comme
                  les autres lignes terminal du site. */}
              <Type
                text={project.name + (project.client ? " · " + project.client : "")}
                speed={24}
                delay={120}
                cursor={showOverview ? "always" : "never"}
                key={"ov-title-" + projectId + "-" + (showOverview ? "on" : "off")}
              />
            </span>
          </div>
          <div
            className="viewer__overview__grid"
            style={{
              // Toujours 4 colonnes pour cohérence visuelle quel que soit
              // le nombre de resources.
              "--grid-cols": 4,
            }}
          >
            {resources.map((r, i) => {
              const isVideo = r.type === "video";
              const isYT = r.type === "youtube" || /(?:youtube\.com|youtu\.be)/i.test(r.src || "");
              const isImg = r.type === "image" || /\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i.test(r.src || "");
              const aspectStyle = (typeof r.aspect === "string" && r.aspect.includes("/"))
                ? { aspectRatio: r.aspect }
                : null;
              return (
                <button
                  key={"ov-" + i}
                  className={"viewer__overview__cell" + (i === safeResIdx ? " is-active" : "")}
                  style={aspectStyle || undefined}
                  onClick={() => {
                    setResIdx(i);
                    setShowOverview(false);
                  }}
                >
                  {isImg ? (
                    <img src={r.src} alt="" />
                  ) : isYT ? (
                    <img
                      src={(() => {
                        const m = (r.src || "").match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
                        return m ? `https://i.ytimg.com/vi/${m[1]}/maxresdefault.jpg` : "";
                      })()}
                      alt=""
                    />
                  ) : isVideo ? (
                    <video
                      src={r.src}
                      muted
                      playsInline
                      preload="metadata"
                      onLoadedMetadata={(e) => { try { e.currentTarget.currentTime = 1; } catch {} }}
                    />
                  ) : (
                    <span className="viewer__overview__cell__missing">—</span>
                  )}
                  {isVideo && <span className="viewer__overview__cell__play">▶</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoOverlay({ open, project, active, onClose }) {
  // Source vidéo preview pour le fond — même logique que le hover de la
  // home Work : thumbVideo si dispo, sinon 1ère resource vidéo réelle.
  const firstRes = project.resources && project.resources[0];
  const firstIsRealVideo = firstRes
    && firstRes.type === "video"
    && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(firstRes.src || "");
  const bgVideo = project.thumbVideo || (firstIsRealVideo ? firstRes.src : null);

  // Construit la liste des champs à afficher en mode terminal.
  // - SERVICES remplace ROLE
  // - Tags retirés
  // - On ajoute les credits structurés (CATÉGORIE → noms joints par " · ")
  // - Champs vides ignorés
  const dash = "—";
  // Helper : renvoie true si la valeur est non vide ET pas un dash placeholder.
  const hasValue = (v) => v && typeof v === "string" && v.trim() && v.trim() !== dash;
  const role = Array.isArray(project.role) ? project.role.join(", ") : (project.role || "");
  // Chaque base row n'est INCLUSE que si la valeur est réellement renseignée
  // (sinon pas la peine de typewriter un champ vide / un tiret placeholder).
  const baseRows = [
    hasValue(project.client)   ? ["CLIENT",   project.client]   : null,
    hasValue(project.date)     ? ["YEAR",     project.date]     : null,
    hasValue(project.location) ? ["LOCATION", project.location] : null,
    role                       ? ["SERVICES", role]             : null,
  ].filter(Boolean);
  // Pour éviter les doublons : on retire des credits toute catégorie déjà
  // affichée en base row (CLIENT, YEAR, LOCATION, SERVICES). Certains projets
  // ont par exemple un credit "CLIENT":["XYZ"] en plus du champ project.client.
  const baseLabels = new Set(baseRows.map(([label]) => label.toUpperCase()));
  const creditRows = Object.entries(project.credits || {})
    .filter(([cat]) => !baseLabels.has(cat.toUpperCase()))
    .filter(([, names]) => Array.isArray(names) && names.some((n) => n && n !== dash))
    .map(([cat, names]) => [cat, names.filter((n) => n && n !== dash).join(" · ")]);
  const rows = [...baseRows, ...creditRows];
  const total = rows.length;

  return (
    <div
      className={"infos" + (open ? " open" : "")}
      onClick={(e) => {
        // Tap dans la zone vide (hors button/a) → ferme le panel.
        // Même mécanique que le menu mobile et l'overview panel.
        const t = e.target;
        if (t && t.closest && t.closest("button, a")) return;
        if (onClose) onClose();
      }}
    >
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
      {/* Vue terminale — chaque label et valeur s'écrit en typewriter
          séquentiel (effet vrai terminal). Délai cumulé calculé en JS
          pour cascader d'une row à la suivante. Re-jouée à chaque
          ouverture du panel via la clé qui inclut `open`. */}
      <div className="infos__inner">
        <div className="idx-term idx-term--info">
          <div className="idx-term__inner">
            {(() => {
              // Typing rapide façon terminal : speed bas + cursor "while"
              // sur CHAQUE Type → le caret blinkant suit la position
              // courante du texte (visible pendant chaque animation,
              // se déplace de label → value → row suivante).
              const SPEED = 12; // ms par char (rapide)
              const ROW_GAP = 40; // mini-pause entre éléments
              const cmdText = `project — ${project.name}`;
              const openKey = open ? "on" : "off";
              let cum = cmdText.length * SPEED + 80;
              const rowTimings = rows.map(([label, value]) => {
                const labelDelay = cum;
                cum += String(label).length * SPEED + ROW_GAP;
                const valueDelay = cum;
                cum += String(value).length * SPEED + ROW_GAP;
                return { labelDelay, valueDelay };
              });
              const finalCursorDelay = cum + 100;
              return (
                <React.Fragment>
                  <div className="idx-term__line idx-term__cmd">
                    <span className="prompt">&gt;</span>{" "}
                    <Type
                      text={cmdText}
                      speed={SPEED}
                      cursor="while"
                      key={"info-cmd-" + project.id + "-" + openKey}
                    />
                    <span className="idx-term__meta"> — {String(total).padStart(2, "0")}</span>
                  </div>
                  <div className="idx-term__line idx-term__spacer">&nbsp;</div>

                  <ol className="idx-term__rows">
                    {rows.map(([label, value], i) => (
                      <li key={label + i} className="idx-term__row idx-term__row--info">
                        <span className="c-num">{String(i + 1).padStart(2, "0")}</span>
                        <span className="c-label">
                          <Type
                            text={String(label)}
                            speed={SPEED}
                            delay={rowTimings[i].labelDelay}
                            cursor="while"
                            key={"info-l-" + i + "-" + project.id + "-" + openKey}
                          />
                        </span>
                        <span className="c-value">
                          <Type
                            text={String(value)}
                            speed={SPEED}
                            delay={rowTimings[i].valueDelay}
                            cursor="while"
                            key={"info-v-" + i + "-" + project.id + "-" + openKey}
                          />
                        </span>
                      </li>
                    ))}
                  </ol>

                  <div className="idx-term__line idx-term__spacer">&nbsp;</div>
                  <div className="idx-term__line idx-term__cmd">
                    <span className="prompt">&gt;</span>{" "}
                    <Type
                      text=""
                      speed={SPEED}
                      delay={finalCursorDelay}
                      cursor="always"
                      key={"info-end-" + project.id + "-" + openKey}
                    />
                  </div>
                </React.Fragment>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

window.ViewerView = ViewerView;
