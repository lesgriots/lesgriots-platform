// Projets (stage) : les slides de la stage d'accueil du site ombrelle
// (Florale, Indigo Cristal, Monument, …). CRUD + ordre + visibilité.
"use client";
import { useEffect, useRef, useState } from "react";
import { BP, mediaUrl, isVideo } from "../../lib/bp.js";

function slugify(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `proj-${Date.now().toString(36)}`;
}

export default function ProjectsPage() {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [kind, setKind] = useState("ok");
  const [confirmId, setConfirmId] = useState(null);
  const [newName, setNewName] = useState("");
  const uploadTarget = useRef(null); // { id, field } | { new: true }
  const fileInput = useRef(null);

  useEffect(() => { reload(); }, []);

  function flash(text, k = "ok") { setMsg(text); setKind(k); }

  async function reload() {
    const r = await fetch(`${BP}/api/projects`);
    setItems(await r.json());
  }

  async function saveProject(p, note = "✓ enregistré — pense à Sync") {
    setBusy(p.id);
    try {
      const r = await fetch(`${BP}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      await reload();
      if (note) flash(note);
    } catch (e) { flash(`✗ ${e.message}`, "err"); }
    setBusy("");
  }

  async function move(i, dir) {
    const arr = [...items];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    const reorder = arr.map((p, idx) => {
      let pos = idx + 1;
      if (idx === i) pos = j + 1;
      if (idx === j) pos = i + 1;
      return { id: p.id, position: pos };
    });
    setBusy("reorder");
    try {
      const r = await fetch(`${BP}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorder }),
      });
      setItems(await r.json());
      flash("✓ ordre mis à jour — pense à Sync");
    } catch (e) { flash(`✗ ${e.message}`, "err"); }
    setBusy("");
  }

  async function del(id) {
    if (confirmId !== id) { setConfirmId(id); return; }
    setConfirmId(null);
    setBusy(id);
    try {
      await fetch(`${BP}/api/projects?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await reload();
      flash("✓ projet supprimé — pense à Sync");
    } catch (e) { flash(`✗ ${e.message}`, "err"); }
    setBusy("");
  }

  function pickFile(target) {
    uploadTarget.current = target;
    fileInput.current?.click();
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const target = uploadTarget.current;
    if (!file || !target) return;
    setBusy(target.new ? "new" : target.id);
    flash(`… upload (${Math.round(file.size / 1e6)} Mo)`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${BP}/api/upload`, { method: "POST", body: fd });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      const type = isVideo(j.path) ? "video" : "image";
      if (target.new) {
        const name = newName.trim() || file.name.replace(/\.[^.]+$/, "");
        const id = slugify(name);
        await saveProject(
          { id, key: id, name, media: j.path, poster: "", type, position: (items?.length || 0) + 1, hidden: false },
          `✓ « ${name} » ajouté — pense à Sync`
        );
        setNewName("");
      } else {
        const p = items.find((x) => x.id === target.id);
        if (target.field === "poster") await saveProject({ ...p, poster: j.path });
        else await saveProject({ ...p, media: j.path, type });
      }
    } catch (err) { flash(`✗ ${err.message}`, "err"); }
    setBusy("");
  }

  if (items === null) return (<><h1>projets (stage)</h1><p className="note">Chargement…</p></>);

  return (
    <>
      <h1>projets (stage)</h1>
      <p className="note" style={{ marginTop: -8, marginBottom: 20 }}>
        Les slides de la stage d'accueil, dans l'ordre d'affichage. Un projet
        masqué reste dans le store mais n'est pas exporté vers le site.
      </p>

      <input ref={fileInput} type="file" accept="image/*,video/*" hidden onChange={onFile} />

      <div className="projlib" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {items.map((p, i) => (
          <div key={p.id} className={`projcard${p.hidden ? " projcard--hidden" : ""}`} style={{ padding: 0 }}>
            <div className="projcard__thumb" style={{ aspectRatio: "16/10", overflow: "hidden", background: "#111" }}>
              {p.media ? (
                isVideo(p.media) ? (
                  <video src={mediaUrl(p.media)} poster={p.poster ? mediaUrl(p.poster) : undefined}
                    muted loop playsInline
                    onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                    onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={mediaUrl(p.media)} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )
              ) : (
                <div className="mediatile__missing">média manquant</div>
              )}
            </div>
            <div style={{ padding: "12px 14px" }}>
              <input
                type="text" defaultValue={p.name} key={`${p.id}-name`}
                onBlur={(e) => { if (e.target.value !== p.name) saveProject({ ...p, name: e.target.value }); }}
                style={{ width: "100%", fontWeight: 600 }}
              />
              <div className="note" style={{ marginTop: 4 }}>
                #{i + 1} · {p.type}{p.hidden ? " · masqué" : ""}
              </div>
              <div className="projcard__actions" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                <button className="projcard__act" disabled={!!busy || i === 0} onClick={() => move(i, -1)} title="Monter">↑</button>
                <button className="projcard__act" disabled={!!busy || i === items.length - 1} onClick={() => move(i, 1)} title="Descendre">↓</button>
                <button className="projcard__act" disabled={!!busy} onClick={() => pickFile({ id: p.id, field: "media" })}>média</button>
                {isVideo(p.media) && (
                  <button className="projcard__act" disabled={!!busy} onClick={() => pickFile({ id: p.id, field: "poster" })}>poster</button>
                )}
                <button className="projcard__act" disabled={!!busy} onClick={() => saveProject({ ...p, hidden: !p.hidden }, p.hidden ? "✓ visible — pense à Sync" : "✓ masqué — pense à Sync")}>
                  {p.hidden ? "afficher" : "masquer"}
                </button>
                <button className="projcard__act projcard__act--danger" disabled={!!busy} onClick={() => del(p.id)}>
                  {confirmId === p.id ? "confirmer ?" : "suppr."}
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Carte d'ajout */}
        <div className="projcard" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
          <div className="bo-navgroup__title" style={{ border: "none", padding: 0 }}>Nouveau projet</div>
          <input
            type="text" placeholder="Nom (ex. Aïssata)" value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="btn" disabled={!!busy} onClick={() => pickFile({ new: true })}>
            {busy === "new" ? "…" : "+ média (image ou vidéo)"}
          </button>
          <div className="note">L'upload crée le projet directement.</div>
        </div>
      </div>

      {msg && (
        <p className="note" style={{ marginTop: 16, color: kind === "err" ? "var(--danger)" : "var(--accent)" }}>{msg}</p>
      )}
    </>
  );
}
