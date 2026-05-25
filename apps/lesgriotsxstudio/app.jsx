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

function App() {
  // La vue initiale respecte les pages actives définies dans le back office.
  // Si la page Work a été désactivée, on tombe sur About (ou Eco).
  const [view, setView] = useState(firstActiveView);
  const [projectId, setProjectId] = useState(null);
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [booted, setBooted] = useState(false);
  const lang = useLang();

  function navigate(v) {
    // Sécurise contre les navigations vers une page désactivée
    // (vieux liens, clic involontaire, etc.) — on redirige sur la 1ère active.
    setView(isViewActive(v) ? v : firstActiveView());
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function openProject(id) {
    setProjectId(id);
    setView("viewer");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function closeViewer() { setView(isViewActive("home") ? "home" : firstActiveView()); }

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
      {!booted && <BootLoader onDone={() => setBooted(true)} />}
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
        <ViewerView projectId={projectId} onClose={closeViewer} />
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
