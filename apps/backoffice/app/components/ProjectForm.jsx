// Composant partagé entre /projects/new et /projects/[id].
// Gère tous les champs d'un projet + uploads de médias (cover, thumbVideo, strip, resources).
"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import VideoTrimmer from "./VideoTrimmer";

// Liste pré-définie de services — un clic pour les ajouter au rôle multi.
// Tu peux toujours en taper d'autres à la main ; ces chips ne sont qu'un raccourci.
const SERVICE_CHIPS = [
  "DIRECTION",
  "CREATIVE DIRECTION",
  "ART DIRECTION",
  "MOVEMENT DIRECTION",
  "DOP",
  "1ST AC",
  "PRODUCTION",
  "EDIT",
  "COLOR",
  "SOUND",
  "MOTION",
  "STRATEGY",
  "CASTING",
  "STYLING",
  "COPYWRITING",
  "PHOTOGRAPHY",
];

// Détecte si un chemin est un URL absolu (https://…) plutôt qu'un fichier local.
function isExternalUrl(s) {
  return typeof s === "string" && /^https?:\/\//i.test(s);
}

const EMPTY = {
  id: "",
  position: 0,
  name: "",
  roleMode: "single", // "single" | "multi"
  roleSingle: "",
  roleMulti: [],
  client: "",
  date: "",
  location: "",
  cover: "",
  thumbVideo: "",
  // Timecode de départ du thumb (en secondes). Utile uniquement quand
  // thumbVideo pointe sur une URL YouTube : la grille Work lit une boucle
  // de 4 secondes à partir de cette position. Ignoré pour les .mp4 self-hostés.
  thumbStart: 0,
  strip: [],         // ["img/xx.jpg", ...]
  resources: [],     // [{type, src, poster?, label, aspect?}]
  credits: [],       // [{role, names: "a, b, c"}]  -> serialisé en {ROLE: [names]}
  tags: [],
  hidden: false,
};

function projectToForm(p) {
  if (!p) return { ...EMPTY };
  const credits = Object.entries(p.credits || {}).map(([role, names]) => ({
    role,
    names: Array.isArray(names) ? names.join(", ") : String(names || ""),
  }));
  return {
    id: p.id || "",
    position: p.position ?? 0,
    name: p.name || "",
    roleMode: Array.isArray(p.role) ? "multi" : "single",
    roleSingle: Array.isArray(p.role) ? "" : (p.role || ""),
    roleMulti: Array.isArray(p.role) ? p.role : [],
    client: p.client || "",
    date: p.date || "",
    location: p.location || "",
    cover: p.cover || "",
    thumbVideo: p.thumbVideo || "",
    thumbStart: typeof p.thumbStart === "number" ? p.thumbStart : 0,
    strip: p.strip || [],
    resources: p.resources || [],
    credits,
    tags: p.tags || [],
    hidden: !!p.hidden,
  };
}

function formToProject(f) {
  const credits = {};
  f.credits.forEach((c) => {
    if (!c.role.trim()) return;
    credits[c.role.trim()] = c.names.split(",").map((s) => s.trim()).filter(Boolean);
  });
  const role = f.roleMode === "multi"
    ? f.roleMulti.filter(Boolean)
    : (f.roleSingle || "");
  return {
    id: f.id.trim(),
    position: Number(f.position) || 0,
    name: f.name.trim(),
    role,
    client: f.client.trim(),
    date: f.date.trim(),
    location: f.location.trim(),
    cover: f.cover.trim(),
    thumbVideo: f.thumbVideo.trim() || undefined,
    thumbStart: f.thumbStart ? Number(f.thumbStart) : undefined,
    strip: f.strip.filter(Boolean),
    resources: f.resources.filter((r) => r.src && r.src.trim()),
    credits,
    tags: f.tags.filter(Boolean),
    hidden: !!f.hidden,
  };
}

