// Découpeur « sélectionne + boucle » — composant partagé.
// Utilisé par :
//   - /site/ecosysteme (vidéo de fond des univers)
//   - ProjectForm (thumb video des projets = hover grille Work + fond overlay INFORMATION)
// On charge la vidéo source (déjà sous img/), l'utilisateur choisit les bornes
// début/fin, prévisualise la sélection en boucle, puis génère un clip .mp4
// web-optimisé via POST /api/trim. Le champ pointe ensuite sur le clip découpé.
"use client";
import { useState, useRef } from "react";

// Formate un nombre de secondes en timecode lisible m:ss.d (dixièmes).
function fmtTC(s) {
  if (!Number.isFinite(s) || s < 0) return "0:00.0";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const d = Math.floor((s * 10) % 10);
  return `${m}:${String(sec).padStart(2, "0")}.${d}`;
}

export default function VideoTrimmer({ src, previewSrc, onTrimmed }) {
  const vidRef = useRef(null);
  const [dur, setDur] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [cur, setCur] = useState(0);
  const [loopPreview, setLoopPreview] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(true);

  // Métadonnées chargées → on connaît la durée, sélection = clip entier par défaut.
  function onMeta() {
    const d = vidRef.current?.duration || 0;
    setDur(d);
    setStart(0);
    setEnd(d);
  }

  // À chaque frame lue : maintient la lecture dans [start, end] si la boucle est active.
  function onTimeUpdate() {
    const v = vidRef.current;
    if (!v) return;
    setCur(v.currentTime);
    if (loopPreview && end > start && (v.currentTime >= end || v.currentTime < start - 0.05)) {
      v.currentTime = start;
      if (v.paused) v.play().catch(() => {});
    }
  }

  function setStartHere() {
    const t = vidRef.current?.currentTime ?? 0;
    setStart(Math.max(0, Math.min(t, end - 0.2)));
  }
  function setEndHere() {
    const t = vidRef.current?.currentTime ?? dur;
    setEnd(Math.min(dur, Math.max(t, start + 0.2)));
  }
  function playSelection() {
    const v = vidRef.current;
    if (!v) return;
    v.currentTime = start;
    v.play().catch(() => {});
  }

  async function generate() {
    if (!(end > start)) { setMsg("La fin doit être après le début."); setOk(false); return; }
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/trim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src, start, end }),
      });
      const j = await r.json().catch(() => ({}));
      setBusy(false);
      if (r.ok && j.path) {
        const mb = j.bytes ? (j.bytes / 1048576).toFixed(1) : "?";
        setMsg(`✓ Boucle générée (${(end - start).toFixed(1)}s · ${mb} Mo). Le champ pointe désormais sur le clip découpé.`);
        setOk(true);
        onTrimmed(j.path);
      } else {
        setMsg(`✗ ${j.error || `échec (${r.status})`}`);
        setOk(false);
      }
    } catch (e) { setBusy(false); setMsg(`✗ ${e.message}`); setOk(false); }
  }

  const selLen = Math.max(0, end - start);
  const pctStart = dur ? (start / dur) * 100 : 0;
  const pctEnd = dur ? (end / dur) * 100 : 0;
  const pctCur = dur ? (cur / dur) * 100 : 0;

  return (
    <div style={{ marginTop: 10, padding: 12, border: "1px solid var(--rule)", background: "#0b0a09" }}>
      <div style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
        Découpeur — sélectionne un segment, génère une boucle web
      </div>

      <video
        ref={vidRef}
        src={previewSrc}
        muted
        playsInline
        controls
        onLoadedMetadata={onMeta}
        onTimeUpdate={onTimeUpdate}
        style={{ width: "100%", maxHeight: 220, background: "#000", border: "1px solid var(--rule)" }}
      />

      {/* Barre de sélection : zone retenue surlignée + tête de lecture. */}
      <div style={{ position: "relative", height: 8, background: "var(--rule)", margin: "10px 0 4px", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pctStart}%`, width: `${Math.max(0, pctEnd - pctStart)}%`, background: "var(--accent)", opacity: 0.55 }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pctCur}%`, width: 2, background: "var(--ink)" }} />
      </div>

      <div className="row" style={{ marginTop: 6 }}>
        <div>
          <label style={{ fontSize: 10 }}>Début — {fmtTC(start)}</label>
          <input type="range" min={0} max={dur || 0} step={0.1} value={start}
            onChange={(e) => setStart(Math.min(Number(e.target.value), end - 0.2))} style={{ width: "100%" }} />
        </div>
        <div>
          <label style={{ fontSize: 10 }}>Fin — {fmtTC(end)}</label>
          <input type="range" min={0} max={dur || 0} step={0.1} value={end}
            onChange={(e) => setEnd(Math.max(Number(e.target.value), start + 0.2))} style={{ width: "100%" }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
        <button type="button" className="btn btn--ghost" style={{ padding: "4px 10px", fontSize: 11 }} onClick={setStartHere}>⇤ Début = ici</button>
        <button type="button" className="btn btn--ghost" style={{ padding: "4px 10px", fontSize: 11 }} onClick={setEndHere}>Fin = ici ⇥</button>
        <button type="button" className="btn btn--ghost" style={{ padding: "4px 10px", fontSize: 11 }} onClick={playSelection}>▶ Lire la sélection</button>
        <label style={{ fontSize: 11, color: "var(--dim)", display: "flex", alignItems: "center", gap: 4 }}>
          <input type="checkbox" checked={loopPreview} onChange={(e) => setLoopPreview(e.target.checked)} /> boucle
        </label>
        <span className="note" style={{ marginLeft: "auto" }}>Segment : <strong>{selLen.toFixed(1)}s</strong></span>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
        <button type="button" className="btn" style={{ padding: "6px 14px", fontSize: 12 }} onClick={generate} disabled={busy || !(end > start)}>
          {busy ? "Découpage…" : "✂ Générer la boucle"}
        </button>
        {msg && <span className="note" style={{ color: ok ? "var(--accent)" : "var(--danger)" }}>{msg}</span>}
      </div>
    </div>
  );
}
