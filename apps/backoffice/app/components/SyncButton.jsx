// Bouton "Sync vers le site" réutilisable dans la nav du layout.
// POST /api/export → régénère apps/lesgriotsxstudio/data.jsx + bump du cache.
// Présent sur TOUTES les pages du BO (placé dans le menu).
"use client";
import { useState } from "react";

export default function SyncButton() {
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
      setMsg(`✓ ${typeof j.count === "number" ? j.count + " projets · " : ""}site à jour`);
    } catch (err) {
      setState("error");
      setMsg(`✗ ${err.message}`);
    }
    setTimeout(() => { setState("idle"); setMsg(""); }, 3500);
  }

  return (
    <a
      href="#"
      onClick={go}
      title="Régénère le site (data.jsx) et rafraîchit le cache"
      style={{
        background: state === "error" ? "var(--danger)" : "var(--yellow)",
        color: state === "error" ? "#fff" : "#000",
        padding: "4px 12px",
        fontWeight: 700,
        fontSize: "11px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {state === "loading" ? "..." : state === "idle" ? "↑ Sync vers le site" : msg}
    </a>
  );
}
