// Éditeur de la page Écosystème du site studio (les 3 univers / planètes).
// Stocké en DB sous la clé "ecosystem" = { lesgriots:{…}, lesgriotsxstudio:{…}, lagriotheque:{…} }
// Chaque univers : kicker FR/EN, url, description FR/EN, et 3 médias
// (poster = fond au survol, preview = screenshot dans le terminal, videoSrc = vidéo de fond).
// La géométrie des orbites reste technique (non éditable ici).
"use client";
import { useEffect, useState } from "react";
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
  const [err, setErr] = useState("");
  const external = isExternal(value);
  const previewSrc = value ? (external ? value : `/api/preview?p=${encodeURIComponent(value)}`) : null;

  async function upload(file) {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `upload échoué (${r.status})`);
      onChange(j.path);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
      <div style={{ width: 84, height: 54, border: "1px solid var(--rule)", background: "#141210", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {previewSrc ? (
          isVideo
            ? <video src={previewSrc} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={previewSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : <span style={{ color: "var(--dim)", fontSize: 10 }}>—</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>{label}</div>
        <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="img/xxx.jpg  ou  https://…" style={{ marginBottom: 4 }} />
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <label className="btn btn--ghost" style={{ padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
            {busy ? "..." : "Upload"}
            <input type="file" accept={accept} onChange={(e) => { upload(e.target.files[0]); e.target.value = ""; }} style={{ display: "none" }} />
          </label>
          {value && <button type="button" className="btn btn--danger" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => onChange("")}>Retirer</button>}
          {err && <span style={{ fontSize: 10, color: "var(--danger)" }}>{err}</span>}
        </div>
      </div>
    </div>
  );
}
