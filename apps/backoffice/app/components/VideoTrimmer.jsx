// Découpeur « sélectionne + boucle » — composant partagé, UX façon Instagram.
// Utilisé par :
//   - /site/ecosysteme (vidéo de fond des univers)
//   - ProjectForm (thumb video des projets = hover grille Work + fond overlay INFORMATION)
//
// Principe (comme le trim des Reels Instagram) :
//   - une FILMSTRIP de vignettes extraites de la vidéo sert de timeline
//   - une fenêtre de sélection avec 2 poignées se drag directement dessus :
//       · poignée gauche / droite → ajuste début / fin (scrub en direct)
//       · drag au milieu → déplace toute la fenêtre (durée conservée)
//   - la vidéo au-dessus joue la sélection en boucle
//   - « Générer la boucle » → POST /api/trim (ffmpeg) → le champ pointe
//     sur le clip découpé.
"use client";
import { useState, useRef, useEffect } from "react";

// Formate un nombre de secondes en timecode lisible m:ss.d (dixièmes).
function fmtTC(s) {
  if (!Number.isFinite(s) || s < 0) return "0:00.0";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const d = Math.floor((s * 10) % 10);
  return `${m}:${String(sec).padStart(2, "0")}.${d}`;
}

const THUMBS = 12;      // nb de vignettes de la filmstrip
const MIN_LEN = 0.2;    // durée mini de la sélection (s)
const HANDLE_W = 14;    // largeur px des poignées

