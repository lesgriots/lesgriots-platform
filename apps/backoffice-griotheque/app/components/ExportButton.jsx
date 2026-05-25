// Bouton "Exporter vers le site" — réutilisable dans la nav du layout.
// POST /api/export → régénère apps/lagriotheque/data.jsx.
// Affiche un toast bref pour confirmer.
"use client";
import { useState } from "react";

export default function ExportButton({ variant = "nav" }) {
  const [state, setState] = useState("idle"); // idle | loading | ok | error
  const [msg, setMsg] = useState("");

  async function go(e) {
    e.preventDefault();
    setState("loading");
    setMsg("");
    try {
      const r = await fetch("/api/export", { method: "POST" });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setState("ok");
      setMsg(`✓ ${(j.bytes / 1024).toFixed(1)} Ko exportés`);
    } catch (err) {
      setState("error");
      setMsg(`✗ ${err.message}`);
    }
    // Reset après 3 secondes
    setTimeout(() => { setState("idle"); setMsg(""); }, 3000);
  }

  if (variant === "nav") {
    return (
      <a
        href="#"
        onClick={go}
        className="bo-nav__export"
        style={{
          background: state === "ok" ? "var(--ink)" :
                      state === "error" ? "var(--danger)" :
                      undefined,
          color: state === "ok" ? "var(--accent)" :
                 state === "error" ? "var(--paper)" :
                 undefined,
        }}
        title="Régénère apps/lagriotheque/data.jsx"
      >
        {state === "loading" ? "..." :
         state === "ok" ? msg :
         state === "error" ? msg :
         "↑ Exporter"}
      </a>
    );
  }

  // Variante "btn" (gros bouton, pour la home)
  return (
    <button
      className="btn"
      onClick={go}
      disabled={state === "loading"}
      title="Régénère apps/lagriotheque/data.jsx"
    >
      {state === "loading" ? "..." :
       state === "ok" ? msg :
       state === "error" ? msg :
       "↳ Exporter vers le site"}
    </button>
  );
}
