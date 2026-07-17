// Mode du site : bascule entre la page d'attente (coming-soon) et le site complet.
// POST /api/site-mode → échange index.html (attente.html ↔ site.html) côté site.
"use client";
import { useEffect, useState } from "react";

export default function SiteModePage() {
  const [mode, setMode] = useState(null);   // "coming-soon" | "live" | null (chargement)
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [kind, setKind] = useState("ok");

  useEffect(() => {
    fetch("/api/site-mode")
      .then((r) => r.json())
      .then((j) => setMode(j.mode || "coming-soon"))
      .catch(() => setMode("coming-soon"));
  }, []);

  async function apply(next) {
    if (busy || next === mode) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/site-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setMode(j.mode);
      setMsg(`✓ ${j.note} — pense à redéployer le site.`);
      setKind("ok");
    } catch (e) {
      setMsg(`✗ ${e.message}`);
      setKind("err");
    }
    setBusy(false);
  }

  const isLive = mode === "live";

  return (
    <>
      <h1>mode du site</h1>
      <p className="note" style={{ marginTop: -8, marginBottom: 20 }}>
        Bascule ce que voient les visiteurs à la racine. Le site complet est
        toujours préservé dans <code>site.html</code>, la page d'attente dans
        <code> attente.html</code>. Après bascule, <strong>redéploie</strong> le
        dossier <code>apps/lesgriots</code> sur le VPS.
      </p>

      {mode === null ? (
        <p className="note">Chargement…</p>
      ) : (
        <>
          <div className="projlib" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            <button
              type="button"
              onClick={() => apply("coming-soon")}
              className="projcard"
              style={{
                textAlign: "left", padding: "18px 20px", cursor: "pointer",
                borderColor: !isLive ? "var(--yellow)" : "var(--rule)",
                boxShadow: !isLive ? "0 0 0 2px rgba(246,226,28,0.25)" : "none",
              }}
            >
              <div className="bo-navgroup__title" style={{ border: "none", padding: 0, marginBottom: 8 }}>
                Page d'attente {!isLive && "· actif"}
              </div>
              <div style={{ fontSize: 22, color: !isLive ? "var(--yellow)" : "var(--ink)" }}>Coming soon</div>
              <div className="note" style={{ marginTop: 6 }}>Juste le logo, plein largeur en bas.</div>
            </button>

            <button
              type="button"
              onClick={() => apply("live")}
              className="projcard"
              style={{
                textAlign: "left", padding: "18px 20px", cursor: "pointer",
                borderColor: isLive ? "var(--yellow)" : "var(--rule)",
                boxShadow: isLive ? "0 0 0 2px rgba(246,226,28,0.25)" : "none",
              }}
            >
              <div className="bo-navgroup__title" style={{ border: "none", padding: 0, marginBottom: 8 }}>
                Site complet {isLive && "· actif"}
              </div>
              <div style={{ fontSize: 22, color: isLive ? "var(--yellow)" : "var(--ink)" }}>En ligne</div>
              <div className="note" style={{ marginTop: 6 }}>Hero vidéo, anim, Index, panneaux.</div>
            </button>
          </div>

          <p className="note" style={{ marginTop: 18 }}>
            État actuel : <strong style={{ color: "var(--yellow)" }}>{isLive ? "Site complet en ligne" : "Page d'attente"}</strong>
            {busy && " · bascule en cours…"}
          </p>
        </>
      )}

      {msg && (
        <p className="note" style={{ color: kind === "err" ? "var(--danger)" : "var(--accent)" }}>{msg}</p>
      )}
    </>
  );
}
