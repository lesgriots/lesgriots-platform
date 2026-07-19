// Pages du site : gère QUELLE page est servie aux visiteurs sur lesgriots.com.
// Une seule page active à la fois. Quand la page d'attente est active, le
// site complet est totalement invisible (les fichiers internes sont bloqués
// par nginx — snippet lesgriots-pages.conf).
"use client";
import { useEffect, useState } from "react";
import { BP } from "../../lib/bp.js";

const PAGES = [
  {
    mode: "coming-soon",
    name: "Page d'attente",
    tag: "attente.live.html (export du BO)",
    desc: "Vidéo d'accueil + grain + logo, et l'About qui monte au scroll. Rien d'autre n'est visible : les URLs internes répondent 404.",
  },
  {
    mode: "live",
    name: "Site complet",
    tag: "site.live.html (export du BO)",
    desc: "Hero vidéo, Index, pages projets, About, Shop, Archive — la dernière version exportée via Sync.",
  },
];

export default function SiteModePage() {
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [kind, setKind] = useState("ok");

  useEffect(() => {
    fetch(`${BP}/api/site-mode`)
      .then((r) => r.json())
      .then((j) => setMode(j.mode || "coming-soon"))
      .catch(() => setMode("coming-soon"));
  }, []);

  async function apply(next) {
    if (busy || next === mode) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch(`${BP}/api/site-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setMode(j.mode);
      setMsg(`✓ ${j.note} En ligne immédiatement.`);
      setKind("ok");
    } catch (e) {
      setMsg(`✗ ${e.message}`);
      setKind("err");
    }
    setBusy(false);
  }

  return (
    <>
      <h1>pages du <em>site</em></h1>
      <p className="note" style={{ marginTop: -8, marginBottom: 20 }}>
        Une seule page est servie aux visiteurs de lesgriots.com. La page
        inactive est <strong>totalement invisible</strong> — même en tapant son
        URL directe. La bascule est instantanée.
      </p>

      {mode === null ? (
        <p className="note">Chargement…</p>
      ) : (
        <div className="projlib" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {PAGES.map((p) => {
            const active = mode === p.mode;
            return (
              <div
                key={p.mode}
                className="projcard"
                style={{
                  padding: "20px 22px",
                  borderColor: active ? "var(--yellow)" : "var(--rule)",
                  boxShadow: active ? "0 0 0 2px rgba(241,184,31,0.25)" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div className="bo-navgroup__title" style={{ border: "none", padding: 0 }}>
                    {p.tag}
                  </div>
                  {active && <span className="pill" style={{ color: "var(--yellow)", borderColor: "var(--yellow)" }}>active</span>}
                </div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 26, margin: "8px 0 6px", color: active ? "var(--yellow)" : "var(--ink)" }}>
                  {p.name}
                </div>
                <p className="note" style={{ marginBottom: 16 }}>{p.desc}</p>
                {active ? (
                  <a className="btn btn--ghost" href="https://lesgriots.com" target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-block", textDecoration: "none" }}>
                    Voir en ligne ↗
                  </a>
                ) : (
                  <button className="btn" disabled={busy} onClick={() => apply(p.mode)}>
                    {busy ? "…" : "Activer cette page"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="note" style={{ marginTop: 18 }}>
        Le site complet publié est la dernière version <strong>exportée</strong> :
        après des modifs de contenu, clique « ↑ Sync vers le site » pour
        régénérer (publication immédiate si le site complet est actif).
      </p>

      {msg && (
        <p className="note" style={{ marginTop: 10, color: kind === "err" ? "var(--danger)" : "var(--accent)" }}>{msg}</p>
      )}
    </>
  );
}
