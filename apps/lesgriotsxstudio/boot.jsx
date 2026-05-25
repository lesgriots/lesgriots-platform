/* global React, MatrixGriot */
// Boot loader — Matrix-style ASCII griot + LOADING qui se tape en terminal.
// Auto-dismisses dès que LOADING est entièrement écrit.
// Skip au clic ou à une touche.

const LOADING_WORD = "LOADING";
const TYPE_SPEED = 110; // ms par lettre

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
  // Quand le mot est complet, on attend une demi-seconde puis on dismiss.
  React.useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i++;
      if (i > LOADING_WORD.length) {
        clearInterval(id);
        // Laisse 500ms pour que l'utilisateur voie le mot complet
        setTimeout(dismiss, 500);
        return;
      }
      setTyped(LOADING_WORD.slice(0, i));
    }, TYPE_SPEED);
    return () => clearInterval(id);
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
      <MatrixGriot />
      <div className="boot-matrix__loading" aria-hidden="true">
        <span className="boot-matrix__loading__prompt">&gt;&nbsp;</span>
        {typed}
        <span className="boot-matrix__loading__caret">█</span>
        {done && <span className="boot-matrix__loading__dots"><span>.</span><span>.</span><span>.</span></span>}
      </div>
      <img
        className="boot-matrix__sticker"
        src="img/sticker.png"
        alt=""
        aria-hidden="true"
      />
    </div>
  );
}

window.BootLoader = BootLoader;
