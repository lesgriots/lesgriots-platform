/* global React, ReactDOM, BootLoader, MenuBar, HomeView, HomeMobile, ViewerView, AboutView, EcoView, useTweaks, TweaksPanel, TweakSection, TweakSlider, TweakToggle, useLang, tr, YellowCard, PROJECTS, MatrixGriot */

const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "grainOpacity": 9,
  "grainSize": 180,
  "bgSepia": 55,
  "bgSaturate": 85,
  "bgContrast": 108,
  "bgBrightness": 92,
  "bgDistort": 8,
  "scanOpacity": 100,
  "scanGap": 4,
  "scanThickness": 2,
  "vignette": 100,
  "crtOn": true
}/*EDITMODE-END*/;

// Détermine la première vue active selon SITE_CONTENT.activePages
// (configuré dans le back office). Mapping clé back-office → clé app :
// work → home, about → about, eco → eco. Si tout est désactivé, fallback home.
function firstActiveView() {
  const ap = (typeof window !== "undefined" && window.SITE_CONTENT && window.SITE_CONTENT.activePages) || {};
  if (ap.work !== false) return "home";
  if (ap.about !== false) return "about";
  if (ap.eco !== false) return "eco";
  return "home";
}
// Renvoie true si la vue passée existe ET n'a pas été désactivée.
function isViewActive(v) {
  const ap = (typeof window !== "undefined" && window.SITE_CONTENT && window.SITE_CONTENT.activePages) || {};
  if (v === "home")  return ap.work  !== false;
  if (v === "about") return ap.about !== false;
  if (v === "eco")   return ap.eco   !== false;
  return true; // viewer reste toujours accessible
}

// ============================================================
// HISTORY API — intégration avec l'historique du navigateur.
// Permet aux gestures de retour (swipe iPhone, two-finger Mac,
// bouton back Windows, touche backspace, Cmd/Ctrl+[/]) de
// naviguer dans l'app de manière naturelle. Bonus : chaque
// projet a son URL partageable (lesgriotsxstudio.com/work/xxx).
//
// Mapping URL ↔ état :
//   /                  → home (vue Work)
//   /about             → about
//   /eco               → eco
//   /work/<projectId>  → viewer du projet
// ============================================================

function urlToState(pathname) {
  if (!pathname || pathname === "/" || pathname === "") {
    return { view: firstActiveView(), projectId: null };
  }
  if (pathname === "/about" || pathname === "/about/") {
    return { view: "about", projectId: null };
  }
  if (pathname === "/eco" || pathname === "/eco/") {
    return { view: "eco", projectId: null };
  }
  const m = pathname.match(/^\/work\/([^\/]+)\/?$/);
  if (m) return { view: "viewer", projectId: decodeURIComponent(m[1]) };
  // URL inconnue → fallback home (au lieu d'un 404 React)
  return { view: firstActiveView(), projectId: null };
}

function stateToUrl(view, projectId) {
  if (view === "viewer" && projectId) return `/work/${encodeURIComponent(projectId)}`;
  if (view === "about")  return "/about";
  if (view === "eco")    return "/eco";
  return "/";
}

