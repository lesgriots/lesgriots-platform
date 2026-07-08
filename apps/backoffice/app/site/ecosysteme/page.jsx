// Éditeur de la page Écosystème du site studio (les 3 univers / planètes).
// Stocké en DB sous la clé "ecosystem" = { lesgriots:{…}, lesgriotsxstudio:{…}, lagriotheque:{…} }
// Chaque univers : kicker FR/EN, url, description FR/EN, et 3 médias
// (poster = fond au survol, preview = screenshot dans le terminal, videoSrc = vidéo de fond).
// La géométrie des orbites reste technique (non éditable ici).
"use client";
import { useEffect, useState, useRef } from "react";
import Type from "../../components/Type";

// Les 3 univers (ids figés, alignés sur ecosysteme.jsx) + valeurs par défaut
// = ce qui est actuellement codé en dur sur le site, pour pré-remplir l'éditeur.
const UNIVERSES = [
  {
    id: "lesgriots", name: "LES GRIOTS",
    kickerFr: "PLATEFORME ÉDITORIALE", kickerEn: "EDITORIAL PLATFORM",
    url: "https://lesgriots.com",
    descFr: "Plateforme éditoriale dédiée aux récits inattendus de l'Afrique et de ses diasporas. Une parole ancienne, une voix nouvelle.",
    descEn: "Editorial platform devoted to the untold stories of Africa and its diasporas. An ancient voice, a new century.",
    poster: "img/p-monument.jpg", preview: "img/preview-lesgriots.png", videoSrc: "img/indigo-cristal-thumb.mp4",
  },
  {
    id: "lesgriotsxstudio", name: "LESGRIOTSxSTUDIO",
    kickerFr: "AGENCE CRÉATIVE", kickerEn: "CREATIVE STUDIO",
    url: "https://lesgriotsxstudio.com",
    descFr: "Studio créatif : stratégie narrative, direction artistique et production audiovisuelle pour artistes, marques et institutions.",
    descEn: "Creative studio: narrative strategy, art direction and audiovisual production for artists, brands and institutions.",
    poster: "img/atavisme-01.jpg", preview: "img/atavisme-01.jpg", videoSrc: "img/nike-thumb.mp4",
  },
  {
    id: "lagriotheque", name: "LA GRIOTHÈQUE",
    kickerFr: "PILIER FORMATION", kickerEn: "TRAINING PILLAR",
    url: "https://lagriotheque.com",
    descFr: "École de transmission pour la nouvelle génération créative. Formations courtes, méthodes éprouvées sur le terrain, certifiée Qualiopi.",
    descEn: "School of transmission for the next creative generation. Short formats, methods proven in the field, Qualiopi-certified.",
    poster: "img/florale-01.jpg", preview: "img/florale-01.jpg", videoSrc: "img/indigo-cristal-thumb.mp4",
  },
];

const FIELDS = ["kickerFr", "kickerEn", "url", "descFr", "descEn", "poster", "preview", "videoSrc"];

function isExternal(s) { return typeof s === "string" && /^https?:\/\//i.test(s); }

export default function EcosystemEditorPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(true);
  const [data, setData] = useState({});

  useEffect(() => {
    fetch("/api/site/ecosystem")
      .then((r) => r.json())
      .then((j) => {
        const stored = j.value || {};
        // Fusionne défauts + stocké (le stocké prime quand il existe).
        const merged = {};
        for (const u of UNIVERSES) {
          const s = stored[u.id] || {};
          merged[u.id] = {};
          for (const f of FIELDS) merged[u.id][f] = (s[f] != null && s[f] !== "") ? s[f] : u[f];
        }
        setData(merged);
        setLoading(false);
      })
      .catch(() => {
        const merged = {};
        for (const u of UNIVERSES) { merged[u.id] = {}; for (const f of FIELDS) merged[u.id][f] = u[f]; }
        setData(merged);
        setLoading(false);
      });
  }, []);

  function setField(id, field, value) {
    setData((d) => ({ ...d, [id]: { ...d[id], [field]: value } }));
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const r = await fetch("/api/site/ecosystem", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setSaving(false);
      if (r.ok) {
        setMsg('✓ Enregistré. Clique "↳ Sync vers le site" sur la home pour publier.');
        setMsgOk(true);
      } else { setMsg("✗ Erreur lors de l'enregistrement"); setMsgOk(false); }
    } catch (e) { setSaving(false); setMsg(`✗ ${e.message}`); setMsgOk(false); }
  }

  if (loading) return <p className="note">Chargement…</p>;

  return (
    <>
      <h1><Type text="page écosystème" speed={28} cursor="always" /></h1>
      <p className="note" style={{ marginBottom: 18 }}>
        Les 3 univers affichés sur la page <code>/#ecosysteme</code> (le système solaire).
        Tu édites le texte, le lien et les médias de chacun. La géométrie des orbites
        (vitesse, taille) reste fixe. Les noms sont figés.
      </p>

      {UNIVERSES.map((u) => {
        const d = data[u.id] || {};
        return (
          <div key={u.id} style={{ border: "1px solid var(--rule)", padding: "16px 18px", margin: "0 0 22px", background: "#0f0d0b" }}>
            <h2 style={{ marginTop: 0 }}>{u.name}</h2>

            <div className="row">
              <div>
                <label>Kicker FR (sous-titre)</label>
                <input value={d.kickerFr || ""} onChange={(e) => setField(u.id, "kickerFr", e.target.value)} placeholder={u.kickerFr} />
              </div>
              <div>
                <label>Kicker EN</label>
                <input value={d.kickerEn || ""} onChange={(e) => setField(u.id, "kickerEn", e.target.value)} placeholder={u.kickerEn} />
              </div>
            </div>

            <label>Lien du site</label>
            <input value={d.url || ""} onChange={(e) => setField(u.id, "url", e.target.value)} placeholder={u.url} />

            <label>Description FR</label>
            <textarea value={d.descFr || ""} onChange={(e) => setField(u.id, "descFr", e.target.value)} style={{ minHeight: 70 }} placeholder={u.descFr} />

            <label>Description EN</label>
            <textarea value={d.descEn || ""} onChange={(e) => setField(u.id, "descEn", e.target.value)} style={{ minHeight: 70 }} placeholder={u.descEn} />

            <label style={{ marginTop: 16 }}>Médias</label>
            <p className="note" style={{ marginTop: 0 }}>
              <strong>Poster</strong> = image de fond au survol · <strong>Preview</strong> = screenshot dans le terminal ·
              <strong> Vidéo</strong> = vidéo de fond (optionnelle). Uploade un fichier ou colle un chemin/URL.
            </p>
            <MediaField label="Poster" value={d.poster} onChange={(v) => setField(u.id, "poster", v)} accept="image/*" />
            <MediaField label="Preview (screenshot)" value={d.preview} onChange={(v) => setField(u.id, "preview", v)} accept="image/*" />
            <MediaField label="Vidéo de fond" value={d.videoSrc} onChange={(v) => setField(u.id, "videoSrc", v)} accept="video/*" isVideo />
          </div>
        );
      })}

      {msg && <p className="note" style={{ marginTop: 4, color: msgOk ? "var(--accent)" : "var(--danger)" }}>{msg}</p>}

      <div className="actions" style={{ marginTop: 12 }}>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "..." : "Enregistrer"}</button>
        <a href="/" className="btn btn--ghost">← Retour</a>
      </div>
    </>
  );
}

