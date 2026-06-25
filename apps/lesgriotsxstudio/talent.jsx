/* global React, Type, useLang, tr, MatrixGriot */

// Page TALENT — singulier. Le studio ne représente qu'un seul talent :
// Moos Coulibaly. Calquée sur la grammaire visuelle de la page Work :
// même wrapper .ahome (fond noir + ASCII griot bottom-right), même
// look de cellule (.ahome__cell avec label typewriter au hover et vidéo
// qui joue au survol). On expose UNE cellule unique, en grand format.
//
// Pour swapper le placeholder MatrixGriot en vraie photo : poser une
// image dans img/ et la référencer via SITE_CONTENT.talent.portrait
// dans data.jsx (ou directement remplacer le <MatrixGriot /> ci-dessous).
// Vidéo hover : SITE_CONTENT.talent.hoverVideo — fallback riles-live-04.mp4.

function TalentView() {
  const lang = useLang();
  // hovered = état "actif" — pilote la photo couleur + la vidéo backdrop
  // + la taille de la cellule en mobile. Sur desktop il est piloté par
  // onMouseEnter / onMouseLeave ; sur mobile (touch) par onClick toggle.
  const [hovered, setHovered] = React.useState(false);
  const cellRef = React.useRef(null);
  const videoRef = React.useRef(null);

  // Détection : est-ce un device qui supporte vraiment le hover ?
  // - Desktop / souris → true → on branche mouseenter / mouseleave
  // - Mobile / tactile → false → on n'écoute QUE le click (toggle), sinon
  //   iOS Safari simule un faux mouseenter au 1er tap qui casserait le
  //   toggle (1er tap active, 2e tap toggle off, mais le faux mouseenter
  //   réactive aussitôt — le user voit la photo redevenir grande).
  const hasHover = React.useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) return true;
    return window.matchMedia("(hover: hover)").matches;
  }, []);

  // Pilote la vidéo : on la garde TOUJOURS dans le DOM (pour pré-charger
  // les frames dès le mount), mais on contrôle play/pause au survol pour
  // que l'effet soit instantané au 1er hover plutôt que d'attendre que la
  // vidéo se télécharge. Au mouseleave on remet à 0 pour repartir du début
  // au prochain hover (comme dans la grille Work).
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (hovered) {
      // play() peut throw NotAllowedError si autoplay policy bloque ;
      // on l'avale silencieusement car la vidéo est muted → autorisé.
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [hovered]);

  // Surcharges BO via SITE_CONTENT.talent
  const overrides =
    (typeof window !== "undefined" && window.SITE_CONTENT && window.SITE_CONTENT.talent) || {};
  const bioLines = (overrides.bio && overrides.bio[lang])
    ? overrides.bio[lang]
    : tr("talent.bio", lang);
  const hoverVideo = overrides.hoverVideo || "img/riles-live-04.mp4";
  const portraitImg = overrides.portrait || null;
  // URL du compte Instagram de Moos — utilisée pour rendre toute ligne
  // qui commence par "@" cliquable. Override possible via SITE_CONTENT.
  const instagramUrl = overrides.instagramUrl || "https://instagram.com/mooscoulibaly";

  // Cascade typewriter pour les paragraphes de bio (col droite).
  // Le typing joue UNE SEULE FOIS au montage / au changement de langue.
  // Le hover NE redéclenche PAS le typing — il ne pilote que la vidéo de
  // la cellule portrait (cf .ahome__cell--video). Pour ça, la key du Type
  // ne dépend que de la langue, jamais de `hovered`.
  // Vitesse rapide (10ms/char) parce que la bio est en prose longue —
  // à 22ms/char un paragraphe ferait 10s, ici on tient un rythme lisible
  // d'environ 5-6s pour les 2 paragraphes complets.
  const SPEED = 10;
  const GAP = 250;
  const delaysBio = (() => {
    const out = [];
    let acc = 250; // léger délai initial pour que la page apparaisse posée
    for (const line of bioLines) {
      out.push(acc);
      acc += String(line).length * SPEED + GAP;
    }
    return out;
  })();

  const NAME = "MOOS COULIBALY";
  const ROLE = tr("talent.role", lang);

  // Reproduit la cascade du label de cellule Work : NAME → ROLE.
  const labelNameDelay = 0;
  const labelRoleDelay = NAME.length * 26 + 200;

  return (
    // ahome--talent : variant qui désactive le scatter grid mais conserve
    // le wrapper (fond noir + griot bottom-right + tonalité Work).
    <div className="ahome ahome--talent">
      {/* Griot ASCII en bas-droite — IDENTIQUE à la page Work */}
      <div className="ahome__griot" aria-hidden="true">
        <MatrixGriot />
      </div>

      {/* Layout : cellule grand format + bio terminal */}
      <div className="ahome__grid ahome__grid--talent">
        {/* Cellule unique — réutilise .ahome__cell pour matcher pile Work.
            ahome__cell--single : variant qui désactive le translate jitter
            et impose la taille hero. */}
        <button
          ref={cellRef}
          type="button"
          className={
            "ahome__cell ahome__cell--single ahome__cell--video" +
            (hovered ? " is-hovered" : "")
          }
          // Desktop (hasHover true) : suivi souris classique. Sur touch on
          // ne branche PAS ces handlers — sinon iOS Safari déclenche un
          // faux mouseenter au tap qui casse le toggle.
          onMouseEnter={hasHover ? () => setHovered(true) : undefined}
          onMouseLeave={hasHover ? () => setHovered(false) : undefined}
          onFocus={hasHover ? () => setHovered(true) : undefined}
          onBlur={hasHover ? () => setHovered(false) : undefined}
          // Tap mobile = action principale → ouvre / ferme la photo.
          // Sur desktop on conserve aussi le toggle (clic complète le hover).
          onClick={() => setHovered((h) => !h)}
          aria-label={NAME}
        >
          {/* Photo de Moos.
              - Au repos : noir et blanc (filter grayscale appliqué en CSS)
              - Au hover : passe en couleur (filter: none)
              La vidéo NE joue PAS dans la cellule — elle est jouée en
              backdrop fullscreen via .ahome__bg ci-dessous, comme sur la
              grille Work. */}
          <div className="ahome__cell__rest">
            {portraitImg ? (
              <img src={portraitImg} alt={NAME} />
            ) : (
              <MatrixGriot />
            )}
          </div>

          {/* Label qui se déroule au hover — STRUCTURE IDENTIQUE à Work :
              name (haut), client (milieu), role (bas) */}
          {hovered && (
            <span className="ahome__cell__label" aria-hidden="true">
              <Type
                text={NAME}
                speed={26}
                cursor="while"
                key={"tn-" + lang + "-" + (hovered ? "1" : "0")}
              />
              <span className="ahome__cell__label__client">
                <Type
                  text={ROLE}
                  speed={26}
                  delay={labelRoleDelay}
                  cursor="always"
                  key={"tr-" + lang + "-" + (hovered ? "1" : "0")}
                />
              </span>
            </span>
          )}
        </button>

        {/* Bio — colonne droite. Typo strictement identique à la page
            About (var(--font-mono) 13px 0.08em uppercase). Cascade
            typewriter qui rejoue à chaque toggle hover/repos via la key.
            Pas de kicker "(02) — TALENT" — la bio commence directement. */}
        <aside className="talent-bio">
          <div className="talent-bio__body">
            {bioLines.map((line, i) => {
              // Technique « reserve space » : le paragraphe a sa hauteur
              // finale dès le départ (via le span .ghost qui contient le
              // texte complet en visibility: hidden), et le <Type> typewriter
              // s'écrit par-dessus en absolute. Conséquence : le bloc ne
              // bouge plus pendant le typing, seul le curseur terminal
              // se déplace. Comportement « shell » authentique.
              // Les keys n'incluent PAS `hovered` — le typing ne rejoue
              // que sur changement de langue, pas à chaque hover/leave.
              //
              // Si la ligne commence par "@", elle devient un lien
              // Instagram cliquable (handle social façon signature).
              const isHandle = typeof line === "string" && line.trim().startsWith("@");
              const inner = (
                <>
                  <span className="talent-bio__ghost" aria-hidden="true">
                    {line}
                  </span>
                  <span className="talent-bio__typed">
                    <Type
                      text={line}
                      speed={SPEED}
                      delay={delaysBio[i]}
                      cursor={i === bioLines.length - 1 ? "always" : "while"}
                      key={"bio-" + i + "-" + lang}
                    />
                  </span>
                </>
              );
              return (
                <p
                  key={lang + "-bio-" + i}
                  className={
                    "talent-bio__p" + (isHandle ? " talent-bio__p--handle" : "")
                  }
                >
                  {isHandle ? (
                    <a
                      href={instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="talent-bio__link"
                    >
                      {inner}
                    </a>
                  ) : (
                    inner
                  )}
                </p>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Backdrop fullscreen — IDENTIQUE à la page Work (.ahome__bg).
          Au hover de la cellule, la vidéo indigo-cristal-thumb prend tout
          l'écran derrière le contenu, traitée en N&B + voile + grain via
          les classes héritées de .ahome__bg. La vidéo est TOUJOURS dans
          le DOM avec preload=auto, on pilote play/pause via videoRef. */}
      <div
        className={"ahome__bg" + (hovered ? " is-active" : "")}
        aria-hidden="true"
      >
        <video
          ref={videoRef}
          className="ahome__bg__video"
          src={hoverVideo}
          muted
          loop
          playsInline
          preload="auto"
        />
        <div className="ahome__bg__grain"></div>
        <div className="ahome__bg__veil"></div>
      </div>
    </div>
  );
}

window.TalentView = TalentView;