function App() {
  // État initial déterminé par l'URL (lien partagé, refresh, bookmark).
  // Si l'URL est /work/xxx, on ouvre direct le viewer ; sinon home/about/eco.
  // Sécurise contre une vue désactivée par le back office.
  const initialFromUrl = React.useMemo(() => {
    if (typeof window === "undefined") return { view: firstActiveView(), projectId: null };
    const s = urlToState(window.location.pathname);
    if (s.view !== "viewer" && !isViewActive(s.view)) {
      return { view: firstActiveView(), projectId: null };
    }
    return s;
  }, []);
  const [view, setView] = useState(initialFromUrl.view);
  const [projectId, setProjectId] = useState(initialFromUrl.projectId);
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  // Boot loader UNIQUEMENT à la première visite de la session navigateur :
  // refresh / navigation entre pages = on saute direct sur le contenu.
  // sessionStorage = vit jusqu'à la fermeture de l'onglet (puis remis à
  // zéro à la prochaine ouverture). Sur mobile, ça évite que le boot
  // joue à chaque pull-to-refresh accidentel.
  const [booted, setBooted] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return sessionStorage.getItem("lgxs_booted") === "1"; }
    catch (e) { return false; }
  });
  const lang = useLang();

  // Toggle une classe sur <body> pour piloter en CSS l'apparition du
  // chrome (sticker, menubar) APRÈS la fin du boot. On utilise
  // useLayoutEffect pour appliquer la classe AVANT le premier paint —
  // sinon il y a un bref flash où le sticker apparaît à sa position
  // avant que body.is-booting ne soit posée par un useEffect normal.
  React.useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("booted", booted);
    return () => { document.body.classList.remove("booted"); };
  }, [booted]);

  // ─── HISTORY API ──────────────────────────────────────────────────
  // Au mount, on remplace l'entrée d'historique actuelle par notre
  // state initial (pour que popstate ait quelque chose à lire si
  // l'utilisateur recharge la page et fait back).
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.history.replaceState(
      { view: initialFromUrl.view, projectId: initialFromUrl.projectId },
      "",
      stateToUrl(initialFromUrl.view, initialFromUrl.projectId)
    );

    // Écoute les events de navigation back/forward du navigateur
    // (swipe iPhone, two-finger Mac, bouton back Windows, etc.).
    const onPopState = (e) => {
      const s = e.state || urlToState(window.location.pathname);
      const newView = (s.view !== "viewer" && !isViewActive(s.view)) ? firstActiveView() : s.view;
      setView(newView);
      setProjectId(s.projectId || null);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Helper : pousse une nouvelle entrée d'historique pour les navigations
  // déclenchées en JS (clic menu, clic projet, etc.).
  function pushHistory(newView, newProjectId) {
    if (typeof window === "undefined") return;
    const url = stateToUrl(newView, newProjectId);
    // Évite de pousser un doublon si on est déjà à la même URL
    if (window.location.pathname === url) return;
    window.history.pushState({ view: newView, projectId: newProjectId }, "", url);
  }

  function navigate(v) {
    // Sécurise contre les navigations vers une page désactivée
    // (vieux liens, clic involontaire, etc.) — on redirige sur la 1ère active.
    const safeView = isViewActive(v) ? v : firstActiveView();
    setView(safeView);
    setProjectId(null);
    pushHistory(safeView, null);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function openProject(id) {
    setProjectId(id);
    setView("viewer");
    pushHistory("viewer", id);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  // Switch vers le projet suivant / précédent depuis le viewer. Appelé
  // quand l'utilisateur tape sur edge-prev/next et qu'on est déjà au
  // début / à la fin des resources du projet courant.
  function switchProject(direction) {
    if (!projectId) return;
    const idx = PROJECTS.findIndex((p) => p.id === projectId);
    if (idx === -1) return;
    const next = direction === "next"
      ? (idx + 1) % PROJECTS.length
      : (idx - 1 + PROJECTS.length) % PROJECTS.length;
    openProject(PROJECTS[next].id);
  }
  function closeViewer() {
    // Si on est arrivé au viewer via une navigation interne (donc il y a
    // une entrée d'historique précédente sur ce site), on délègue au
    // browser back — ça respecte la pile d'historique et le geste
    // "swipe right" iPhone marche naturellement. Sinon (lien direct ou
    // bookmark sur /work/xxx), on navigue vers home explicitement.
    if (typeof window !== "undefined" && window.history.state
        && window.history.state.view === "viewer") {
      window.history.back();
    } else {
      navigate("home");
    }
  }

  useEffect(() => {
    const k = (e) => { if (e.key === "Escape" && view === "viewer") closeViewer(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [view]);

  // CSS-var bag — applied at root so every layer can read it
  const cssVars = {
    "--grain-opacity": t.grainOpacity / 100,
    "--grain-size": t.grainSize + "px",
    "--bg-sepia": t.crtOn ? t.bgSepia / 100 : 0,
    "--bg-saturate": t.crtOn ? t.bgSaturate / 100 : 1,
    "--bg-contrast": t.crtOn ? t.bgContrast / 100 : 1,
    "--bg-brightness": t.crtOn ? t.bgBrightness / 100 : 1,
    "--scan-opacity": t.crtOn ? t.scanOpacity / 100 : 0,
    "--scan-gap": t.scanGap + "px",
    "--scan-thickness": t.scanThickness + "px",
    "--vignette-opacity": t.vignette / 100,
    "--bg-distort-url": t.crtOn && t.bgDistort > 0 ? "url(#crt-distort)" : "none",
  };

  return (
    <React.Fragment>
      {!booted && <BootLoader onDone={() => {
        // Mémorise dans la session pour skipper le boot aux refresh suivants
        try { sessionStorage.setItem("lgxs_booted", "1"); } catch (e) {}
        setBooted(true);
      }} />}
      <div className="app app--booted" style={cssVars}>
      <YellowCard onClick={() => navigate("home")} />
      <MenuBar view={view} onNavigate={navigate} />

      {view === "home" && (
        <React.Fragment>
          <HomeView onOpenProject={openProject} onNavigate={navigate} />
          <HomeMobile onOpenProject={openProject} />
        </React.Fragment>
      )}
      {view === "viewer" && (
        <ViewerView
          projectId={projectId}
          onClose={closeViewer}
          onSwitchProject={switchProject}
        />
      )}
      {view === "about" && <AboutView />}
      {view === "eco" && <EcoView />}

      {(view === "about" || view === "eco") && (
        <div className="page-foot">
          <button onClick={() => navigate("home")}>
            <span className="key">[X]</span> {tr("foot.back", lang)}
          </button>
          <span key={"copy-" + lang}>{tr("foot.copy", lang)}</span>
          <span key={"locs-" + lang}>{tr("foot.locs", lang)}</span>
        </div>
      )}

      <TweaksPanel title="CRT · grain">
        <TweakSection label="Background" />
        <TweakToggle label="CRT effect on"
          value={t.crtOn}
          onChange={(v) => setTweak("crtOn", v)} />
        <TweakSlider label="Sepia" value={t.bgSepia} min={0} max={100} unit="%"
          onChange={(v) => setTweak("bgSepia", v)} />
        <TweakSlider label="Saturation" value={t.bgSaturate} min={0} max={200} unit="%"
          onChange={(v) => setTweak("bgSaturate", v)} />
        <TweakSlider label="Contrast" value={t.bgContrast} min={50} max={200} unit="%"
          onChange={(v) => setTweak("bgContrast", v)} />
        <TweakSlider label="Brightness" value={t.bgBrightness} min={20} max={150} unit="%"
          onChange={(v) => setTweak("bgBrightness", v)} />
        <TweakSlider label="Distortion" value={t.bgDistort} min={0} max={30} unit="px"
          onChange={(v) => setTweak("bgDistort", v)} />

        <TweakSection label="Scanlines" />
        <TweakSlider label="Intensity" value={t.scanOpacity} min={0} max={150} unit="%"
          onChange={(v) => setTweak("scanOpacity", v)} />
        <TweakSlider label="Gap" value={t.scanGap} min={2} max={12} unit="px"
          onChange={(v) => setTweak("scanGap", v)} />
        <TweakSlider label="Thickness" value={t.scanThickness} min={1} max={6} unit="px"
          onChange={(v) => setTweak("scanThickness", v)} />

        <TweakSection label="Global grain" />
        <TweakSlider label="Grain opacity" value={t.grainOpacity} min={0} max={40} unit="%"
          onChange={(v) => setTweak("grainOpacity", v)} />
        <TweakSlider label="Grain size" value={t.grainSize} min={60} max={400} unit="px"
          onChange={(v) => setTweak("grainSize", v)} />

        <TweakSection label="Vignette" />
        <TweakSlider label="Strength" value={t.vignette} min={0} max={150} unit="%"
          onChange={(v) => setTweak("vignette", v)} />
      </TweaksPanel>

    </div>
    </React.Fragment>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