export default function VideoTrimmer({ src, previewSrc, onTrimmed }) {
  const vidRef = useRef(null);
  const stripRef = useRef(null);
  // Drag en cours : { mode: "start"|"end"|"move", grabOffset } — dans une ref
  // pour ne pas re-render à chaque pointermove (on met à jour start/end, qui
  // eux re-render).
  const dragRef = useRef(null);
  const [dur, setDur] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [cur, setCur] = useState(0);
  const [thumbs, setThumbs] = useState([]);       // dataURLs des vignettes
  const [thumbsBusy, setThumbsBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(true);
  // État lecture, synchronisé sur l'élément <video> (onPlay/onPause) pour
  // que le bouton Prévisualiser reflète toujours la réalité.
  const [playing, setPlaying] = useState(false);

  // Métadonnées chargées → durée connue, sélection = clip entier par défaut.
  function onMeta() {
    const d = vidRef.current?.duration || 0;
    setDur(d);
    setStart(0);
    setEnd(d);
  }

  // ── Filmstrip : extraction des vignettes ────────────────────────────────
  // Vidéo cachée dédiée (pour ne pas toucher la lecture de la preview) :
  // on seek THUMBS positions réparties sur la durée et on dessine chaque
  // frame dans un canvas → dataURL. Même origine (/api/preview) → pas de
  // souci de canvas "tainted".
  useEffect(() => {
    let cancelled = false;
    setThumbs([]);
    if (!previewSrc) return;
    setThumbsBusy(true);
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = previewSrc;
    const canvas = document.createElement("canvas");

    const seekTo = (t) => new Promise((res) => {
      const done = () => { v.removeEventListener("seeked", done); res(); };
      v.addEventListener("seeked", done);
      v.currentTime = t;
    });

    (async () => {
      await new Promise((res, rej) => {
        v.addEventListener("loadedmetadata", res, { once: true });
        v.addEventListener("error", rej, { once: true });
      }).catch(() => {});
      const d = v.duration || 0;
      if (!d || cancelled) { setThumbsBusy(false); return; }
      const ratio = (v.videoWidth || 16) / (v.videoHeight || 9);
      canvas.height = 96;
      canvas.width = Math.max(32, Math.round(96 * ratio));
      const ctx = canvas.getContext("2d");
      const out = [];
      for (let i = 0; i < THUMBS; i++) {
        if (cancelled) return;
        // centre de chaque tranche → vignette représentative de la zone
        const t = ((i + 0.5) / THUMBS) * d;
        try {
          await seekTo(Math.min(t, Math.max(0, d - 0.05)));
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          out.push(canvas.toDataURL("image/jpeg", 0.6));
        } catch { out.push(null); }
        if (!cancelled) setThumbs([...out]); // affichage progressif
      }
      if (!cancelled) setThumbsBusy(false);
      v.removeAttribute("src");
      v.load();
    })();

    return () => { cancelled = true; v.removeAttribute("src"); v.load(); };
  }, [previewSrc]);

  // ── Lecture : boucle dans [start, end] ──────────────────────────────────
  function onTimeUpdate() {
    const v = vidRef.current;
    if (!v) return;
    setCur(v.currentTime);
    // Pas de rebouclage pendant un drag (on laisse le scrub tranquille).
    if (!dragRef.current && end > start && (v.currentTime >= end || v.currentTime < start - 0.05)) {
      v.currentTime = start;
      if (v.paused) v.play().catch(() => {});
    }
  }

  // ── Drag façon Instagram ────────────────────────────────────────────────
  const timeAtX = (clientX) => {
    const r = stripRef.current?.getBoundingClientRect();
    if (!r || !dur) return 0;
    return Math.max(0, Math.min(dur, ((clientX - r.left) / r.width) * dur));
  };

  function scrub(t) {
    const v = vidRef.current;
    if (!v) return;
    if (!v.paused) v.pause();
    v.currentTime = t;
    setCur(t);
  }

  function beginDrag(e, mode) {
    e.preventDefault();
    e.stopPropagation();
    const t = timeAtX(e.clientX);
    dragRef.current = { mode, grabOffset: mode === "move" ? t - start : 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function onDragMove(e) {
    const drag = dragRef.current;
    if (!drag) return;
    const t = timeAtX(e.clientX);
    if (drag.mode === "start") {
      const ns = Math.min(t, end - MIN_LEN);
      setStart(Math.max(0, ns));
      scrub(Math.max(0, ns));
    } else if (drag.mode === "end") {
      const ne = Math.max(t, start + MIN_LEN);
      setEnd(Math.min(dur, ne));
      scrub(Math.min(dur, ne));
    } else {
      // move : fenêtre entière, durée conservée
      const len = end - start;
      let ns = t - drag.grabOffset;
      ns = Math.max(0, Math.min(ns, dur - len));
      setStart(ns);
      setEnd(ns + len);
      scrub(ns);
    }
  }

  function endDrag() {
    if (!dragRef.current) return;
    dragRef.current = null;
    // Fin de drag → on relit la sélection depuis le début (feedback immédiat).
    const v = vidRef.current;
    if (v) {
      v.currentTime = startRef.current;
      v.play().catch(() => {});
    }
  }
  // start dans une ref pour endDrag (qui vit hors du cycle de render).
  const startRef = useRef(start);
  useEffect(() => { startRef.current = start; }, [start]);

  // Tap sur la strip hors fenêtre → recale la fenêtre centrée sur le tap.
  function onStripPointerDown(e) {
    const t = timeAtX(e.clientX);
    if (t >= start && t <= end) return; // dans la fenêtre → géré par la fenêtre
    const len = Math.min(end - start, dur);
    let ns = Math.max(0, Math.min(t - len / 2, dur - len));
    setStart(ns);
    setEnd(ns + len);
    scrub(ns);
    dragRef.current = { mode: "move", grabOffset: t - ns };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  // Prévisualise l'extrait : repart du DÉBUT de la sélection et joue en
  // boucle (le rebouclage est assuré par onTimeUpdate). Si déjà en lecture,
  // met en pause.
  function previewSelection() {
    const v = vidRef.current;
    if (!v) return;
    if (!v.paused) { v.pause(); return; }
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

  const handleStyle = (side) => ({
    position: "absolute",
    top: 0,
    bottom: 0,
    [side]: 0,
    width: HANDLE_W,
    background: "var(--accent)",
    cursor: "ew-resize",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    touchAction: "none",
  });
  const gripStyle = {
    width: 2, height: 16, background: "rgba(0,0,0,0.55)", borderRadius: 1,
  };

  return (
    <div style={{ marginTop: 10, padding: 12, border: "1px solid var(--rule)", background: "#0b0a09" }}>
      <div style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
        Découpeur — fais glisser la fenêtre sur la timeline, la sélection tourne en boucle
      </div>

      <video
        ref={vidRef}
        src={previewSrc}
        muted
        playsInline
        autoPlay
        onLoadedMetadata={onMeta}
        onTimeUpdate={onTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={() => { const v = vidRef.current; if (!v) return; v.paused ? v.play().catch(() => {}) : v.pause(); }}
        style={{ width: "100%", maxHeight: 220, background: "#000", border: "1px solid var(--rule)", cursor: "pointer" }}
      />

      {/* ── Filmstrip + fenêtre de sélection (style Instagram) ─────────── */}
      <div
        ref={stripRef}
        onPointerDown={onStripPointerDown}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          position: "relative",
          height: 48,
          margin: "10px 0 4px",
          background: "#141210",
          border: "1px solid var(--rule)",
          overflow: "hidden",
          touchAction: "none",
          userSelect: "none",
          cursor: "pointer",
        }}
      >
        {/* vignettes */}
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          {Array.from({ length: THUMBS }).map((_, i) => (
            thumbs[i]
              // eslint-disable-next-line @next/next/no-img-element
              ? <img key={i} src={thumbs[i]} alt="" draggable={false} style={{ flex: 1, minWidth: 0, height: "100%", objectFit: "cover", pointerEvents: "none" }} />
              : <div key={i} style={{ flex: 1, background: "#1a1815", borderRight: "1px solid #0b0a09" }} />
          ))}
        </div>
        {thumbsBusy && thumbs.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--dim)", letterSpacing: "0.1em" }}>
            GÉNÉRATION DE LA TIMELINE…
          </div>
        )}

        {/* voiles sombres hors sélection */}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${pctStart}%`, background: "rgba(5,5,5,0.72)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pctEnd}%`, right: 0, background: "rgba(5,5,5,0.72)", pointerEvents: "none" }} />

        {/* fenêtre de sélection */}
        <div
          onPointerDown={(e) => beginDrag(e, "move")}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${pctStart}%`,
            width: `${Math.max(0, pctEnd - pctStart)}%`,
            border: "2px solid var(--accent)",
            boxSizing: "border-box",
            cursor: "grab",
            touchAction: "none",
          }}
        >
          <div onPointerDown={(e) => beginDrag(e, "start")} style={handleStyle("left")}><span style={gripStyle} /></div>
          <div onPointerDown={(e) => beginDrag(e, "end")} style={handleStyle("right")}><span style={gripStyle} /></div>
        </div>

        {/* tête de lecture */}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pctCur}%`, width: 2, background: "var(--ink)", pointerEvents: "none" }} />
      </div>

      {/* timecodes sous la strip */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--dim)", fontVariantNumeric: "tabular-nums" }}>
        <span>début <strong style={{ color: "var(--ink)" }}>{fmtTC(start)}</strong></span>
        <span>segment <strong style={{ color: "var(--accent)" }}>{selLen.toFixed(1)}s</strong></span>
        <span>fin <strong style={{ color: "var(--ink)" }}>{fmtTC(end)}</strong> / {fmtTC(dur)}</span>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" className="btn btn--ghost" style={{ padding: "6px 14px", fontSize: 12 }} onClick={previewSelection} disabled={!(end > start)}>
          {playing ? "⏸ Pause" : "▶ Prévisualiser l'extrait"}
        </button>
        <button type="button" className="btn" style={{ padding: "6px 14px", fontSize: 12 }} onClick={generate} disabled={busy || !(end > start)}>
          {busy ? "Découpage…" : "✂ Générer la boucle"}
        </button>
        {msg && <span className="note" style={{ color: ok ? "var(--accent)" : "var(--danger)" }}>{msg}</span>}
      </div>
    </div>
  );
}
