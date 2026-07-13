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
//   - RECADRAGE : slider de zoom + drag de l'image dans le cadre pour
//     choisir le cadrage (grille des tiers pendant le drag). Le crop est
//     appliqué par ffmpeg à la génération.
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
const MAX_ZOOM = 4;

export default function VideoTrimmer({ src, previewSrc, onTrimmed }) {
  const vidRef = useRef(null);
  const stripRef = useRef(null);
  const cropRef = useRef(null);
  // Drag timeline en cours : { mode: "start"|"end"|"move", grabOffset } — dans
  // une ref pour ne pas re-render à chaque pointermove.
  const dragRef = useRef(null);
  // Pan du recadrage en cours : { x, y, cx, cy, moved }.
  const panRef = useRef(null);
  const [dur, setDur] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [cur, setCur] = useState(0);
  const [thumbs, setThumbs] = useState([]);       // dataURLs des vignettes
  const [thumbsBusy, setThumbsBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(true);
  // État lecture, synchronisé sur l'élément <video> (onPlay/onPause).
  const [playing, setPlaying] = useState(false);
  // ── Recadrage ──
  // zoom ≥ 1 ; (cx, cy) = centre du cadrage en fraction de l'image (0..1).
  // Le ratio de sortie = ratio source (le site affiche la thumb en cover,
  // n'importe quel ratio marche) ; le crop fait iw/zoom × ih/zoom.
  const [vidAR, setVidAR] = useState(16 / 9);
  const [zoom, setZoom] = useState(1);
  const [cx, setCx] = useState(0.5);
  const [cy, setCy] = useState(0.5);
  const [panning, setPanning] = useState(false);

  const clampC = (c, z) => Math.max(1 / (2 * z), Math.min(1 - 1 / (2 * z), c));

  function applyZoom(zRaw) {
    const z = Math.max(1, Math.min(MAX_ZOOM, zRaw));
    setZoom(z);
    setCx((c) => clampC(c, z));
    setCy((c) => clampC(c, z));
  }

  // Métadonnées chargées → durée connue, sélection = clip entier par défaut.
  function onMeta() {
    const v = vidRef.current;
    const d = v?.duration || 0;
    setDur(d);
    setStart(0);
    setEnd(d);
    if (v?.videoWidth && v?.videoHeight) setVidAR(v.videoWidth / v.videoHeight);
  }

  // ── Filmstrip : extraction des vignettes ────────────────────────────────
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
    if (!dragRef.current && end > start && (v.currentTime >= end || v.currentTime < start - 0.05)) {
      v.currentTime = start;
      if (v.paused) v.play().catch(() => {});
    }
  }

  // ── Recadrage : pan de l'image dans le cadre ───────────────────────────
  function cropPointerDown(e) {
    e.preventDefault();
    panRef.current = { x: e.clientX, y: e.clientY, cx, cy, moved: false };
    if (zoom > 1.001) setPanning(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function cropPointerMove(e) {
    const p = panRef.current;
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) p.moved = true;
    if (zoom <= 1.001 || !cropRef.current) return;
    const r = cropRef.current.getBoundingClientRect();
    // Déplacer le doigt de r.width px = traverser toute la LARGEUR VISIBLE,
    // soit 1/zoom de l'image → dcx = dx / (width * zoom).
    setCx(clampC(p.cx - dx / (r.width * zoom), zoom));
    setCy(clampC(p.cy - dy / (r.height * zoom), zoom));
  }
  function cropPointerUp() {
    const p = panRef.current;
    panRef.current = null;
    setPanning(false);
    // Simple clic (pas un drag) → toggle lecture, comme avant.
    if (p && !p.moved) {
      const v = vidRef.current;
      if (v) { v.paused ? v.play().catch(() => {}) : v.pause(); }
    }
  }

  // Transform CSS de la preview : translate PUIS scale (ordre droite→gauche
  // en CSS) pour amener le centre (cx, cy) au centre du cadre.
  const tx = (0.5 - cx) * 100;
  const ty = (0.5 - cy) * 100;

  // ── Drag timeline façon Instagram ───────────────────────────────────────
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
    const v = vidRef.current;
    if (v) {
      v.currentTime = startRef.current;
      v.play().catch(() => {});
    }
  }
  const startRef = useRef(start);
  useEffect(() => { startRef.current = start; }, [start]);

  // Tap sur la strip hors fenêtre → recale la fenêtre centrée sur le tap.
  function onStripPointerDown(e) {
    const t = timeAtX(e.clientX);
    if (t >= start && t <= end) return;
    const len = Math.min(end - start, dur);
    let ns = Math.max(0, Math.min(t - len / 2, dur - len));
    setStart(ns);
    setEnd(ns + len);
    scrub(ns);
    dragRef.current = { mode: "move", grabOffset: t - ns };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  // Prévisualise l'extrait : repart du DÉBUT de la sélection, boucle assurée
  // par onTimeUpdate. Si déjà en lecture, met en pause.
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
    // Recadrage → fractions de position du crop (0..1) pour ffmpeg :
    // x = (iw - ow) * px. px = position du bord gauche du crop dans la
    // marge disponible, dérivée du centre (cx).
    const crop = zoom > 1.01 ? {
      zoom,
      px: (cx - 1 / (2 * zoom)) / (1 - 1 / zoom),
      py: (cy - 1 / (2 * zoom)) / (1 - 1 / zoom),
    } : undefined;
    try {
      const r = await fetch("/api/trim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src, start, end, crop }),
      });
      const j = await r.json().catch(() => ({}));
      setBusy(false);
      if (r.ok && j.path) {
        const mb = j.bytes ? (j.bytes / 1048576).toFixed(1) : "?";
        setMsg(`✓ Boucle générée (${(end - start).toFixed(1)}s${crop ? ` · zoom ${zoom.toFixed(1)}×` : ""} · ${mb} Mo). Le champ pointe désormais sur le clip découpé.`);
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
  const thirdLine = (axis, pct) => ({
    position: "absolute",
    ...(axis === "v"
      ? { top: 0, bottom: 0, left: `${pct}%`, width: 1 }
      : { left: 0, right: 0, top: `${pct}%`, height: 1 }),
    background: "rgba(232,226,214,0.35)",
    pointerEvents: "none",
  });

  return (
    <div style={{ marginTop: 10, padding: 12, border: "1px solid var(--rule)", background: "#0b0a09" }}>
      <div style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
        Découpeur — fenêtre = extrait · zoom + glisser l'image = cadrage
      </div>

      {/* ── Cadre de recadrage : la vidéo bouge dedans (zoom + pan) ────── */}
      <div
        ref={cropRef}
        data-cropbox
        onPointerDown={cropPointerDown}
        onPointerMove={cropPointerMove}
        onPointerUp={cropPointerUp}
        onPointerCancel={cropPointerUp}
        style={{
          position: "relative",
          width: "100%",
          maxHeight: 240,
          aspectRatio: `${vidAR}`,
          margin: "0 auto",
          background: "#000",
          border: "1px solid var(--rule)",
          overflow: "hidden",
          touchAction: "none",
          userSelect: "none",
          cursor: zoom > 1.001 ? (panning ? "grabbing" : "grab") : "pointer",
        }}
      >
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
          draggable={false}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "contain",
            transform: `scale(${zoom}) translate(${tx}%, ${ty}%)`,
            pointerEvents: "none",
          }}
        />
        {/* Grille des tiers pendant le pan (repère de cadrage, façon IG) */}
        {panning && (
          <>
            <div style={thirdLine("v", 33.33)} />
            <div style={thirdLine("v", 66.66)} />
            <div style={thirdLine("h", 33.33)} />
            <div style={thirdLine("h", 66.66)} />
          </>
        )}
        {zoom > 1.001 && (
          <span style={{ position: "absolute", top: 4, right: 6, fontSize: 10, color: "var(--ink)", background: "rgba(5,5,5,0.6)", padding: "1px 6px", letterSpacing: "0.08em", pointerEvents: "none" }}>
            {zoom.toFixed(1)}×
          </span>
        )}
      </div>

      {/* ── Zoom / recadrage ────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
        <span style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.1em", flexShrink: 0 }}>Zoom</span>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.05}
          value={zoom}
          onChange={(e) => applyZoom(Number(e.target.value))}
          style={{ flex: 1 }}
          aria-label="Zoom du cadrage"
        />
        <span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", width: 34, textAlign: "right" }}>{zoom.toFixed(1)}×</span>
        {zoom > 1.001 && (
          <button type="button" className="btn btn--ghost" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => { setZoom(1); setCx(0.5); setCy(0.5); }}>
            ⟲ Réinitialiser
          </button>
        )}
      </div>
      {zoom > 1.001 && (
        <p className="note" style={{ margin: "4px 0 0", fontSize: 10, color: "var(--dim)" }}>
          Glisse l'image dans le cadre pour choisir le cadrage — il sera appliqué à la boucle générée.
        </p>
      )}

      {/* ── Filmstrip + fenêtre de sélection (style Instagram) ─────────── */}
      <div
        ref={stripRef}
        data-strip
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
