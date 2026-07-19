// Archive : les tuiles du panneau Archive du site complet.
"use client";
import { useEffect, useRef, useState } from "react";
import { BP, mediaUrl } from "../../lib/bp.js";

function slugify(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `ar-${Date.now().toString(36)}`;
}

export default function ArchivePage() {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [kind, setKind] = useState("ok");
  const [confirmId, setConfirmId] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const uploadTarget = useRef(null);
  const fileInput = useRef(null);

  useEffect(() => { reload(); }, []);
  function flash(t, k = "ok") { setMsg(t); setKind(k); }

  async function reload() {
    const r = await fetch(`${BP}/api/archive`);
    setItems(await r.json());
  }

  async function saveItem(item, note = "✓ enregistré — pense à Sync") {
    setBusy(item.id);
    try {
      const r = await fetch(`${BP}/api/archive`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      await reload();
      if (note) flash(note);
    } catch (e) { flash(`✗ ${e.message}`, "err"); }
    setBusy("");
  }

  async function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const reorder = items.map((p, idx) => {
      let pos = idx + 1;
      if (idx === i) pos = j + 1;
      if (idx === j) pos = i + 1;
      return { id: p.id, position: pos };
    });
    setBusy("reorder");
    try {
      const r = await fetch(`${BP}/api/archive`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorder }),
      });
      setItems(await r.json());
      flash("✓ ordre mis à jour — pense à Sync");
    } catch (e) { flash(`✗ ${e.message}`, "err"); }
    setBusy("");
  }

  async function del(id) {
    if (confirmId !== id) { setConfirmId(id); return; }
    setConfirmId(null); setBusy(id);
    try {
      await fetch(`${BP}/api/archive?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await reload();
      flash("✓ tuile supprimée — pense à Sync");
    } catch (e) { flash(`✗ ${e.message}`, "err"); }
    setBusy("");
  }

  async function addItem() {
    const title = newTitle.trim();
    if (!title) { flash("✗ donne un titre à la tuile", "err"); return; }
    const id = slugify(title);
    await saveItem(
      { id, title, img: "", url: "", position: (items?.length || 0) + 1, hidden: false },
      `✓ « ${title} » ajouté — ajoute son image puis Sync`
    );
    setNewTitle("");
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const id = uploadTarget.current;
    if (!file || !id) return;
    setBusy(id);
    flash("… upload de l'image");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${BP}/api/upload`, { method: "POST", body: fd });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      const item = items.find((x) => x.id === id);
      await saveItem({ ...item, img: j.path });
    } catch (err) { flash(`✗ ${err.message}`, "err"); }
    setBusy("");
  }

  if (items === null) return (<><h1>archive</h1><p className="note">Chargement…</p></>);

  return (
    <>
      <h1>archive</h1>
      <p className="note" style={{ marginTop: -8, marginBottom: 20 }}>
        Les tuiles du panneau Archive (mosaïque). Le lien est optionnel.
      </p>

      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onFile} />

      <div className="projlib" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {items.map((a, i) => (
          <div key={a.id} className={`projcard${a.hidden ? " projcard--hidden" : ""}`} style={{ padding: 0 }}>
            <div className="projcard__thumb" style={{ aspectRatio: "16/9", overflow: "hidden", background: "#000" }}>
              {a.img ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={mediaUrl(a.img)} alt={a.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div className="mediatile__missing">pas d'image</div>
              )}
            </div>
            <div style={{ padding: "12px 14px" }}>
              <input type="text" defaultValue={a.title} key={`${a.id}-t`}
                onBlur={(e) => { if (e.target.value !== a.title) saveItem({ ...a, title: e.target.value }); }}
                style={{ width: "100%", fontWeight: 500 }} />
              <input type="text" defaultValue={a.url} key={`${a.id}-u`} placeholder="lien (optionnel)"
                onBlur={(e) => { if (e.target.value !== a.url) saveItem({ ...a, url: e.target.value }); }}
                style={{ width: "100%", marginTop: 6, fontSize: 12 }} />
              <div className="projcard__actions" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                <button className="projcard__act" disabled={!!busy || i === 0} onClick={() => move(i, -1)}>↑</button>
                <button className="projcard__act" disabled={!!busy || i === items.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button className="projcard__act" disabled={!!busy}
                  onClick={() => { uploadTarget.current = a.id; fileInput.current?.click(); }}>image</button>
                <button className="projcard__act" disabled={!!busy}
                  onClick={() => saveItem({ ...a, hidden: !a.hidden }, a.hidden ? "✓ visible — pense à Sync" : "✓ masqué — pense à Sync")}>
                  {a.hidden ? "afficher" : "masquer"}
                </button>
                <button className="projcard__act projcard__act--danger" disabled={!!busy} onClick={() => del(a.id)}>
                  {confirmId === a.id ? "confirmer ?" : "suppr."}
                </button>
              </div>
            </div>
          </div>
        ))}

        <div className="projcard" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
          <div className="bo-navgroup__title" style={{ border: "none", padding: 0 }}>Nouvelle tuile</div>
          <input type="text" placeholder="Titre" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <button className="btn" disabled={!!busy} onClick={addItem}>+ ajouter</button>
        </div>
      </div>

      {msg && (
        <p className="note" style={{ marginTop: 16, color: kind === "err" ? "var(--danger)" : "var(--accent)" }}>{msg}</p>
      )}
    </>
  );
}
