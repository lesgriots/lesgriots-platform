/* global React, MatrixGriot */
// Boot loader — Matrix-style ASCII griot + LOADING qui se tape en terminal.
// Auto-dismisses dès que LOADING est entièrement écrit.
// Skip au clic ou à une touche.

const LOADING_WORD = "LOADING";
const TYPE_SPEED = 70; // ms par lettre — 7 lettres × 70 ≈ 490ms (rapide)
// Durée MIN d'affichage du boot : 3000ms (cosmétique, pour laisser
// l'anim LOADING se dérouler entièrement quel que soit l'état réel
// du chargement).
const MIN_DURATION = 3000;
// Durée MAX d'affichage : 8000ms — safety net pour éviter le hang
// sur connexion très lente. Au-delà, on dismiss même si window.load
// n'a pas encore fired.
const MAX_DURATION = 8000;

function BootLoader({ onDone }) {
  const [leaving, setLeaving] = React.useState(false);
  // Texte qui se construit lettre par lettre, style terminal
  const [typed, setTyped] = React.useState("");

  const dismiss = React.useCallback(() => {
    setLeaving((prev) => {
      if (prev) return prev;
      setTimeout(() => onDone && onDone(), 600);
      return true;
    });
  }, [onDone]);

  // Tape LOADING lettre par lettre — comportement terminal pur.
  React.useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      if (i > LOADING_WORD.length) {
        clearInterval(id);
        return;
      }
      setTyped(LOADING_WORD.slice(0, i));
    }, TYPE_SPEED);
    return () => clearInterval(id);
  }, []);

  // Smart dismiss : on attend la PLUS LONGUE des deux conditions :
  //   - MIN_DURATION (3s, cosmétique)
  //   - window.load (toutes les ressources critiques chargées)
  // Avec un max de MAX_DURATION (8s) en safety net.
  // Si window.load a déjà fired (document.readyState === "complete"),
  // on planifie juste le dismiss à MIN_DURATION.
  React.useEffect(() => {
    const startTime = Date.now();
    let dismissTimer = null;
    let safetyTimer = null;

    const scheduleDismiss = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_DURATION - elapsed);
      dismissTimer = setTimeout(dismiss, remaining);
    };

    // Si toutes les ressources sont déjà chargées (cache hot), on
    // planifie direct le dismiss au min cosmétique.
    if (document.readyState === "complete") {
      scheduleDismiss();
    } else {
      // Sinon on attend window.load, qui fire quand TOUTES les ressources
      // (CSS, JS, images, iframes) ont fini de charger.
      window.addEventListener("load", scheduleDismiss, { once: true });
    }

    // Safety net : dismiss forcé à MAX_DURATION, même si window.load
    // n'a pas fired (connexion très lente, ressource bloquée, etc.)
    safetyTimer = setTimeout(dismiss, MAX_DURATION);

    return () => {
      window.removeEventListener("load", scheduleDismiss);
      if (dismissTimer) clearTimeout(dismissTimer);
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, [dismiss]);

  React.useEffect(() => {
    const onKey = (e) => { e.preventDefault(); dismiss(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss]);

  const done = typed === LOADING_WORD;

  return (
    <div
      className={"boot-matrix" + (leaving ? " is-leaving" : "")}
      aria-hidden={leaving}
      onClick={dismiss}
      role="button"
      tabIndex={0}>
      {/* Backdrop : film grain animé + veil radial.
          La vidéo de fond (riles-survival.mp4) a été retirée le 2026-06-13
          à la demande de Moos — on garde uniquement les couches grain et
          veil pour conserver la même atmosphère sans la vidéo. */}
      <div className="boot-matrix__bg" aria-hidden="true">
        <div className="boot-matrix__bg__grain" />
        <div className="boot-matrix__bg__veil" />
      </div>
      <MatrixGriot />
      <div className="boot-matrix__loading" aria-hidden="true">
        <span className="boot-matrix__loading__prompt">&gt;&nbsp;</span>
        {/* Stabilisation horizontale : on rend toujours la pleine largeur
            de "LOADING" (les lettres pas encore tapées sont en placeholder
            visibility: hidden), MAIS le caret se positionne juste après
            la dernière lettre tapée → il se décale au fur et à mesure
            sans déplacer le bloc entier. */}
        <span className="boot-matrix__loading__word">
          <span className="boot-matrix__loading__visible">{typed}</span>
          <span className="boot-matrix__loading__caret">█</span>
          <span
            className="boot-matrix__loading__placeholder"
            aria-hidden="true"
          >
            {LOADING_WORD.slice(typed.length)}
          </span>
        </span>
      </div>
      {/* Sticker retiré du boot — il vient se placer à sa position
          finale (.idcard, top-left de la page Work) une fois le boot
          dismissé. Le cross-fade naturel du boot leaving + apparition
          de la page sous-jacente donne l'effet "sticker qui apparaît
          à sa place". */}
    </div>
  );
}

window.BootLoader = BootLoader;
