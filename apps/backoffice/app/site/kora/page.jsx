// Éditeur du SON DE KORA joué quand on clique sur le griot ASCII.
// Stocké en DB sous la clé "koraSound" = { path: "img/sounds/foo.mp3" }
// Le site lit window.SITE_CONTENT.koraSound après Sync. Si vide, le
// site utilise la mélodie synthétisée fallback (Web Audio API).
"use client";
import { useEffect, useRef, useState } from "react";

export default function KoraSoundPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [path, setPath] = useState("");
  const [msg, setMsg] = useState("");
  const fileRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    fetch("/api/site/koraSound")
      .then((r) => r.json())
      .then((j) => {
        if (j.value && typeof j.value === "object" && j.value.path) {
          setPath(j.value.path);
        }
        setLoading(false);
      });
  }, []);

  async function handleUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("subdir", "sounds");
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (r.ok && j.path) {
        setPath(j.path);
        setMsg(`✓ Uploadé : ${j.path}`);
      } else {
        setMsg(`✗ Erreur upload : ${j.error || "inconnue"}`);
      }
    } catch (err) {
      setMsg(`✗ Erreur réseau : ${err.message}`);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function save() {
    setSaving(true);
    setMsg("");
    const r = await fetch("/api/site/koraSound", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    setSaving(false);
    if (r.ok) {
      setMsg(`✓ Enregistré. Clique "Sync vers le site" sur la home pour publier.`);
    } else {
      setMsg("✗ Erreur lors de l'enregistrement");
    }
  }

  async function clear() {
    setPath("");
    setMsg("Champ vidé. Clique « Enregistrer » pour confirmer (le site repassera sur la mélodie synthétisée fallback).");
  }

  function preview() {
    if (!path || !audioRef.current) return;
    audioRef.current.src = `/api/preview?p=${encodeURIComponent(path)}`;
    audioRef.current.play().catch(() => {});
  }

  return (
    <div className="bo-form">
      <h1>Son du Griot — Kora</h1>
      <p className="bo-form__lead">
        Téléverse un fichier audio court (idéalement <code>.mp3</code> ou{" "}
        <code>.ogg</code>, &lt; 3s) qui sera joué quand un visiteur clique sur
        le griot ASCII. Si aucun son n'est défini, le site utilise une
        mélodie pentatonique synthétisée par défaut.
      </p>

      {loading ? (
        <p>Chargement…</p>
      ) : (
        <>
          <div className="bo-form__group">
            <label>Chemin du fichier audio</label>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="img/sounds/kora-xxx.mp3"
              spellCheck={false}
            />
            <small>Relatif au dossier <code>lesgriotsxstudio/</code>.</small>
          </div>

          <div className="bo-form__group">
            <label>Ou téléverse un nouveau fichier</label>
            <input
              ref={fileRef}
              type="file"
              accept="audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/webm,audio/*"
              onChange={handleUpload}
              disabled={uploading}
            />
            {uploading && <small>Upload en cours…</small>}
          </div>

          {path && (
            <div className="bo-form__group">
              <label>Prévisualisation</label>
              <button type="button" onClick={preview} className="bo-btn bo-btn--ghost">
                ▶ Écouter
              </button>
              <audio ref={audioRef} controls style={{ marginTop: 10, width: "100%" }} />
            </div>
          )}

          <div className="bo-form__actions">
            <button type="button" onClick={save} disabled={saving} className="bo-btn">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button type="button" onClick={clear} className="bo-btn bo-btn--ghost">
              Vider (revenir au synth fallback)
            </button>
          </div>

          {msg && <p className="bo-form__msg">{msg}</p>}
        </>
      )}
    </div>
  );
}
