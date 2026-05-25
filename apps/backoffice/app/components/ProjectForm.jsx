// Composant partagé entre /projects/new et /projects/[id].
// Gère tous les champs d'un projet + uploads de médias (cover, thumbVideo, strip, resources).
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
    strip: f.strip.filter(Boolean),
    resources: f.resources.filter((r) => r.src && r.src.trim()),
    credits,
    tags: f.tags.filter(Boolean),
    hidden: !!f.hidden,
  };
}

// Upload helper : POST multipart vers /api/upload, renvoie le path relatif.
async function uploadFile(file, subdir = "") {
  const fd = new FormData();
  fd.append("file", file);
  if (subdir) fd.append("subdir", subdir);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  if (!r.ok) throw new Error("upload failed");
  const j = await r.json();
  return j.path;
}

export default function ProjectForm({ initial, isNew }) {
  const router = useRouter();
  const [f, setF] = useState(projectToForm(initial));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  function set(k, v) { setF((p) => ({ ...p, [k]: v })); }

  // ---- COVER -----------------------------------------------------------
  async function handleCover(file) {
    if (!file) return;
    try { set("cover", await uploadFile(file)); }
    catch (e) { setErr(e.message); }
  }
  // ---- THUMB VIDEO -----------------------------------------------------
  async function handleThumbVideo(file) {
    if (!file) return;
    try { set("thumbVideo", await uploadFile(file)); }
    catch (e) { setErr(e.message); }
  }
  // ---- RESOURCES (médias détaillés du projet) -------------------------
  function resourceAdd(type) {
    const blank = type === "video"
      ? { type: "video", src: "", poster: "", label: "", aspect: "16/9" }
      : { type: "image", src: "", label: "", aspect: "16/9" };
    set("resources", [...f.resources, blank]);
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
  async function resourceUpload(i, field, file) {
    if (!file) return;
    try {
      const p = await uploadFile(file);
      resourcePatch(i, { [field]: p });
    } catch (e) { setErr(e.message); }
  }
  function resourceSetUrl(i, field, url) {
    resourcePatch(i, { [field]: url });
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
    <form onSubmit={submit}>
      <h2>Identité</h2>
      <div className="row">
        <div>
          <label>ID (slug, immuable)</label>
          <input
            value={f.id}
            onChange={(e) => set("id", e.target.value)}
            disabled={!isNew}
            placeholder="ava-x-nike-courir"
            required
          />
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
        onChange={(e) => set("name", e.target.value)}
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

      <h2>Médias</h2>

      <label>
        Cover (image principale visible sur la home)
        <span style={{ color: "var(--accent)", marginLeft: 6 }}>* recommandé</span>
      </label>
      {!f.cover && (
        <p className="note" style={{ marginTop: 0, marginBottom: 6, color: "var(--dim)" }}>
          ⚠ Si tu n'ajoutes pas de cover, un placeholder jaune avec le nom du projet sera affiché à la place. Tu peux toujours sauver sans, mais ça aura l'air bien plus pro avec une image.
        </p>
      )}
      <MediaInput
        value={f.cover}
        onUpload={handleCover}
        onUrl={(url) => set("cover", url)}
        onClear={() => set("cover", "")}
        accept="image/*"
      />

      <label>Thumb video (mp4 court qui se lance au hover — optionnel)</label>
      <MediaInput
        value={f.thumbVideo}
        onUpload={handleThumbVideo}
        onUrl={(url) => set("thumbVideo", url)}
        onClear={() => set("thumbVideo", "")}
        accept="video/mp4"
        isVideo
      />

      {/* Section "Strip" retirée — le champ existait dans data.jsx mais n'est
          affiché nulle part sur le site. Les valeurs existantes restent en DB
          et sont préservées par l'exporter, simplement plus éditables ici. */}

      <h2>Galerie (médias du projet)</h2>
      <p className="note">Un par bloc média sur la page projet. Image ou vidéo, ratio libre. Upload local ou URL externe (Bunny, R2, Cloudflare).</p>
      <p className="note">Un par bloc média sur la page projet. Image ou vidéo, ratio libre.</p>
      {f.resources.map((r, i) => (
        <div key={i} className="resource">
          <div className="resource__head">
            <strong>#{i + 1} — {r.type}</strong>
            <span>
              <button type="button" className="btn btn--ghost" style={btnTiny} onClick={() => resourceMove(i, -1)}>↑</button>
              <button type="button" className="btn btn--ghost" style={btnTiny} onClick={() => resourceMove(i, +1)}>↓</button>
              <button type="button" className="btn btn--danger" style={btnTiny} onClick={() => resourceRemove(i)}>×</button>
            </span>
          </div>
          <div className="row">
            <div>
              <label>Source ({r.type})</label>
              <MediaInput
                value={r.src}
                onUpload={(file) => resourceUpload(i, "src", file)}
                onUrl={(url) => resourceSetUrl(i, "src", url)}
                onClear={() => resourcePatch(i, { src: "" })}
                accept={r.type === "video" ? "video/*" : "image/*"}
                isVideo={r.type === "video"}
                // Pour les vidéos lourdes, on recommande de coller un URL Bunny/R2 plutôt qu'uploader
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
        </div>
      ))}
      <div className="actions" style={{ marginTop: 12 }}>
        <button type="button" className="btn btn--ghost" onClick={() => resourceAdd("image")}>+ Image</button>
        <button type="button" className="btn btn--ghost" onClick={() => resourceAdd("video")}>+ Vidéo</button>
      </div>

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
  const external = isExternalUrl(value);
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
        {external && (
          <span style={{
            position: "absolute", top: 2, left: 2, padding: "1px 4px",
            background: "var(--accent)", color: "#000", fontSize: 9, fontWeight: 700,
            letterSpacing: "0.05em",
          }}>URL</span>
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
            <label className="btn btn--ghost" style={{ padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
              Upload
              <input
                type="file"
                accept={accept}
                onChange={(e) => { onUpload(e.target.files[0]); e.target.value = ""; }}
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
      </div>
    </div>
  );
}
