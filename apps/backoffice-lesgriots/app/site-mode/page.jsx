// Pages du site : UN SEUL site lesgriots.com, dont on allume/éteint les pages.
// - Mode maître : "Site en ligne" (navigable) ou "En attente" (home verrouillée,
//   vidéo + logo + « Bientôt », rien d'autre).
// - Interrupteurs par page : une page éteinte disparaît du menu.
// Toute bascule sauvegarde l'état puis régénère index.html (export). Plus de
// fichier « attente » séparé : le fichier publié porte son propre état.
"use client";
import { useEffect, useState } from "react";
import { BP } from "../../lib/bp.js";

const PAGE_META = [
  { key: "archive", name: "Archive", desc: "L'entrée « Archive » du menu (l'index des projets). Le retour à l'index par le logo reste possible." },
  { key: "about", name: "About", desc: "Le texte de présentation, la phrase « We tell stories in any medium » et l'écran des trois sites." },
  { key: "boutique", name: "Boutique", desc: "La boutique (Shop) et ses fiches produits." },
];

export default function SiteModePage() {
  const [mode, setMode] = useState(null);
  const [pages, setPages] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [kind, setKind] = useState("ok");

  useEffect(() => {
    fetch(`${BP}/api/site-mode`)
      .then((r) => r.json())
      .then((j) => { setMode(j.mode || "attente"); setPages(j.pages || {}); })
      .catch(() => { setMode("attente"); setPages({}); });
  }, []);

  // Sauvegarde l'état puis republie (export → index.html).
  async function persistAndPublish(next) {
    setBusy(true); setMsg("");
    try {
      const r = await fetch(`${BP}/api/site-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setMode(j.mode); setPages(j.pages);
      const e = await fetch(`${BP}/api/export`, { method: "POST" });
      const ej = await e.json();
      if (ej.error) throw new Error(ej.error);
      setMsg(`✓ ${ej.note} En ligne immédiatement.`);
      setKind("ok");
    } catch (e) {
      setMsg(`✗ ${e.message}`);
      setKind("err");
    }
    setBusy(false);
  }

  function setMasterMode(next) {
    if (busy || next === mode) return;
    persistAndPublish({ mode: next });
  }

  function togglePage(key) {
    if (busy) return;
    const next = { ...pages, [key]: !pages[key] };
    setPages(next); // optimiste
    persistAndPublish({ pages: next });
  }

  if (mode === null) return <p className="note">Chargement…</p>;

  const live = mode === "live";

  return (
    <>
      <h1>pages du <em>site</em></h1>
      <p className="note" style={{ marginTop: -8, marginBottom: 20 }}>
        Un seul site. Ici tu choisis s'il est <strong>en ligne</strong> ou{" "}
        <strong>en attente</strong>, et tu allumes ou éteins chaque page. Une page
        éteinte disparaît du menu. Chaque changement est publié tout de suite.
      </p>

      {/* Mode maître */}
      <div className="projlib" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {[
          { m: "attente", name: "En attente", desc: "Seule la home (vidéo + logo + « Bientôt ») est visible. Le reste du site est inaccessible." },
          { m: "live", name: "Site en ligne", desc: "Le site est navigable : menu, Index, pages, et les pages actives ci-dessous." },
        ].map((p) => {
          const active = mode === p.m;
          return (
            <div key={p.m} className="projcard" style={{
              padding: "20px 22px",
              borderColor: active ? "var(--yellow)" : "var(--rule)",
              boxShadow: active ? "0 0 0 2px rgba(241,184,31,0.25)" : "none",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div className="bo-navgroup__title" style={{ border: "none", padding: 0 }}>{p.m === "live" ? "site.live.html" : "mode attente"}</div>
                {active && <span className="pill" style={{ color: "var(--yellow)", borderColor: "var(--yellow)" }}>actif</span>}
              </div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 26, margin: "8px 0 6px", color: active ? "var(--yellow)" : "var(--ink)" }}>{p.name}</div>
              <p className="note" style={{ marginBottom: 16 }}>{p.desc}</p>
              {active
                ? <a className="btn btn--ghost" href="https://lesgriots.com" target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", textDecoration: "none" }}>Voir en ligne ↗</a>
                : <button className="btn" disabled={busy} onClick={() => setMasterMode(p.m)}>{busy ? "…" : "Activer"}</button>}
            </div>
          );
        })}
      </div>

      {/* Interrupteurs par page */}
      <h2 style={{ marginTop: 32, marginBottom: 6, fontFamily: "var(--font-serif)", fontWeight: 400 }}>Pages du menu</h2>
      <p className="note" style={{ marginTop: 0, marginBottom: 16 }}>
        {live
          ? "Allume ou éteins chaque page. Éteinte = retirée du menu."
          : "Le site est en attente : ces réglages s'appliqueront dès que tu le repasses en ligne."}
      </p>
      <div className="projlib" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", opacity: live ? 1 : 0.5 }}>
        {PAGE_META.map((p) => {
          const on = pages[p.key] !== false;
          return (
            <div key={p.key} className="projcard" style={{ padding: "18px 20px", borderColor: on ? "var(--yellow)" : "var(--rule)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: on ? "var(--ink)" : "var(--muted, #888)" }}>{p.name}</div>
                <button className={on ? "btn" : "btn btn--ghost"} disabled={busy} onClick={() => togglePage(p.key)} style={{ minWidth: 96 }}>
                  {busy ? "…" : on ? "Activée" : "Éteinte"}
                </button>
              </div>
              <p className="note" style={{ marginTop: 10, marginBottom: 0 }}>{p.desc}</p>
            </div>
          );
        })}
      </div>

      {msg && <p className="note" style={{ marginTop: 16, color: kind === "err" ? "var(--danger)" : "var(--accent)" }}>{msg}</p>}
    </>
  );
}
