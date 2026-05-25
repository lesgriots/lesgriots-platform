/* global React */
// Terminal-style typewriter — types text char by char with blinking caret

function Type({ text = "", speed = 20, delay = 0, cursor = "while", className, as = "span" }) {
  // When `window.__skipType` is set (e.g. during a binarize-driven language
  // swap), Type renders the full text immediately and skips the typewriter.
  const skip = typeof window !== "undefined" && window.__skipType;
  const [out, setOut] = React.useState(skip ? text : "");
  // `started` flips to true once the initial delay has elapsed.
  // We don't show the caret before that, so cascaded Types don't all
  // display a caret at the same time while waiting their turn.
  const [started, setStarted] = React.useState(skip || delay === 0);

  React.useEffect(() => {
    if (typeof window !== "undefined" && window.__skipType) {
      setOut(text);
      setStarted(true);
      return;
    }
    setOut("");
    setStarted(delay === 0);
    let i = 0;
    let interval;
    const start = setTimeout(() => {
      setStarted(true);
      interval = setInterval(() => {
        i++;
        if (i > text.length) {
          clearInterval(interval);
        } else {
          setOut(text.slice(0, i));
        }
      }, speed);
    }, delay);
    return () => {
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [text, speed, delay]);

  const done = out === text;
  const showCaret = started && (cursor === "always" || (cursor === "while" && !done));
  const C = as;
  return (
    <C className={className}>
      {out}
      {showCaret && <span className="caret">█</span>}
    </C>
  );
}

window.Type = Type;
