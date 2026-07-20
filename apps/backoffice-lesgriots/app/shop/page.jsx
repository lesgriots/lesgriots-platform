// Boutique : les articles du shop-panel du site ombrelle.
"use client";
import { useEffect, useRef, useState } from "react";
import { BP, mediaUrl } from "../../lib/bp.js";

function slugify(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `item-${Date.now().toString(36)}`;
}

export default function ShopPage() {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [kind, setKind] = useState("ok");
  const [confirmId, setConfirmId] = useState(null);
  const [draft, setDraft] = useState({ name: "", price: "", url: "" });
  const uploadTarget = useRef(null); // { id, field: 'img' | 'gallery' }
  const fileInput = useRef(null);

  useEffect(() => { reload(); }, []);

  function flash(text, k = "ok") { setMsg(text); setKind(k); }

  async function reload() {
    const r = await fetch(`${BP}/api/shop`);
    setItems(await r.json());
  }

  async function saveItem(item, note = "✓ enregistré — pense à Sync") {
    setBusy(item.id);
    try {
      const r = await fetch(`${BP}/api/shop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      await reload();
      if (note) flash(note);
    } catch (e) { flash(`✗ ${e.message}`, "err"); }
    setBusy("");
  }

  async function del(id) {
    if (confirmId !== id) { setConfirmId(id); return; }
    setConfirmId(null);
    setBusy(id);
    try {
      await fetch(`${BP}/api/shop?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await reload();
      flash("✓ article supprimé — pense à Sync");
    } catch (e) { flash(`✗ ${e.message}`, "err"); }
    setBusy("");
  }

  async function addItem() {
    const name = draft.name.trim();
    if (!name) { flash("✗ donne un nom à l'article", "err"); return; }
    const id = slugify(name);
    await saveItem(
      { id, name, price: draft.price, url: draft.url, img: "", position: (items?.length || 0) + 1, hidden: false },
      `✓ « ${name} » ajouté — ajoute son image puis Sync`
    );
    setDraft({ name: "", price: "", url: "" });
  }

  async function onFile(e) {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    const target = uploadTarget.current;
    if (!files.length || !target) return;
    const { id, field } = typeof target === "string" ? { id: target, field: "img" } : target;
    setBusy(id);
    flash(`… upload (${files.length} image${files.length > 1 ? "s" : ""})`);
    try {
      const item = items.find((x) => x.id === id);
      let next = { ...item };
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const r = await fetch(`${BP}/api/upload`, { method: "POST", body: fd });
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        if (field === "gallery") next = { ...next, gallery: [...(next.gallery || []), j.path] };
        else next = { ...next, img: j.path };
      }
      await saveItem(next);
    } catch (err) { flash(`✗ ${err.message}`, "err"); }
    setBusy("");
  }

  if (items === null) return (<><h1>boutique</h1><p className="note">Chargement…</p></>);

  return (
    <>
      <h1>boutique</h1>
      <p className="note" style={{ marginTop: -8, marginBottom: 20 }}>
        Les articles du shop-panel : nom, prix affiché tel quel (ex. « 45 € »),
        lien d'achat, visuel.
      </p>

      <input ref={fileInput} type="file" accept="image/*" hidden multiple onChange={onFile} />

      <div className="projlib" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {items.map((s) => (
          <div key={s.id} className={`projcard${s.hidden ? " projcard--hidden" : ""}`} style={{ padding: 0 }}>
            <div className="projcard__thumb" style={{ aspectRatio: "1", overflow: "hidden", background: "#111" }}>
              {s.img ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={mediaUrl(s.img)} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div className="mediatile__missing">pas d'image</div>
              )}
            </div>
            <div style={{ padding: "12px 14px" }}>
              <input type="text" defaultValue={s.name} key={`${s.id}-name`}
                onBlur={(e) => { if (e.target.value !== s.name) saveItem({ ...s, name: e.target.value }); }}
                style={{ width: "100%", fontWeight: 600 }} />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input type="text" defaultValue={s.price} key={`${s.id}-price`} placeholder="45 €"
                  onBlur={(e) => { if (e.target.value !== s.price) saveItem({ ...s, price: e.target.value }); }}
                  style={{ width: 90 }} />
                <input type="text" defaultValue={s.url} key={`${s.id}-url`} placeholder="lien d'achat"
                  onBlur={(e) => { if (e.target.value !== s.url) saveItem({ ...s, url: e.target.value }); }}
                  style={{ flex: 1 }} />
              </div>
              <textarea rows={2} defaultValue={s.desc} key={`${s.id}-desc`} placeholder="Description (fiche produit)"
                onBlur={(e) => { if (e.target.value !== (s.desc || "")) saveItem({ ...s, desc: e.target.value }); }}
                style={{ width: "100%", marginTop: 6, fontSize: 12, minHeight: 48 }} />
              {/* Galerie de la fiche produit (carrousel à points sur le site) */}
              <div className="medialib" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))", margin: "8px 0 0" }}>
                {(s.gallery || []).map((g, gi) => (
                  <div key={gi} className="mediatile">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl(g)} alt="" />
                    <button className="mediatile__remove" title="Retirer"
                      onClick={() => saveItem({ ...s, gallery: s.gallery.filter((_, x) => x !== gi) })}>✕</button>
                  </div>
                ))}
                <button type="button" className="mediatile mediatile--add" disabled={!!busy}
                  onClick={() => { uploadTarget.current = { id: s.id, field: "gallery" }; fileInput.current?.click(); }}
                  title="Ajouter des images à la fiche (carrousel)">
                  <span className="plus">+</span>
                </button>
              </div>
              <div className="projcard__actions" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                <button className="projcard__act" disabled={!!busy}
                  onClick={() => { uploadTarget.current = { id: s.id, field: "img" }; fileInput.current?.click(); }}>
                  image
                </button>
                <button className="projcard__act" disabled={!!busy}
                  onClick={() => saveItem({ ...s, hidden: !s.hidden }, s.hidden ? "✓ visible — pense à Sync" : "✓ masqué — pense à Sync")}>
                  {s.hidden ? "afficher" : "masquer"}
                </button>
                <button className="projcard__act projcard__act--danger" disabled={!!busy} onClick={() => del(s.id)}>
                  {confirmId === s.id ? "confirmer ?" : "suppr."}
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Carte d'ajout */}
        <div className="projcard" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
          <div className="bo-navgroup__title" style={{ border: "none", padding: 0 }}>Nouvel article</div>
          <input type="text" placeholder="Nom" value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input type="text" placeholder="Prix (ex. 45 €)" value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
          <input type="text" placeholder="Lien d'achat" value={draft.url}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
          <button className="btn" disabled={!!busy} onClick={addItem}>+ ajouter</button>
        </div>
      </div>

      {msg && (
        <p className="note" style={{ marginTop: 16, color: kind === "err" ? "var(--danger)" : "var(--accent)" }}>{msg}</p>
      )}
    </>
  );
}
