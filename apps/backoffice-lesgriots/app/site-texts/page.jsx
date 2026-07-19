// Textes & méta : titre/description de la page, textes épars, réseaux.
"use client";
import { useEffect, useState } from "react";
import { BP } from "../../lib/bp.js";

export default function SiteTextsPage() {
  const [data, setData] = useState(null); // { meta, texts, social }
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  const [kind, setKind] = useState("ok");

  useEffect(() => {
    fetch(`${BP}/api/site-texts`).then((r) => r.json()).then(setData)
      .catch(() => setData({ meta: {}, texts: {}, social: {} }));
  }, []);

  function patch(section, field, value) {
    setData({ ...data, [section]: { ...data[section], [field]: value } });
    setDirty(true);
  }

  async function save() {
    setBusy(true);
    try {
      const r = await fetch(`${BP}/api/site-texts`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setData(j); setDirty(false);
      setMsg("✓ enregistré — pense à Sync"); setKind("ok");
    } catch (e) { setMsg(`✗ ${e.message}`); setKind("err"); }
    setBusy(false);
  }

  if (data === null) return (<><h1>textes & méta</h1><p className="note">Chargement…</p></>);

  return (
    <>
      <h1>textes & <em>méta</em></h1>
      <p className="note" style={{ marginTop: -8, marginBottom: 20 }}>
        Le titre d'onglet, la description pour les moteurs de recherche, et les
        petits textes qui traînent dans le site.
      </p>

      <div className="media-editor" style={{ maxWidth: 720 }}>
        <label>Titre de l'onglet (balise &lt;title&gt;)</label>
        <input type="text" value={data.meta.title || ""} onChange={(e) => patch("meta", "title", e.target.value)} />

        <label>Description (moteurs de recherche & partages)</label>
        <textarea rows={3} value={data.meta.description || ""} onChange={(e) => patch("meta", "description", e.target.value)} />

        <label>Sous-titre du player (sous le titre d'un épisode)</label>
        <input type="text" value={data.texts.playerSub || ""} onChange={(e) => patch("texts", "playerSub", e.target.value)} />

        <label>Footer de l'Index</label>
        <input type="text" value={data.texts.footer || ""} onChange={(e) => patch("texts", "footer", e.target.value)} />

        <label>Lien Instagram</label>
        <input type="text" value={data.social.instagram || ""} onChange={(e) => patch("social", "instagram", e.target.value)} />

        <div className="actions">
          <button className="btn" disabled={busy || !dirty} onClick={save}>
            {busy ? "…" : dirty ? "Enregistrer" : "Enregistré ✓"}
          </button>
        </div>
      </div>

      {msg && (
        <p className="note" style={{ marginTop: 16, color: kind === "err" ? "var(--danger)" : "var(--accent)" }}>{msg}</p>
      )}
    </>
  );
}
