// About + liens : texte du panneau About et liens vers les 3 sites de
// l'écosystème (avec visuel chacun).
"use client";
import { useEffect, useRef, useState } from "react";
import { BP, mediaUrl } from "../../lib/bp.js";

export default function AboutPage() {
  const [about, setAbout] = useState(null); // { text, links }
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");
  const [kind, setKind] = useState("ok");
  const uploadIndex = useRef(null);
  const fileInput = useRef(null);

  useEffect(() => {
    fetch(`${BP}/api/about`).then((r) => r.json()).then(setAbout)
      .catch(() => setAbout({ text: "", links: [] }));
  }, []);

  function flash(text, k = "ok") { setMsg(text); setKind(k); }
  function patch(next) { setAbout(next); setDirty(true); }

  function patchLink(i, field, value) {
    setAbout((prev) => {
      const links = prev.links.map((l, idx) => (idx === i ? { ...l, [field]: value } : l));
      return { ...prev, links };
    });
    setDirty(true);
  }

  async function save() {
    setBusy(true);
    try {
      const r = await fetch(`${BP}/api/about`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(about),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setAbout(j); setDirty(false);
      flash("✓ enregistré — pense à Sync");
    } catch (e) { flash(`✗ ${e.message}`, "err"); }
    setBusy(false);
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const i = uploadIndex.current;
    if (!file || i === null) return;
    setBusy(true);
    flash("… upload de l'image");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${BP}/api/upload`, { method: "POST", body: fd });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      patchLink(i, "img", j.path);
      flash("✓ image en place — clique Enregistrer");
    } catch (err) { flash(`✗ ${err.message}`, "err"); }
    setBusy(false);
  }

  if (about === null) return (<><h1>about + liens</h1><p className="note">Chargement…</p></>);

  return (
    <>
      <h1>about + liens</h1>
      <p className="note" style={{ marginTop: -8, marginBottom: 20 }}>
        Le texte du panneau About et les liens vers les sites de l'écosystème.
      </p>

      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onFile} />

      <div className="media-editor" style={{ maxWidth: 720 }}>
        <div className="bo-navgroup__title" style={{ border: "none", padding: 0, marginBottom: 6 }}>Texte</div>
        <textarea
          rows={7} value={about.text}
          onChange={(e) => patch({ ...about, text: e.target.value })}
          placeholder="Le texte du panneau About…"
          style={{ width: "100%", display: "block" }}
        />

        <div className="bo-navgroup__title" style={{ border: "none", padding: 0, margin: "14px 0 6px" }}>Texte — English</div>
        <textarea
          rows={7} value={about.text_en || ""}
          onChange={(e) => patch({ ...about, text_en: e.target.value })}
          placeholder="English version (enables the FR / EN toggle on the site)…"
          style={{ width: "100%", display: "block" }}
        />

        <div className="bo-navgroup__title" style={{ border: "none", padding: 0, margin: "18px 0 6px" }}>
          Liens écosystème
        </div>
        {about.links.map((l, i) => (
          <div key={i} className="projcard" style={{ padding: "14px 16px", marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ width: 96, flexShrink: 0 }}>
                {l.img ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={mediaUrl(l.img)} alt={l.label} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
                ) : (
                  <div className="empty" style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
                    pas d'image
                  </div>
                )}
                <button className="projcard__act" disabled={busy} style={{ marginTop: 6, width: "100%" }}
                  onClick={() => { uploadIndex.current = i; fileInput.current?.click(); }}>
                  image
                </button>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <label className="note" style={{ display: "block", marginBottom: 6 }}>
                  label
                  <input type="text" value={l.label} onChange={(e) => patchLink(i, "label", e.target.value)}
                    style={{ width: "100%", display: "block", marginTop: 2 }} />
                </label>
                <label className="note" style={{ display: "block", marginBottom: 6 }}>
                  url
                  <input type="text" value={l.url} onChange={(e) => patchLink(i, "url", e.target.value)}
                    style={{ width: "100%", display: "block", marginTop: 2 }} />
                </label>
                <label className="note" style={{ display: "block", marginBottom: 6 }}>
                  titre de section (sinon le label)
                  <input type="text" value={l.title || ""} onChange={(e) => patchLink(i, "title", e.target.value)}
                    placeholder="LESGRIOTSxSTUDIO" style={{ width: "100%", display: "block", marginTop: 2 }} />
                </label>
                <label className="note" style={{ display: "block", marginBottom: 6 }}>
                  texte éditorial (écran Saint Heron)
                  <textarea rows={5} value={l.desc || ""} onChange={(e) => patchLink(i, "desc", e.target.value)}
                    style={{ width: "100%", display: "block", marginTop: 2 }} />
                </label>
                <button className="projcard__act projcard__act--danger" disabled={busy}
                  onClick={() => patch({ ...about, links: about.links.filter((_, idx) => idx !== i) })}>
                  retirer ce lien
                </button>
              </div>
            </div>
          </div>
        ))}

        <div className="row" style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button className="btn btn--ghost" disabled={busy}
            onClick={() => patch({ ...about, links: [...about.links, { label: "", url: "https://", img: "" }] })}>
            + ajouter un lien
          </button>
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