// Upload helper : POST multipart vers /api/upload, renvoie le path relatif.
// Utilise XMLHttpRequest (et pas fetch) pour exposer la progression réelle
// du transfert via xhr.upload.onprogress → onProgress(pourcentage 0..100).
function uploadFile(file, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.onload = () => {
      let j = {};
      try { j = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(j.path);
      else reject(new Error(j.error || `upload échoué (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("erreur réseau pendant l'upload"));
    xhr.ontimeout = () => reject(new Error("temps dépassé pendant l'upload"));
    xhr.send(fd);
  });
}

// Slugifie un nom de projet → id propre (minuscules, tirets, sans accents).
function slugify(str) {
  return (str || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[×x]\s/g, "x-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function ProjectForm({ initial, isNew }) {
  const router = useRouter();
  const [f, setF] = useState(projectToForm(initial));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  // Tant que l'utilisateur n'a pas touché l'ID à la main, on le génère
  // automatiquement depuis le nom (uniquement en création).
  const [idTouched, setIdTouched] = useState(!isNew);
  // Découpeur d'extrait pour la thumb video (hover grille Work + fond
  // de l'overlay INFORMATION du viewer). Visible uniquement pour un
  // .mp4 self-hosté sous img/ (les URL externes / YouTube ne passent
  // pas par /api/trim).
  const [showThumbTrim, setShowThumbTrim] = useState(false);
  // ── Galerie façon Instagram ──
  // Tuile sélectionnée (son éditeur s'ouvre sous la grille) + drag & drop.
  const [selectedRes, setSelectedRes] = useState(null);
  const resDragIdx = useRef(null);
  const [resDragging, setResDragging] = useState(null); // index en cours de drag
  const [resDropIdx, setResDropIdx] = useState(null);
  // ── Upload façon Vimeo ──
  // Drop de fichiers n'importe où sur la fiche + file d'attente visible.
  const dragDepth = useRef(0);
  const [dropActive, setDropActive] = useState(false);
  const [upQueue, setUpQueue] = useState([]);

  function set(k, v) { setF((p) => ({ ...p, [k]: v })); }

  function handleName(v) {
    setF((p) => ({
      ...p,
      name: v,
      ...(isNew && !idTouched ? { id: slugify(v) } : {}),
    }));
  }

  // ---- VISUEL PRINCIPAL (cover image OU vidéo, champ unifié) -----------
  // Un seul upload : le type du fichier route automatiquement —
  // vidéo → thumbVideo (hover grille + fond overlay), image → cover.
  // Les deux peuvent coexister (l'image sert alors de poster/fallback).
  const [upVisual, setUpVisual] = useState({ status: "idle", pct: 0, err: "" });
  const [visUrlMode, setVisUrlMode] = useState(false);
  const [visUrlDraft, setVisUrlDraft] = useState("");
  async function visualUpload(file) {
    if (!file) return;
    setUpVisual({ status: "up", pct: 0, err: "" });
    try {
      const path = await uploadFile(file, (pct) => setUpVisual((s) => ({ ...s, pct })));
      if (/^video\//.test(file.type) || /\.(mp4|mov|webm|m4v)$/i.test(path)) set("thumbVideo", path);
      else set("cover", path);
      setUpVisual({ status: "done", pct: 100, err: "" });
      setTimeout(() => setUpVisual((s) => (s.status === "done" ? { status: "idle", pct: 0, err: "" } : s)), 2500);
    } catch (e) {
      setUpVisual({ status: "error", pct: 0, err: e.message || "échec de l'upload" });
    }
  }
  function visualUrlSubmit() {
    const u = visUrlDraft.trim();
    if (!u) { setVisUrlMode(false); return; }
    if (!/^https?:\/\//i.test(u)) { alert("L'URL doit commencer par http:// ou https://"); return; }
    const isVid = /youtube\.com|youtu\.be|vimeo\.com/i.test(u) || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u);
    set(isVid ? "thumbVideo" : "cover", u);
    setVisUrlDraft("");
    setVisUrlMode(false);
  }
  // ---- RESOURCES (médias détaillés du projet) -------------------------
  function resourceAdd(type) {
    let blank;
    if (type === "video") {
      blank = { type: "video", src: "", poster: "", label: "", aspect: "16/9" };
    } else if (type === "youtube") {
      // Le user colle juste l'URL — on stocke direct dans src, et l'embed
      // est calculé côté viewer (parse VIDEO_ID, construit youtube.com/embed/...).
      blank = { type: "youtube", src: "", label: "", aspect: "16/9" };
    } else {
      blank = { type: "image", src: "", label: "", aspect: "16/9" };
    }
    set("resources", [...f.resources, blank]);
  }
  // Parse une URL YouTube/Vimeo et renvoie l'ID propre, sinon null.
  function parseYouTubeId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
    return m ? m[1] : null;
  }
  function parseVimeoId(url) {
    if (!url) return null;
    const m = url.match(/vimeo\.com\/(?:video\/)?(\d{6,})/i);
    return m ? m[1] : null;
  }
  function resourcePatch(i, patch) {
    const arr = [...f.resources];
    arr[i] = { ...arr[i], ...patch };
    set("resources", arr);
  }
  function resourceRemove(i) {
    set("resources", f.resources.filter((_, k) => k !== i));
  }
  function resourceMove(i, dir) {
    const arr = [...f.resources];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    set("resources", arr);
  }
  function resourceUpload(i, field, path) {
    if (path) resourcePatch(i, { [field]: path });
  }
  function resourceSetUrl(i, field, url) {
    resourcePatch(i, { [field]: url });
  }
  // Réordonnancement par drag & drop de la grille (façon Instagram).
  function resourceReorder(from, to) {
    if (from == null || to == null || from === to) return;
    const arr = [...f.resources];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    set("resources", arr);
  }
  // Miniature d'une resource pour la grille : poster > src image > thumb YT.
  // Les vidéos sans poster sont rendues en <video> directement dans la tuile.
  function resThumb(r) {
    if (r.type === "youtube") {
      const id = parseYouTubeId(r.src);
      return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null;
    }
    const src = r.poster || (r.type === "image" ? r.src : null);
    if (!src) return null;
    return isExternalUrl(src) ? src : `/api/preview?p=${encodeURIComponent(src)}`;
  }
  function resVideoSrc(r) {
    if (r.type !== "video" || !r.src || r.poster) return null;
    return isExternalUrl(r.src) ? r.src : `/api/preview?p=${encodeURIComponent(r.src)}`;
  }

  // ── Upload façon Vimeo : fichiers déposés n'importe où sur la fiche ──
  // Chaque fichier passe par /api/upload (avec progression) puis devient
  // une resource de la galerie (type déduit du MIME).
  function dtHasFiles(e) {
    return Array.from(e.dataTransfer?.types || []).includes("Files");
  }
  async function handleDroppedFiles(fileList) {
    const files = Array.from(fileList).filter((file) => /^(image|video)\//.test(file.type));
    for (const file of files) {
      const qid = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
      setUpQueue((q) => [...q, { id: qid, name: file.name, pct: 0, status: "up" }]);
      try {
        const path = await uploadFile(file, (pct) =>
          setUpQueue((q) => q.map((it) => (it.id === qid ? { ...it, pct } : it))));
        const isVid = /^video\//.test(file.type);
        setF((p) => ({
          ...p,
          resources: [
            ...p.resources,
            isVid
              ? { type: "video", src: path, poster: "", label: "", aspect: "16/9" }
              : { type: "image", src: path, label: "", aspect: "16/9" },
          ],
        }));
        setUpQueue((q) => q.map((it) => (it.id === qid ? { ...it, pct: 100, status: "done" } : it)));
        setTimeout(() => setUpQueue((q) => q.filter((it) => it.id !== qid)), 3500);
      } catch (e) {
        setUpQueue((q) => q.map((it) => (it.id === qid ? { ...it, status: "error", name: `${file.name} — ${e.message}` } : it)));
        setTimeout(() => setUpQueue((q) => q.filter((it) => it.id !== qid)), 8000);
      }
    }
  }
  // ---- CREDITS ---------------------------------------------------------
  function creditAdd() {
    set("credits", [...f.credits, { role: "", names: "" }]);
  }
  function creditPatch(i, patch) {
    const arr = [...f.credits];
    arr[i] = { ...arr[i], ...patch };
    set("credits", arr);
  }
  function creditRemove(i) {
    set("credits", f.credits.filter((_, k) => k !== i));
  }
  // ---- TAGS ------------------------------------------------------------
  function tagsChange(str) {
    set("tags", str.split(",").map((s) => s.trim()).filter(Boolean));
  }
  // ---- ROLE MULTI ------------------------------------------------------
  function roleMultiChange(str) {
    set("roleMulti", str.split("/").map((s) => s.trim()).filter(Boolean));
  }
  // Ajoute (ou retire si déjà présent) une chip service au rôle multi.
  // Bascule automatiquement en mode "multi" si on était en simple.
  function toggleServiceChip(label) {
    setF((p) => {
      const next = { ...p, roleMode: "multi" };
      // si on bascule de single → multi, on garde le simple comme première entrée
      let base = p.roleMode === "multi"
        ? [...p.roleMulti]
        : (p.roleSingle ? [p.roleSingle] : []);
      const i = base.indexOf(label);
      if (i >= 0) base.splice(i, 1);
      else base.push(label);
      next.roleMulti = base;
      return next;
    });
  }
  function roleHas(label) {
    return f.roleMode === "multi"
      ? f.roleMulti.includes(label)
      : f.roleSingle === label;
  }

  // ---- SUBMIT ----------------------------------------------------------
  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    const payload = formToProject(f);
    if (!payload.id || !payload.name) {
      setErr("id et name sont obligatoires");
      setSaving(false);
      return;
    }
    const url = isNew ? "/api/projects" : `/api/projects/${initial.id}`;
    const method = isNew ? "POST" : "PUT";
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(j.error || `erreur ${r.status}`);
      return;
    }
    router.push("/");
    router.refresh();
  }

  // ---- RENDER ----------------------------------------------------------
  return (
    <form
      onSubmit={submit}
      /* Drop global façon Vimeo : dépose une image/vidéo n'importe où sur
         la fiche → upload + ajout à la galerie. Le compteur dragDepth évite
         le clignotement du veil quand le curseur traverse les enfants.
         Les drags INTERNES (réordonnancement des tuiles) n'ont pas le type
         "Files" → ignorés ici. */
      onDragEnter={(e) => { if (dtHasFiles(e)) { e.preventDefault(); dragDepth.current += 1; setDropActive(true); } }}
      onDragOver={(e) => { if (dtHasFiles(e)) e.preventDefault(); }}
      onDragLeave={(e) => { if (dtHasFiles(e)) { dragDepth.current -= 1; if (dragDepth.current <= 0) { dragDepth.current = 0; setDropActive(false); } } }}
      onDrop={(e) => {
        if (!dtHasFiles(e)) return;
        e.preventDefault();
        dragDepth.current = 0;
        setDropActive(false);
        handleDroppedFiles(e.dataTransfer.files);
      }}
    >
      {/* Veil de drop plein écran */}
      {dropActive && (
        <div className="dropveil">
          <div className="dropveil__box">⇣ Dépose tes images / vidéos ici</div>
        </div>
      )}
      {/* File d'attente d'uploads (bottom-right) */}
      {upQueue.length > 0 && (
        <div className="upqueue">
          {upQueue.map((u) => (
            <div key={u.id} className={"upqueue__item" + (u.status === "done" ? " upqueue__item--done" : u.status === "error" ? " upqueue__item--error" : "")}>
              <div className="upqueue__name">
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</span>
                <em>{u.status === "done" ? "✓" : u.status === "error" ? "✗" : `${u.pct}%`}</em>
              </div>
              <div className="upqueue__bar">
                <div className="upqueue__fill" style={{ width: `${u.status === "error" ? 100 : u.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <h2>Identité</h2>
      <div className="row">
        <div>
          <label>ID (slug, immuable)</label>
          <input
            value={f.id}
            onChange={(e) => { setIdTouched(true); set("id", slugify(e.target.value) || e.target.value); }}
            disabled={!isNew}
            placeholder="ava-x-nike-courir"
            required
          />
          {isNew && !idTouched && (
            <p className="note" style={{ marginTop: 4 }}>Généré automatiquement depuis le nom — modifie-le si besoin.</p>
          )}
        </div>
        <div>
          <label>Position (ordre dans la liste)</label>
          <input
            type="number"
            value={f.position}
            onChange={(e) => set("position", e.target.value)}
          />
        </div>
      </div>
      <label>Nom du projet</label>
      <input
        value={f.name}
        onChange={(e) => handleName(e.target.value)}
        placeholder="AVA X / NIKE × COURIR"
        required
      />
      <div className="row">
        <div>
          <label>Client</label>
          <input value={f.client} onChange={(e) => set("client", e.target.value)} />
        </div>
        <div>
          <label>Date</label>
          <input value={f.date} onChange={(e) => set("date", e.target.value)} placeholder="2025" />
        </div>
      </div>
      <label>Lieu</label>
      <input value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="Paris" />

      <label>Rôle</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <button
          type="button"
          className={`btn btn--ghost ${f.roleMode === "single" ? "btn--active" : ""}`}
          style={{ padding: "4px 10px", fontSize: 11 }}
          onClick={() => set("roleMode", "single")}
        >Simple</button>
        <button
          type="button"
          className={`btn btn--ghost ${f.roleMode === "multi" ? "btn--active" : ""}`}
          style={{ padding: "4px 10px", fontSize: 11 }}
          onClick={() => set("roleMode", "multi")}
        >Multi (séparé par /)</button>
      </div>
      {f.roleMode === "single" ? (
        <input
          value={f.roleSingle}
          onChange={(e) => set("roleSingle", e.target.value)}
          placeholder="MOVEMENT DIRECTION"
        />
      ) : (
        <input
          value={f.roleMulti.join(" / ")}
          onChange={(e) => roleMultiChange(e.target.value)}
          placeholder="CREATIVE DIRECTION / PRODUCTION / MOVEMENT"
        />
      )}
      <p className="note" style={{ marginTop: 6 }}>Services rapides — clique pour ajouter / retirer :</p>
      <div className="chips">
        {SERVICE_CHIPS.map((label) => {
          const on = roleHas(label);
          return (
            <button
              key={label}
              type="button"
              className={`chip ${on ? "chip--on" : ""}`}
              onClick={() => toggleServiceChip(label)}
              title={on ? "Retirer" : "Ajouter au rôle"}
            >
              {on ? "− " : "+ "}{label}
            </button>
          );
        })}
      </div>

      <h2>Visuel principal</h2>
      <p className="note" style={{ marginTop: 0, marginBottom: 8 }}>
        Une seule zone, <strong>photo ou vidéo</strong> — le type est détecté automatiquement.
        Une vidéo joue au hover (grille Work) et en fond (overlay INFO) ; une image sert de cover statique
        (poster, mobile, partage). Vidéo seule ? L'image est générée automatiquement au Sync depuis une frame.
        Les deux ? Tu contrôles tout.
      </p>
      {!f.cover && !f.thumbVideo && (
        <p className="note" style={{ marginTop: 0, marginBottom: 6, color: "var(--dim)" }}>
          ⚠ Sans visuel, un placeholder jaune avec le nom du projet sera affiché sur le site.
        </p>
      )}

      {(() => {
        // Preview : la vidéo prime (c'est elle qu'on voit au hover), sinon l'image.
        const tv = (f.thumbVideo || "").trim();
        const ytId = tv && (tv.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i) || [])[1];
        const tvLocal = tv && !isExternalUrl(tv) && /\.(mp4|mov|webm|m4v)$/i.test(tv);
        const tvSrc = tv && !ytId ? (isExternalUrl(tv) ? tv : `/api/preview?p=${encodeURIComponent(tv)}`) : null;
        const cv = (f.cover || "").trim();
        const cvSrc = cv ? (isExternalUrl(cv) ? cv : `/api/preview?p=${encodeURIComponent(cv)}`) : null;
        return (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{
              width: 168, height: 100, flexShrink: 0, position: "relative",
              border: "1px solid var(--rule)", borderRadius: "var(--r-sm)", overflow: "hidden",
              background: "#141210", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {tvSrc ? (
                <video key={tvSrc} src={tvSrc} poster={cvSrc || undefined} muted loop playsInline autoPlay style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : ytId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : cvSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cvSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 10, color: "var(--dim)", letterSpacing: "0.1em" }}>—</span>
              )}
              {(upVisual.status === "up" || upVisual.status === "done") && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(5,5,5,0.72)", display: "flex", alignItems: "center", justifyContent: "center", color: upVisual.status === "done" ? "var(--accent)" : "var(--ink)", fontSize: 15, fontWeight: 700 }}>
                  {upVisual.status === "done" ? "✓" : `${upVisual.pct}%`}
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {visUrlMode ? (
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <input
                    autoFocus
                    value={visUrlDraft}
                    onChange={(e) => setVisUrlDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); visualUrlSubmit(); } if (e.key === "Escape") setVisUrlMode(false); }}
                    placeholder="URL image, .mp4, YouTube ou Vimeo — le type est détecté"
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn" style={{ padding: "4px 10px", fontSize: 11 }} onClick={visualUrlSubmit}>OK</button>
                  <button type="button" className="btn btn--ghost" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setVisUrlMode(false)}>×</button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <label className="btn btn--ghost" style={{ padding: "5px 12px", fontSize: 11, cursor: upVisual.status === "up" ? "wait" : "pointer", opacity: upVisual.status === "up" ? 0.6 : 1 }}>
                    {upVisual.status === "up" ? `Upload… ${upVisual.pct}%` : "⇪ Upload photo ou vidéo"}
                    <input
                      type="file"
                      accept="image/*,video/mp4,video/webm,video/quicktime"
                      disabled={upVisual.status === "up"}
                      onChange={(e) => { const file = e.target.files[0]; e.target.value = ""; visualUpload(file); }}
                      style={{ display: "none" }}
                    />
                  </label>
                  <button type="button" className="btn btn--ghost" style={{ padding: "5px 12px", fontSize: 11 }} onClick={() => setVisUrlMode(true)}>Coller URL</button>
                </div>
              )}
              {upVisual.err && <p className="note" style={{ color: "var(--danger)", margin: "0 0 6px" }}>✗ {upVisual.err}</p>}

              {/* État des deux assets — chips retirables */}
              {tv && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, marginBottom: 4, minWidth: 0 }}>
                  <span className="pill" style={{ flexShrink: 0, borderColor: "var(--accent)", color: "var(--accent)" }}>VIDÉO</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--dim)" }} title={tv}>{tv}</span>
                  <button type="button" className="btn btn--ghost" style={{ padding: "1px 8px", fontSize: 10, flexShrink: 0 }} onClick={() => { set("thumbVideo", ""); setShowThumbTrim(false); }}>Retirer</button>
                </div>
              )}
              {cv && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, marginBottom: 4, minWidth: 0 }}>
                  <span className="pill" style={{ flexShrink: 0 }}>IMAGE</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--dim)" }} title={cv}>{cv}</span>
                  <button type="button" className="btn btn--ghost" style={{ padding: "1px 8px", fontSize: 10, flexShrink: 0 }} onClick={() => set("cover", "")}>Retirer</button>
                </div>
              )}
              {!cv && tvLocal && (
                <p className="note" style={{ margin: 0 }}>Image auto-générée depuis la vidéo au Sync.</p>
              )}
            </div>
          </div>
        );
      })()}
      {/* Découpeur d'extrait — même outil que sur la page Écosystème.
          Permet de choisir directement le segment qui tournera en boucle
          au hover (grille Work) et en fond (overlay INFORMATION), au lieu
          d'uploader un mp4 déjà pré-découpé. Génère un clip court optimisé
          via /api/trim (ffmpeg) et fait pointer le champ dessus. */}
      {!!f.thumbVideo && !isExternalUrl(f.thumbVideo) && /\.(mp4|mov|webm|m4v)$/i.test(f.thumbVideo) && (
        <div style={{ marginTop: 6 }}>
          <button
            type="button"
            className="btn btn--ghost"
            style={{ padding: "4px 10px", fontSize: 11 }}
            onClick={() => setShowThumbTrim((s) => !s)}
          >
            {showThumbTrim ? "✕ Fermer le découpage" : "✂ Choisir l'extrait (hover + fond)"}
          </button>
          {showThumbTrim && (
            // key = valeur du champ → le découpeur se réinitialise quand la
            // source change (nouvel upload, ou boucle générée qui devient la
            // nouvelle source).
            <VideoTrimmer
              key={f.thumbVideo}
              src={f.thumbVideo}
              previewSrc={`/api/preview?p=${encodeURIComponent(f.thumbVideo)}`}
              onTrimmed={(p) => set("thumbVideo", p)}
            />
          )}
        </div>
      )}
      {/* Timecode de départ — utile uniquement quand thumbVideo est une
          URL YouTube. La grille Work joue un extrait [thumbStart → +4s]
          en boucle au hover. Ignoré pour les .mp4 self-hostés (qui sont
          déjà des thumbs courts pré-rendus). */}
      {/youtube\.com|youtu\.be/i.test(f.thumbVideo || "") && (
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ marginBottom: 0 }}>Démarrer à (sec) :</label>
          <input
            type="number"
            min="0"
            step="1"
            value={f.thumbStart || 0}
            onChange={(e) => set("thumbStart", Number(e.target.value))}
            style={{ width: 90 }}
          />
          <span className="note" style={{ color: "var(--dim)" }}>
            Extrait joué : {f.thumbStart || 0}s → {(f.thumbStart || 0) + 4}s, en boucle.
          </span>
        </div>
      )}

      {/* Section "Strip" retirée — le champ existait dans data.jsx mais n'est
          affiché nulle part sur le site. Les valeurs existantes restent en DB
          et sont préservées par l'exporter, simplement plus éditables ici. */}

      <h2>Galerie (médias du projet)</h2>
      <p className="note">
        Glisse les tuiles pour réordonner (l'ordre de la page projet suit). Clique une tuile pour l'éditer.
        Tu peux aussi <strong>déposer des fichiers n'importe où sur la page</strong> — ils s'uploadent et rejoignent la galerie.
      </p>

      {/* Grille façon Instagram */}
      <div className="medialib">
        {f.resources.map((r, i) => {
          const thumb = resThumb(r);
          const vidSrc = resVideoSrc(r);
          return (
            <div
              key={i}
              className={
                "mediatile" +
                (selectedRes === i ? " mediatile--selected" : "") +
                (resDragging === i ? " mediatile--dragging" : "") +
                (resDropIdx === i && resDragging != null && resDragging !== i ? " mediatile--dropover" : "")
              }
              draggable
              onDragStart={(e) => {
                resDragIdx.current = i;
                setResDragging(i);
                setSelectedRes(null);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(i));
              }}
              onDragOver={(e) => { if (resDragging != null) { e.preventDefault(); setResDropIdx(i); } }}
              onDrop={(e) => {
                if (resDragging == null) return;
                e.preventDefault();
                e.stopPropagation();
                resourceReorder(resDragIdx.current, i);
                resDragIdx.current = null;
                setResDragging(null);
                setResDropIdx(null);
              }}
              onDragEnd={() => { resDragIdx.current = null; setResDragging(null); setResDropIdx(null); }}
              onClick={() => setSelectedRes((s) => (s === i ? null : i))}
              role="button"
              aria-label={`Média ${i + 1} (${r.type})`}
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" loading="lazy" draggable={false} />
              ) : vidSrc ? (
                <video
                  src={vidSrc}
                  muted
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(e) => { try { e.currentTarget.currentTime = 1; } catch {} }}
                />
              ) : (
                <span className="mediatile__missing">VIDE</span>
              )}
              <span className="mediatile__type">{r.type === "youtube" ? "YT" : r.type}</span>
              <span className="mediatile__num">{i + 1}</span>
              <button
                type="button"
                className="mediatile__remove"
                title="Retirer ce média"
                onClick={(e) => {
                  e.stopPropagation();
                  resourceRemove(i);
                  setSelectedRes((s) => (s === i ? null : s != null && s > i ? s - 1 : s));
                }}
              >×</button>
            </div>
          );
        })}
        {/* Tuiles d'ajout */}
        <button type="button" className="mediatile mediatile--add" onClick={() => { resourceAdd("image"); setSelectedRes(f.resources.length); }}>
          <span className="plus">+</span> image
        </button>
        <button type="button" className="mediatile mediatile--add" onClick={() => { resourceAdd("video"); setSelectedRes(f.resources.length); }}>
          <span className="plus">+</span> vidéo
        </button>
        <button type="button" className="mediatile mediatile--add" onClick={() => { resourceAdd("youtube"); setSelectedRes(f.resources.length); }}>
          <span className="plus">+</span> YT / Vimeo
        </button>
      </div>

      {/* Éditeur de la tuile sélectionnée */}
      {selectedRes != null && f.resources[selectedRes] && (() => {
        const i = selectedRes;
        const r = f.resources[i];
        return (
          <div className="media-editor">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <strong style={{ fontSize: 12, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Média #{i + 1} — {r.type}
              </strong>
              <span>
                <button type="button" className="btn btn--ghost" style={btnTiny} onClick={() => setSelectedRes(null)}>✕ Fermer</button>
              </span>
            </div>
            <div className="row">
              {r.type === "youtube" ? (
                <div style={{ flex: 1 }}>
                  <label>URL YouTube ou Vimeo</label>
                  <input
                    type="url"
                    value={r.src || ""}
                    onChange={(e) => resourcePatch(i, { src: e.target.value.trim() })}
                    placeholder="https://www.youtube.com/watch?v=… ou https://vimeo.com/…"
                    style={{ width: "100%" }}
                  />
                  {r.src && !parseYouTubeId(r.src) && !parseVimeoId(r.src) && (
                    <p className="note" style={{ color: "var(--danger)" }}>
                      ✗ URL non reconnue (attendu : youtube.com / youtu.be / vimeo.com)
                    </p>
                  )}
                  {r.src && parseYouTubeId(r.src) && (
                    <p className="note" style={{ color: "var(--accent)" }}>
                      ✓ YouTube ID : <code>{parseYouTubeId(r.src)}</code>
                    </p>
                  )}
                  {r.src && parseVimeoId(r.src) && (
                    <p className="note" style={{ color: "var(--accent)" }}>
                      ✓ Vimeo ID : <code>{parseVimeoId(r.src)}</code>
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label>Source ({r.type})</label>
                    <MediaInput
                      value={r.src}
                      onUpload={(file) => resourceUpload(i, "src", file)}
                      onUrl={(url) => resourceSetUrl(i, "src", url)}
                      onClear={() => resourcePatch(i, { src: "" })}
                      accept={r.type === "video" ? "video/*" : "image/*"}
                      isVideo={r.type === "video"}
                      urlHint={r.type === "video" ? "Recommandé : URL .mp4 Bunny/R2/Cloudflare" : null}
                    />
                  </div>
                  {r.type === "video" && (
                    <div>
                      <label>Poster (image de chargement)</label>
                      <MediaInput
                        value={r.poster || ""}
                        onUpload={(file) => resourceUpload(i, "poster", file)}
                        onUrl={(url) => resourceSetUrl(i, "poster", url)}
                        onClear={() => resourcePatch(i, { poster: "" })}
                        accept="image/*"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="row">
              <div>
                <label>Label (légende)</label>
                <input value={r.label || ""} onChange={(e) => resourcePatch(i, { label: e.target.value })} />
              </div>
              <div>
                <label>Aspect (ex 16/9, 4/5, 1/1)</label>
                <input value={r.aspect || ""} onChange={(e) => resourcePatch(i, { aspect: e.target.value })} placeholder="16/9" />
              </div>
            </div>
            <div className="actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn--danger"
                style={{ padding: "6px 12px", fontSize: 11 }}
                onClick={() => { resourceRemove(i); setSelectedRes(null); }}
              >× Retirer ce média</button>
            </div>
          </div>
        );
      })()}

      <h2>Crédits</h2>
      <p className="note">Format affiché : RÔLE — Nom 1, Nom 2…</p>
      {f.credits.map((c, i) => (
        <div key={i} className="row" style={{ alignItems: "end" }}>
          <div>
            <label>Rôle</label>
            <input value={c.role} onChange={(e) => creditPatch(i, { role: e.target.value })} placeholder="CREATIVE DIRECTION" />
          </div>
          <div>
            <label>Noms (séparés par virgule)</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={c.names} onChange={(e) => creditPatch(i, { names: e.target.value })} placeholder="Moos Coulibaly, ..." />
              <button type="button" className="btn btn--danger" style={btnTiny} onClick={() => creditRemove(i)}>×</button>
            </div>
          </div>
        </div>
      ))}
      <div className="actions" style={{ marginTop: 12 }}>
        <button type="button" className="btn btn--ghost" onClick={creditAdd}>+ Ligne crédit</button>
      </div>

      <h2>Tags & visibilité</h2>
      <label>Tags (séparés par virgule)</label>
      <input value={f.tags.join(", ")} onChange={(e) => tagsChange(e.target.value)} placeholder="movement, fashion, sport" />
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={f.hidden}
          onChange={(e) => set("hidden", e.target.checked)}
          style={{ width: "auto" }}
        />
        Caché (non exporté vers le site)
      </label>

      {err && <p className="note" style={{ color: "var(--danger)", marginTop: 14 }}>✗ {err}</p>}

      <div className="actions" style={{ marginTop: 28 }}>
        <button type="submit" className="btn" disabled={saving}>
          {saving ? "..." : (isNew ? "Créer" : "Enregistrer")}
        </button>
        <a href="/" className="btn btn--ghost">Annuler</a>
      </div>

      <style jsx>{`
        .resource {
          border: 1px solid var(--rule);
          padding: 12px 14px;
          margin: 12px 0;
          background: #0f0d0b;
        }
        .resource__head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          color: var(--dim);
          font-size: 12px;
        }
        .btn--active {
          border-color: var(--accent);
          color: var(--accent);
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin: 6px 0 14px;
        }
        .chip {
          background: transparent;
          color: var(--dim);
          border: 1px solid var(--rule);
          padding: 3px 9px;
          font: inherit;
          font-size: 11px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          cursor: pointer;
          transition: border-color .12s, color .12s, background .12s;
        }
        .chip:hover {
          border-color: var(--accent);
          color: var(--fg);
        }
        .chip--on {
          background: var(--accent);
          color: #000;
          border-color: var(--accent);
        }
        .chip--on:hover {
          color: #000;
        }
      `}</style>
    </form>
  );
}

const btnTiny = { padding: "2px 8px", fontSize: 11, marginLeft: 4 };

// Sous-composant : input média.
// Trois modes : preview + bouton Upload local + bouton "Coller URL" + bouton Clear.
// La preview gère à la fois les chemins locaux (img/xxx.jpg via /api/preview)
// et les URL absolues (https://...) — utile pour les vidéos hébergées sur Bunny, R2, etc.
function MediaInput({ value, onUpload, onUrl, onClear, accept, isVideo, urlHint }) {
  const [urlMode, setUrlMode] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  // État d'upload local : idle | uploading (avec pct) | done | error.
  const [up, setUp] = useState({ status: "idle", pct: 0, err: "" });
  const external = isExternalUrl(value);

  async function doUpload(file) {
    if (!file) return;
    setUp({ status: "uploading", pct: 0, err: "" });
    try {
      const path = await uploadFile(file, (pct) => setUp((s) => ({ ...s, pct })));
      setUp({ status: "done", pct: 100, err: "" });
      onUpload(path);
      // Repasse en idle après 2,5 s (le ✓ reste visible un instant).
      setTimeout(() => setUp((s) => (s.status === "done" ? { status: "idle", pct: 0, err: "" } : s)), 2500);
    } catch (e) {
      setUp({ status: "error", pct: 0, err: e.message || "échec de l'upload" });
    }
  }
  // Source à afficher dans la preview : URL direct si externe, sinon proxy backend.
  const previewSrc = value
    ? (external ? value : `/api/preview?p=${encodeURIComponent(value)}`)
    : null;

  function submitUrl() {
    const u = urlDraft.trim();
    if (!u) { setUrlMode(false); return; }
    if (!/^https?:\/\//i.test(u)) { alert("L'URL doit commencer par http:// ou https://"); return; }
    onUrl(u);
    setUrlDraft("");
    setUrlMode(false);
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{
        width: 90, height: 60, border: "1px solid var(--rule)", background: "#141210",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        overflow: "hidden", position: "relative",
      }}>
        {previewSrc ? (
          isVideo
            ? <video src={previewSrc} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={previewSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : <span style={{ color: "var(--dim)", fontSize: 11 }}>—</span>}
        {external && up.status === "idle" && (
          <span style={{
            position: "absolute", top: 2, left: 2, padding: "1px 4px",
            background: "var(--accent)", color: "#000", fontSize: 9, fontWeight: 700,
            letterSpacing: "0.05em",
          }}>URL</span>
        )}
        {(up.status === "uploading" || up.status === "done") && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(5,5,5,0.72)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: up.status === "done" ? "var(--accent)" : "var(--ink)",
            fontSize: 15, fontWeight: 700, letterSpacing: "0.02em",
          }}>
            {up.status === "done" ? "✓" : `${up.pct}%`}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <input
          value={value || ""}
          placeholder="img/xxx.jpg  ou  https://…"
          readOnly
          style={{ marginBottom: 4, fontSize: external ? 11 : 13 }}
          title={value || ""}
        />
        {urlMode ? (
          <div style={{ display: "flex", gap: 6 }}>
            <input
              autoFocus
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitUrl(); } if (e.key === "Escape") setUrlMode(false); }}
              placeholder={urlHint || "https://lesgriots.b-cdn.net/projects/.../reel.mp4"}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn" style={{ padding: "4px 10px", fontSize: 11 }} onClick={submitUrl}>OK</button>
            <button type="button" className="btn btn--ghost" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setUrlMode(false)}>×</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <label className="btn btn--ghost" style={{ padding: "4px 10px", fontSize: 11, cursor: up.status === "uploading" ? "wait" : "pointer", opacity: up.status === "uploading" ? 0.6 : 1 }}>
              {up.status === "uploading" ? `Upload… ${up.pct}%` : up.status === "done" ? "✓ Uploadé" : "Upload"}
              <input
                type="file"
                accept={accept}
                disabled={up.status === "uploading"}
                onChange={(e) => { const file = e.target.files[0]; e.target.value = ""; doUpload(file); }}
                style={{ display: "none" }}
              />
            </label>
            <button type="button" className="btn btn--ghost" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => { setUrlDraft(external ? value : ""); setUrlMode(true); }}>
              Coller URL
            </button>
            {value && (
              <button type="button" className="btn btn--danger" style={{ padding: "4px 10px", fontSize: 11 }} onClick={onClear}>
                Retirer
              </button>
            )}
            {urlHint && !value && (
              <span style={{ fontSize: 10, color: "var(--dim)", alignSelf: "center" }}>{urlHint}</span>
            )}
          </div>
        )}

        {up.status === "uploading" && (
          <div style={{ marginTop: 6 }}>
            <div style={{ height: 4, background: "var(--rule)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${up.pct}%`, background: "var(--accent)", transition: "width 0.15s ease" }} />
            </div>
            <span style={{ fontSize: 10, color: "var(--dim)" }}>Upload en cours… {up.pct}%</span>
          </div>
        )}
        {up.status === "done" && (
          <span style={{ display: "inline-block", marginTop: 6, fontSize: 10, color: "var(--accent)" }}>✓ Vidéo uploadée</span>
        )}
        {up.status === "error" && (
          <span style={{ display: "inline-block", marginTop: 6, fontSize: 10, color: "var(--danger)" }}>✗ {up.err}</span>
        )}
      </div>
    </div>
  );
}
