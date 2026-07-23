// Index (journal) : les entrées de la section Index du site complet.
// Chaque entrée = date, titre, image de fond, et le contenu de sa page
// projet (hero, intro, note, galerie).
"use client";
import { useEffect, useRef, useState } from "react";
import { BP, mediaUrl } from "../../lib/bp.js";

function slugify(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `entree-${Date.now().toString(36)}`;
}

export default function JournalPage() {
  const [items, setItems] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [kind, setKind] = useState("ok");
  const [confirmId, setConfirmId] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const uploadTarget = useRef(null); // { id, field } — field: img | hero | gallery
  const fileInput = useRef(null);

  useEffect(() => { reload(); }, []);
  function flash(t, k = "ok") { setMsg(t); setKind(k); }

  async function reload() {
    const r = await fetch(`${BP}/api/journal`);
    setItems(await r.json());
  }

  async function saveItem(item, note = "✓ enregistré — pense à Sync") {
    setBusy(item.id);
    try {
      const r = await fetch(`${BP}/api/journal`, {
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
      const r = await fetch(`${BP}/api/journal`, {
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
      await fetch(`${BP}/api/journal?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await reload();
      flash("✓ entrée supprimée — pense à Sync");
    } catch (e) { flash(`✗ ${e.message}`, "err"); }
    setBusy("");
  }

  async function addItem() {
    const title = newTitle.trim();
    if (!title) { flash("✗ donne un titre à l'entrée", "err"); return; }
    const id = slugify(title);
    await saveItem(
      { id, title, date: "x", img: "", hero: "", intro: "", note: "", gallery: [], position: (items?.length || 0) + 1, hidden: false },
      `✓ « ${title} » ajouté — ajoute son image puis Sync`
    );
    setNewTitle(""); setOpenId(id);
  }

  function pickFile(target) {
    uploadTarget.current = target;
    if (fileInput.current) fileInput.current.accept = target.field === "video_src" ? "video/*" : "image/*";
    fileInput.current?.click();
  }

  async function onFile(e) {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    const target = uploadTarget.current;
    if (!files.length || !target) return;
    setBusy(target.id);
    flash(`… upload (${files.length} fichier${files.length > 1 ? "s" : ""})`);
    try {
      const item = items.find((x) => x.id === target.id);
      let next = { ...item };
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const r = await fetch(`${BP}/api/upload`, { method: "POST", body: fd });
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        if (target.field === "gallery") next = { ...next, gallery: [...(next.gallery || []), j.path] };
        else next = { ...next, [target.field]: j.path };
      }
      await saveItem(next);
    } catch (err) { flash(`✗ ${err.message}`, "err"); }
    setBusy("");
  }

  if (items === null) return (<><h1>index — journal</h1><p className="note">Chargement…</p></>);

  return (
    <>
      <h1>index — <em>journal</em></h1>
      <p className="note" style={{ marginTop: -8, marginBottom: 20 }}>
        Les entrées de l'Index du site complet, dans l'ordre. Ouvre une entrée
        pour éditer sa page projet (hero, intro, note, galerie).
      </p>

      <input ref={fileInput} type="file" accept="image/*" hidden multiple onChange={onFile} />

      {items.map((it, i) => (
        <div key={it.id} className={`projcard${it.hidden ? " projcard--hidden" : ""}`} style={{ padding: "12px 16px", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ width: 86, aspectRatio: "16/10", flexShrink: 0, overflow: "hidden", background: "#000", cursor: "pointer" }}
              onClick={() => pickFile({ id: it.id, field: "img" })} title="Changer l'image de fond">
              {it.img ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={mediaUrl(it.img)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div className="mediatile__missing" style={{ fontSize: 10 }}>image</div>
              )}
            </div>
            <input type="text" defaultValue={it.date} key={`${it.id}-d`} title="Date (ex. 26-05-12, ou x)"
              onBlur={(e) => { if (e.target.value !== it.date) saveItem({ ...it, date: e.target.value }); }}
              style={{ width: 92, fontFamily: "var(--font-mono)", fontSize: 12 }} />
            <input type="text" defaultValue={it.title} key={`${it.id}-t`}
              onBlur={(e) => { if (e.target.value !== it.title) saveItem({ ...it, title: e.target.value }); }}
              style={{ flex: 1, minWidth: 180, fontWeight: 500 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <button className="projcard__act" disabled={!!busy || i === 0} onClick={() => move(i, -1)}>↑</button>
              <button className="projcard__act" disabled={!!busy || i === items.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button className="projcard__act" disabled={!!busy}
                onClick={() => setOpenId(openId === it.id ? null : it.id)}>
                {openId === it.id ? "fermer" : "page projet"}
              </button>
              <button className="projcard__act" disabled={!!busy}
                onClick={() => saveItem({ ...it, hidden: !it.hidden }, it.hidden ? "✓ visible — pense à Sync" : "✓ masqué — pense à Sync")}>
                {it.hidden ? "afficher" : "masquer"}
              </button>
              <button className="projcard__act projcard__act--danger" disabled={!!busy} onClick={() => del(it.id)}>
                {confirmId === it.id ? "confirmer ?" : "suppr."}
              </button>
            </div>
          </div>

          {openId === it.id && (
            <div className="media-editor" style={{ marginTop: 14 }}>
              <div className="row">
                <div>
                  <label>Hero de la page projet (sinon image de fond)</label>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {it.hero ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={mediaUrl(it.hero)} alt="" style={{ width: 120, aspectRatio: "16/9", objectFit: "cover" }} />
                    ) : <span className="note">— hérite de l'image de fond —</span>}
                    <button className="btn btn--ghost" disabled={!!busy} onClick={() => pickFile({ id: it.id, field: "hero" })}>
                      {it.hero ? "Remplacer" : "Uploader"}
                    </button>
                    {it.hero && (
                      <button className="projcard__act projcard__act--danger" disabled={!!busy}
                        onClick={() => saveItem({ ...it, hero: "" })}>retirer</button>
                    )}
                  </div>
                </div>
                <div>
                  <label>Intro (sous le hero)</label>
                  <textarea rows={3} defaultValue={it.intro} key={`${it.id}-i`}
                    onBlur={(e) => { if (e.target.value !== it.intro) saveItem({ ...it, intro: e.target.value }); }} />
                </div>
              </div>
              <label>Note (crédits, contexte)</label>
              <textarea rows={2} defaultValue={it.note} key={`${it.id}-n`}
                onBlur={(e) => { if (e.target.value !== it.note) saveItem({ ...it, note: e.target.value }); }} />

              <label>Galerie ({(it.gallery || []).length} image{(it.gallery || []).length > 1 ? "s" : ""})</label>
              <div className="medialib">
                {(it.gallery || []).map((g, gi) => (
                  <div key={gi} className="mediatile">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl(g)} alt="" />
                    <button className="mediatile__remove" title="Retirer"
                      onClick={() => saveItem({ ...it, gallery: it.gallery.filter((_, x) => x !== gi) })}>✕</button>
                  </div>
                ))}
                <button type="button" className="mediatile mediatile--add" disabled={!!busy}
                  onClick={() => pickFile({ id: it.id, field: "gallery" })}>
                  <span className="plus">+</span> ajouter
                </button>
              </div>

              <label>Vidéo de la page projet (mp4, après le nom)</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {it.video_src ? (
                  <video src={mediaUrl(it.video_src)} muted playsInline
                    style={{ width: 160, aspectRatio: "16/9", objectFit: "cover", background: "#000" }} />
                ) : <span className="note">— aucune vidéo —</span>}
                <button className="btn btn--ghost" disabled={!!busy} onClick={() => pickFile({ id: it.id, field: "video_src" })}>
                  {it.video_src ? "Remplacer la vidéo" : "Uploader une vidéo"}
                </button>
                <button className="btn btn--ghost" disabled={!!busy || !it.video_src} onClick={() => pickFile({ id: it.id, field: "video_poster" })}>
                  {it.video_poster ? "Changer le poster" : "Poster"}
                </button>
                {it.video_src && (
                  <button className="projcard__act projcard__act--danger" disabled={!!busy}
                    onClick={() => saveItem({ ...it, video_src: "", video_poster: "" })}>retirer</button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="projcard" style={{ padding: "16px 18px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div className="bo-navgroup__title" style={{ border: "none", padding: 0 }}>Nouvelle entrée</div>
        <input type="text" placeholder="Titre (ex. Tralé)" value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <button className="btn" disabled={!!busy} onClick={addItem}>+ ajouter</button>
      </div>

      {msg && (
        <p className="note" style={{ marginTop: 16, color: kind === "err" ? "var(--danger)" : "var(--accent)" }}>{msg}</p>
      )}
    </>
  );
}
