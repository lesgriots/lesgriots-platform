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

// ── Simulation du rendu sur le site ──────────────────────────────────────
// Reproduit fidèlement comment le clip (sélection + cadrage) apparaîtra dans
// un contexte du site : cellule de la grille Work au hover, fond plein écran
// au hover, carte de la grille mobile. Le crop est simulé mathématiquement :
// le clip généré fera iw/zoom × ih/zoom centré sur (cx, cy), affiché en
// object-fit cover dans le conteneur → on positionne la vidéo SOURCE en
// absolu à la taille / position équivalentes.
//   VwPct = zoom × max(1, A/C) × 100   (A = ratio vidéo, C = ratio conteneur)
//   VhPct = zoom × max(1, C/A) × 100
//   left  = 50% − cx × VwPct ;  top = 50% − cy × VhPct
function SitePreview({ label, width, cellAspect, videoAR, cropRatio, wFrac, hFrac, cx, cy, previewSrc, start, end, videoFilter, containerFilter, veil, extraScale = 1, note, onPan, onAdopt }) {
  const vRef = useRef(null);
  const boxRef = useRef(null);
  // Drag DIRECT dans la preview : on convertit le déplacement du pointeur
  // en fraction de l'image source et on remonte au parent (onPan), qui
  // met à jour cx/cy — le cadre principal et les autres previews suivent.
  const dragRef = useRef(null);
  function panDown(e) {
    if (!onPan && !onAdopt) return;
    e.preventDefault();
    dragRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    // Rien à recadrer (format Original, zoom 1) mais cette vue CROPPE la
    // vidéo (cover) → on adopte son format : le cadrage devient possible
    // immédiatement, le drag en cours continue.
    if (!onPan && onAdopt) onAdopt(C);
  }
  function panMove(e) {
    const d = dragRef.current;
    if (!d || !onPan || !boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    const dcx = -(e.clientX - d.x) / (r.width * (VwPct / 100));
    const dcy = -(e.clientY - d.y) / (r.height * (VhPct / 100));
    dragRef.current = { x: e.clientX, y: e.clientY };
    onPan(dcx, dcy);
  }
  function panUp() { dragRef.current = null; }
  // Boucle la lecture dans [start, end], comme le fera le clip généré.
  useEffect(() => {
    const v = vRef.current;
    if (!v) return;
    const onTU = () => {
      if (end > start && (v.currentTime >= end || v.currentTime < start - 0.05)) {
        v.currentTime = start;
        if (v.paused) v.play().catch(() => {});
      }
    };
    v.addEventListener("timeupdate", onTU);
    return () => v.removeEventListener("timeupdate", onTU);
  }, [start, end]);
  // Nouvelle sélection → repart du début de l'extrait.
  useEffect(() => {
    const v = vRef.current;
    if (v && v.readyState >= 1) {
      v.currentTime = start;
      v.play().catch(() => {});
    }
  }, [start, end]);

  // Le clip généré aura le ratio R (format device ou ratio source) et sera
  // affiché en object-fit cover dans un conteneur de ratio C. La vidéo
  // SOURCE est positionnée pour que la zone croppée (fractions visibles
  // wFrac × hFrac, centrée sur cx/cy) occupe exactement la place du clip.
  const A = videoAR || 16 / 9;
  const R = cropRatio || A;
  const C = cellAspect || R;
  const wf = wFrac ?? 1;
  const hf = hFrac ?? 1;
  const VwPct = (extraScale * Math.max(1, R / C) * 100) / wf;
  const VhPct = (extraScale * Math.max(1, C / R) * 100) / hf;
  const leftPct = 50 - (cx ?? 0.5) * VwPct;
  const topPct = 50 - (cy ?? 0.5) * VhPct;

  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ fontSize: 9, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>{label}</div>
      <div
        ref={boxRef}
        onPointerDown={panDown}
        onPointerMove={panMove}
        onPointerUp={panUp}
        onPointerCancel={panUp}
        style={{
          position: "relative", width, aspectRatio: `${C}`, overflow: "hidden",
          background: "#000", border: "1px solid var(--rule)",
          filter: containerFilter || "none",
          cursor: (onPan || onAdopt) ? "grab" : "default",
          touchAction: (onPan || onAdopt) ? "none" : "auto",
          userSelect: "none",
        }}
      >
        <video
          ref={vRef}
          src={previewSrc}
          muted
          playsInline
          autoPlay
          style={{
            position: "absolute",
            width: `${VwPct}%`,
            height: `${VhPct}%`,
            left: `${leftPct}%`,
            top: `${topPct}%`,
            maxWidth: "none",
            objectFit: "fill",
            filter: videoFilter || "none",
            pointerEvents: "none",
          }}
        />
        {veil && (
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.7) 100%)", pointerEvents: "none" }} />
        )}
      </div>
      {note && <div style={{ fontSize: 9, color: "var(--dim)", marginTop: 2, maxWidth: width }}>{note}</div>}
    </div>
  );
}

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
  // Affichage des previews "rendu sur le site" (hover PC / fond / mobile).
  const [showRender, setShowRender] = useState(false);
  // ── Recadrage ──
  // zoom ≥ 1 ; (cx, cy) = centre du cadrage en fraction de l'image (0..1).
  // Le ratio de sortie = ratio source (le site affiche la thumb en cover,
  // n'importe quel ratio marche) ; le crop fait iw/zoom × ih/zoom.
  const [vidAR, setVidAR] = useState(16 / 9);
  // CADRAGES INDÉPENDANTS par cible : chaque vue du site (miniature de la
  // grille, fond plein écran, carte mobile) a son propre zoom/format/centre.
  // La cible ACTIVE est celle que le cadre principal, le slider de zoom et
  // les chips Format pilotent — et celle que « Générer » produit.
  const [activeKind, setActiveKind] = useState("cell");
  const [crops, setCrops] = useState({
    cell:   { zoom: 1, ratio: null, cx: 0.5, cy: 0.5 },
    bg:     { zoom: 1, ratio: null, cx: 0.5, cy: 0.5 },
    mobile: { zoom: 1, ratio: null, cx: 0.5, cy: 0.5 },
  });
  const updateCrop = (kind, patch) =>
    setCrops((m) => ({ ...m, [kind]: { ...m[kind], ...patch } }));
  const [panning, setPanning] = useState(false);

  // Fractions VISIBLES de l'image source dans le cadrage (largeur/hauteur).
  // R = ratio cible, A = ratio source :
  //   wFrac = min(1, R/A)/zoom ; hFrac = min(1, A/R)/zoom
  const fracs = (z, Rr, A) => ({
    wFrac: Math.min(1, Rr / A) / z,
    hFrac: Math.min(1, A / Rr) / z,
  });
  const clampAxis = (c, frac) => Math.max(frac / 2, Math.min(1 - frac / 2, c));
  const fracsFor = (kind) => {
    const k = crops[kind];
    return fracs(k.zoom, k.ratio || vidAR, vidAR);
  };

  function applyZoom(zRaw) {
    const z = Math.max(1, Math.min(MAX_ZOOM, zRaw));
    const k = crops[activeKind];
    const f = fracs(z, k.ratio || vidAR, vidAR);
    updateCrop(activeKind, {
      zoom: z,
      cx: clampAxis(k.cx, f.wFrac),
      cy: clampAxis(k.cy, f.hFrac),
    });
  }

  function applyRatio(Rr) {
    const k = crops[activeKind];
    const f = fracs(k.zoom, Rr || vidAR, vidAR);
    updateCrop(activeKind, {
      ratio: Rr,
      cx: clampAxis(k.cx, f.wFrac),
      cy: clampAxis(k.cy, f.hFrac),
    });
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
    if (canPan) setPanning(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function cropPointerMove(e) {
    const p = panRef.current;
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) p.moved = true;
    if (!canPan || !cropRef.current) return;
    const r = cropRef.current.getBoundingClientRect();
    // La vidéo affichée fait r.width / wFrac px de large → déplacer le
    // pointeur de dx px = déplacer le centre de dx × wFrac / r.width
    // (en fraction de l'image source).
    updateCrop(activeKind, {
      cx: clampAxis(p.cx - (dx * wFrac) / r.width, wFrac),
      cy: clampAxis(p.cy - (dy * hFrac) / r.height, hFrac),
    });
  }
  // Pan piloté depuis une preview : ne modifie QUE le cadrage de SA cible,
  // et rend cette cible active (le cadre principal bascule dessus).
  function panKind(kind, dcx, dcy) {
    setActiveKind(kind);
    setCrops((m) => {
      const k = m[kind];
      const f = fracs(k.zoom, k.ratio || vidAR, vidAR);
      return { ...m, [kind]: { ...k, cx: clampAxis(k.cx + dcx, f.wFrac), cy: clampAxis(k.cy + dcy, f.hFrac) } };
    });
  }
  // Drag dans une vue qui croppe alors que sa cible n'a aucun cadrage →
  // on adopte le format du conteneur de cette vue (ex. 16:9 pour le fond)
  // et le recadrage démarre dans le même geste.
  function adoptKind(kind, C) {
    setActiveKind(kind);
    const target = Math.abs(C - vidAR) < 0.01 ? null : C;
    setCrops((m) => {
      const k = m[kind];
      if ((k.ratio || null) === target) return m;
      const f = fracs(k.zoom, target || vidAR, vidAR);
      return { ...m, [kind]: { ...k, ratio: target, cx: clampAxis(k.cx, f.wFrac), cy: clampAxis(k.cy, f.hFrac) } };
    });
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

  // Géométrie du cadre principal : dérivée du cadrage de la CIBLE ACTIVE.
  const { zoom, ratio: cropAR, cx, cy } = crops[activeKind];
  const R = cropAR || vidAR;
  const { wFrac, hFrac } = fracs(zoom, R, vidAR);
  const canPan = wFrac < 0.999 || hFrac < 0.999;
  const cropVwPct = 100 / wFrac;
  const cropVhPct = 100 / hFrac;
  const cropLeftPct = 50 - cx * cropVwPct;
  const cropTopPct = 50 - cy * cropVhPct;
  const canPanFor = (kind) => {
    const f = fracsFor(kind);
    return f.wFrac < 0.999 || f.hFrac < 0.999;
  };

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
    // marge disponible, dérivée du centre (cx). `ratio` = format device
    // choisi (le clip généré aura ce ratio).
    const k = crops[activeKind];
    const fg = fracs(k.zoom, k.ratio || vidAR, vidAR);
    const crop = (k.zoom > 1.01 || k.ratio) ? {
      zoom: k.zoom,
      ratio: k.ratio || undefined,
      px: fg.wFrac < 0.999 ? (k.cx - fg.wFrac / 2) / (1 - fg.wFrac) : 0.5,
      py: fg.hFrac < 0.999 ? (k.cy - fg.hFrac / 2) / (1 - fg.hFrac) : 0.5,
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
        onTrimmed(j.path, activeKind);
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

      {/* ── Cible du cadrage : chaque vue du site a SON cadrage propre ── */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.1em", flexShrink: 0 }}>Cadrage pour</span>
        {[["cell", "Miniature"], ["bg", "Fond hover"], ["mobile", "Mobile"]].map(([k, lbl]) => (
          <button
            key={k}
            type="button"
            className="btn btn--ghost"
            onClick={() => setActiveKind(k)}
            style={{
              padding: "2px 10px", fontSize: 11,
              ...(activeKind === k ? { background: "var(--accent)", color: "#000", borderColor: "var(--accent)" } : {}),
            }}
          >
            {lbl}{(crops[k].zoom > 1.01 || crops[k].ratio) ? " ✂" : ""}
          </button>
        ))}
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
          width: "auto",
          height: 240,
          maxWidth: "100%",
          aspectRatio: `${R}`,
          margin: "0 auto",
          background: "#000",
          border: "1px solid var(--rule)",
          overflow: "hidden",
          touchAction: "none",
          userSelect: "none",
          cursor: canPan ? (panning ? "grabbing" : "grab") : "pointer",
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
            position: "absolute",
            width: `${cropVwPct}%`,
            height: `${cropVhPct}%`,
            left: `${cropLeftPct}%`,
            top: `${cropTopPct}%`,
            maxWidth: "none",
            objectFit: "fill",
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

      {/* ── Format de cadrage (device) ──────────────────────────────────── */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.1em", flexShrink: 0 }}>Format</span>
        {[
          { label: "Original", v: null },
          { label: "16:9 · PC", v: 16 / 9 },
          { label: "9:16 · Mobile", v: 9 / 16 },
          { label: "1:1 · Carré", v: 1 },
          { label: "4:5 · Feed", v: 4 / 5 },
        ].map((f) => (
          <button
            key={f.label}
            type="button"
            data-ratio={f.label}
            className="btn btn--ghost"
            onClick={() => applyRatio(f.v)}
            style={{
              padding: "2px 8px",
              fontSize: 11,
              ...(cropAR === f.v ? { background: "var(--accent)", color: "#000", borderColor: "var(--accent)" } : {}),
            }}
          >
            {f.label}
          </button>
        ))}
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
        {(zoom > 1.001 || cropAR) && (
          <button type="button" className="btn btn--ghost" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => updateCrop(activeKind, { zoom: 1, ratio: null, cx: 0.5, cy: 0.5 })}>
            ⟲ Réinitialiser
          </button>
        )}
      </div>
      {canPan && (
        <p className="note" style={{ margin: "4px 0 0", fontSize: 10, color: "var(--dim)" }}>
          Glisse l'image dans le cadre pour choisir le cadrage — il sera appliqué à la boucle générée{cropAR ? ` (format ${cropAR > 1 ? "paysage" : cropAR === 1 ? "carré" : "portrait"})` : ""}.
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

      {/* ── Rendu sur le site : hover PC (cellule + fond) et mobile ────── */}
      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          className="btn btn--ghost"
          data-render-toggle
          style={{ padding: "4px 10px", fontSize: 11 }}
          onClick={() => setShowRender((s) => !s)}
        >
          {showRender ? "✕ Masquer le rendu sur le site" : "👁 Voir le rendu sur le site (hover PC + mobile)"}
        </button>
        {showRender && (
          <>
            <div data-render-previews style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
              {(() => {
                const kindProps = (kind) => {
                  const k = crops[kind];
                  const f = fracsFor(kind);
                  return {
                    cropRatio: k.ratio || vidAR,
                    wFrac: f.wFrac, hFrac: f.hFrac,
                    cx: k.cx, cy: k.cy,
                    onPan: canPanFor(kind) ? (dx, dy) => panKind(kind, dx, dy) : null,
                    onAdopt: (C) => adoptKind(kind, C),
                    active: activeKind === kind,
                  };
                };
                return (
                  <>
                    <SitePreview
                      label={"Hover PC — cellule grille" + (activeKind === "cell" ? " ●" : "")}
                      width={170}
                      cellAspect={crops.cell.ratio || vidAR}
                      videoAR={vidAR}
                      {...kindProps("cell")}
                      previewSrc={previewSrc} start={start} end={end}
                      videoFilter="grayscale(0.4) contrast(1.1)"
                      extraScale={1.04}
                    />
                    <SitePreview
                      label={"Hover PC — fond plein écran" + (activeKind === "bg" ? " ●" : "")}
                      width={300}
                      cellAspect={16 / 9}
                      videoAR={vidAR}
                      {...kindProps("bg")}
                      previewSrc={previewSrc} start={start} end={end}
                      containerFilter="grayscale(1) contrast(1.1) brightness(0.6)"
                      veil
                    />
                    <SitePreview
                      label={"Mobile — carte grille" + (activeKind === "mobile" ? " ●" : "")}
                      width={110}
                      cellAspect={crops.mobile.ratio || vidAR}
                      videoAR={vidAR}
                      {...kindProps("mobile")}
                      previewSrc={previewSrc} start={start} end={end}
                      videoFilter="grayscale(1) contrast(1.05) brightness(0.95)"
                      note="au tap : grayscale(0.3)"
                    />
                  </>
                );
              })()}
            </div>
            <p className="note" style={{ margin: "6px 0 0", fontSize: 10, color: "var(--dim)" }}>
              Simulation fidèle des filtres du site (N&B, voile, scale hover) avec ta sélection et ton cadrage.
              NB : la grille mobile joue la 1ère ressource vidéo du projet, pas la thumb — rendu identique si c'est la même vidéo.
            </p>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" className="btn btn--ghost" style={{ padding: "6px 14px", fontSize: 12 }} onClick={previewSelection} disabled={!(end > start)}>
          {playing ? "⏸ Pause" : "▶ Prévisualiser l'extrait"}
        </button>
        <button type="button" className="btn" style={{ padding: "6px 14px", fontSize: 12 }} onClick={generate} disabled={busy || !(end > start)}>
          {busy ? "Découpage…" : `✂ Générer (${activeKind === "bg" ? "fond hover" : activeKind === "mobile" ? "mobile" : "miniature"})`}
        </button>
        {msg && <span className="note" style={{ color: ok ? "var(--accent)" : "var(--danger)" }}>{msg}</span>}
      </div>
    </div>
  );
}
