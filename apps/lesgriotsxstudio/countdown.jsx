/* global React, Type, MatrixGriot, useLang, tr, setLang */
// Page compte à rebours (pré-lancement du site Studio).
// Reprend la charte + la mise en page de la page About (about-min) et son
// DESCRIPTIF (clé i18n about.intro, bilingue EN/FR), avec switch de langue.
// Griot ASCII dans le coin. À l'heure H → bascule automatique vers le site.
//
// Cible : lundi 13 juillet 2026, 18h00 (Paris, CEST = UTC+2).
// Prévisualiser le vrai site avant l'heure : ajouter #preview à l'URL.
// Changer la date sans toucher au code : window.SITE_CONFIG.launchAt (ISO).

(function () {
  const { useState, useEffect } = React;

  const LAUNCH_AT_DEFAULT = new Date("2026-07-13T18:00:00+02:00").getTime();

  function launchTarget() {
    if (typeof window !== "undefined" && window.SITE_CONFIG && window.SITE_CONFIG.launchAt) {
      const t = new Date(window.SITE_CONFIG.launchAt).getTime();
      if (!Number.isNaN(t)) return t;
    }
    return LAUNCH_AT_DEFAULT;
  }

  function isPreview() {
    if (typeof window === "undefined") return false;
    return /(?:^|[#?&])preview\b/i.test(window.location.hash + window.location.search);
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  // Switch de langue FR/EN (le menu du site n'est pas monté sur le compteur).
  function LangSwitch() {
    const lang = useLang();
    return (
      <div className="lx-cd__lang">
        <button
          type="button"
          className={lang === "en" ? "is-active" : ""}
          onClick={() => setLang("en")}
        >EN</button>
        <span className="lx-cd__lang__sep">/</span>
        <button
          type="button"
          className={lang === "fr" ? "is-active" : ""}
          onClick={() => setLang("fr")}
        >FR</button>
      </div>
    );
  }

  // Descriptif = celui de la page About (about.intro), dans la langue courante.
  // Surchargeable via le back office (window.SITE_CONTENT.aboutIntro).
  function IntroBlock() {
    const lang = useLang();
    const T = (typeof window !== "undefined" && window.Type) || null;
    const override = (typeof window !== "undefined" && window.SITE_CONTENT && window.SITE_CONTENT.aboutIntro)
      ? window.SITE_CONTENT.aboutIntro[lang]
      : null;
    const intro = (Array.isArray(override) && override.length) ? override : tr("about.intro", lang);
    const speed = 22;
    return (
      <section className="about-min__intro">
        {intro.map((t, i) => {
          const prev = intro.slice(0, i).reduce((a, s) => a + s.length * speed + 250, 0);
          return (
            <p key={lang + "-" + i}>
              {T
                ? <T text={t} speed={speed} delay={prev} cursor={i === intro.length - 1 ? "always" : "while"} key={lang + "-" + i} />
                : t}
            </p>
          );
        })}
      </section>
    );
  }

  // Timer autonome (se met à jour seul, sans re-typer l'intro).
  function Timer({ target }) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
      const id = setInterval(() => setNow(Date.now()), 250);
      return () => clearInterval(id);
    }, []);

    let diff = Math.max(0, target - now);
    const day = Math.floor(diff / 86400000); diff -= day * 86400000;
    const hr = Math.floor(diff / 3600000); diff -= hr * 3600000;
    const min = Math.floor(diff / 60000); diff -= min * 60000;
    const sec = Math.floor(diff / 1000);

    // Labels bilingues simples pour les unités.
    const L = unitLabels();
    const arr = [
      { v: day, l: L.days },
      { v: hr, l: L.hours },
      { v: min, l: L.min },
      { v: sec, l: L.sec },
    ];

    return (
      <div className="lx-cd__timer">
        {arr.map((u, i) => (
          <div className="lx-cd__unit" key={i}>
            <span className="lx-cd__num">{pad(u.v)}</span>
            <span className="lx-cd__lab">{u.l}</span>
          </div>
        ))}
      </div>
    );
  }

  function unitLabels() {
    const lang = (typeof window !== "undefined" && window.getLang && window.getLang()) || "fr";
    return lang === "en"
      ? { days: "days", hours: "hours", min: "min", sec: "sec" }
      : { days: "jours", hours: "heures", min: "min", sec: "sec" };
  }

  function Countdown({ target }) {
    const lang = useLang(); // ré-render la colonne timer sur changement de langue
    const Mg = (typeof window !== "undefined" && window.MatrixGriot) || null;
    const heading = lang === "en" ? "countdown" : "compte à rebours";
    return (
      <div className="about-min lx-cd" role="dialog" aria-label="Bientôt en ligne">
        <img src="img/sticker.png" alt="lesgriotsxstudio" className="lx-cd__sticker" aria-hidden="true" />
        <LangSwitch />

        <IntroBlock />

        <section className="about-min__col">
          <h6>{heading}</h6>
          <Timer target={target} />
        </section>

        <section className="about-min__col">
          <h6>contact</h6>
          <p className="about-min__person">
            <a href="mailto:studio@lesgriots.com">studio@lesgriots.com</a>
          </p>
          <p className="about-min__person">
            <a href="https://www.instagram.com/lesgriotsxstudio" target="_blank" rel="noopener noreferrer">@lesgriotsxstudio</a>
          </p>
        </section>

        {Mg ? (
          <div className="about-min__griot lx-cd__griot" aria-hidden="true"><Mg /></div>
        ) : null}
      </div>
    );
  }

  // Le compte à rebours s'affiche UNIQUEMENT si le back office l'a activé
  // (window.SITE_CONTENT.activePages.countdown === true). Sinon → site normal.
  function countdownEnabled() {
    if (typeof window === "undefined") return false;
    const ap = (window.SITE_CONTENT && window.SITE_CONTENT.activePages) || {};
    return ap.countdown === true;
  }

  function LaunchGate({ children }) {
    const target = launchTarget();
    // live = on montre le SITE (pas le compteur) si : preview, compteur
    // désactivé au BO, ou l'heure H est passée (bascule auto).
    const [live, setLive] = useState(() => isPreview() || !countdownEnabled() || Date.now() >= target);

    useEffect(() => {
      if (live) return undefined;
      const id = setInterval(() => {
        if (Date.now() >= target || !countdownEnabled()) { setLive(true); clearInterval(id); }
      }, 250);
      return () => clearInterval(id);
    }, [live, target]);

    return live ? children : <Countdown target={target} />;
  }

  if (typeof window !== "undefined") {
    window.LaunchGate = LaunchGate;
    window.StudioCountdown = Countdown;
  }
})();
