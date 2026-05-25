// Typewriter component — anime un texte caractère par caractère avec un
// curseur clignotant. Reprend l'effet terminal du site studio.
"use client";
import { useEffect, useState } from "react";

export default function Type({
  text,
  speed = 22,         // ms par caractère
  delay = 0,          // ms d'attente avant de commencer à taper
  cursor = "while",   // "while" = caret pendant le typing puis disparaît
                      // "always" = caret reste après
                      // "never"  = pas de caret
}) {
  const full = text || "";
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(delay === 0);

  // Délai initial avant de démarrer
  useEffect(() => {
    if (delay <= 0) return;
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  // Tape les caractères un par un
  useEffect(() => {
    if (!started) return;
    if (count >= full.length) return;
    const t = setTimeout(() => setCount((c) => c + 1), speed);
    return () => clearTimeout(t);
  }, [started, count, full.length, speed]);

  const done = count >= full.length;
  const showCaret = cursor === "always" || (cursor === "while" && !done);

  return (
    <>
      {full.slice(0, count)}
      {showCaret && <span className="bo-caret">█</span>}
    </>
  );
}