// Champ média : miniature + upload + saisie de chemin/URL.
function MediaField({ label, value, onChange, accept, isVideo }) {
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [showTrim, setShowTrim] = useState(false);
  const external = isExternal(value);
  const previewSrc = value ? (external ? value : `/api/preview?p=${encodeURIComponent(value)}`) : null;
  // Le découpeur ne s'affiche que pour une vidéo self-hostée sous img/ (pas une URL externe).
  const trimmable = isVideo && !!value && !external && /\.(mp4|mov|webm|m4v)$/i.test(value);

  function upload(file) {
    if (!file) return;
    setBusy(true); setErr(""); setDone(false); setPct(0);
    const fd = new FormData();
    fd.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setPct(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      setBusy(false);
      let j = {};
      try { j = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        onChange(j.path);
        setDone(true);
        setTimeout(() => setDone(false), 2500);
      } else {
        setErr(j.error || `upload échoué (${xhr.status})`);
      }
    };
    xhr.onerror = () => { setBusy(false); setErr("erreur réseau pendant l'upload"); };
    xhr.send(fd);
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
      <div style={{ width: 84, height: 54, border: "1px solid var(--rule)", background: "#141210", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        {previewSrc ? (
          isVideo
            ? <video src={previewSrc} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={previewSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : <span style={{ color: "var(--dim)", fontSize: 10 }}>—</span>}
        {(busy || done) && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(5,5,5,0.72)", display: "flex", alignItems: "center", justifyContent: "center", color: done ? "var(--accent)" : "var(--ink)", fontSize: 14, fontWeight: 700 }}>
            {done ? "✓" : `${pct}%`}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>{label}</div>
        <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="img/xxx.jpg  ou  https://…" style={{ marginBottom: 4 }} />
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <label className="btn btn--ghost" style={{ padding: "4px 10px", fontSize: 11, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? `Upload… ${pct}%` : done ? "✓ Uploadé" : "Upload"}
            <input type="file" accept={accept} disabled={busy} onChange={(e) => { const file = e.target.files[0]; e.target.value = ""; upload(file); }} style={{ display: "none" }} />
          </label>
          {value && <button type="button" className="btn btn--danger" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => onChange("")}>Retirer</button>}
          {trimmable && (
            <button type="button" className="btn btn--ghost" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setShowTrim((s) => !s)}>
              {showTrim ? "✕ Fermer le découpage" : "✂ Découper une boucle"}
            </button>
          )}
          {err && <span style={{ fontSize: 10, color: "var(--danger)" }}>{err}</span>}
        </div>
        {busy && (
          <div style={{ height: 4, background: "var(--rule)", overflow: "hidden", marginTop: 6 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", transition: "width 0.15s ease" }} />
          </div>
        )}
        {showTrim && trimmable && (
          // key = value → le découpeur se réinitialise quand la source change
          // (nouvel upload, ou après génération d'une boucle qui devient la nouvelle source).
          <VideoTrimmer key={value} src={value} previewSrc={previewSrc} onTrimmed={(p) => onChange(p)} />
        )}
      </div>
    </div>
  );
}

// Formate un nombre de secondes en timecode lisible m:ss.d (dixièmes).
function fmtTC(s) {
  if (!Number.isFinite(s) || s < 0) return "0:00.0";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const d = Math.floor((s * 10) % 10);
  return `${m}:${String(sec).padStart(2, "0")}.${d}`;
}

// Découpeur « sélectionne + boucle ».
// On charge la vidéo source (déjà sous img/), l'utilisateur choisit les bornes
// début/fin, prévisualise la sélection en boucle, puis génère un clip .mp4
// web-optimisé via POST /api/trim. Le champ pointe ensuite sur le clip découpé.
function VideoTrimmer({ src, previewSrc, onTrimmed }) {
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
