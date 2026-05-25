// Composant d'upload média (image OU vidéo) + saisie manuelle de l'URL.
// Utilisé dans FormationForm pour la section Média.
//
// Comportement :
// - Bouton "Choisir un fichier" → upload via POST /api/upload
// - Si fichier vidéo (.mp4/.mov/...), set media.type = "video" auto
// - Si image, set media.type = "image"
// - Champ texte pour saisir une URL externe (vidéo hébergée Dropbox/etc)
// - Preview du fichier uploadé (img ou video player)
"use client";
import { useState } from "react";

export default function MediaInput({ value, onChange }) {
  const v = value || { type: "image", src: "", credit: "" };
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState("");

  function set(key, val) {
    onChange({ ...v, [key]: val });
  }

  async function upload(file) {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setErr("");

    // XHR au lieu de fetch pour avoir la progression d'upload
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    });

    xhr.addEventListener("load", () => {
      setUploading(false);
      setProgress(0);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const j = JSON.parse(xhr.responseText);
          // Met à jour à la fois src ET type (auto-détecté)
          onChange({ ...v, src: j.path, type: j.type || v.type });
        } catch {
          setErr("Réponse serveur invalide");
        }
      } else {
        try {
          const j = JSON.parse(xhr.responseText);
          setErr(j.error || `Erreur ${xhr.status}`);
        } catch {
          setErr(`Erreur ${xhr.status}`);
        }
      }
    });

    xhr.addEventListener("error", () => {
      setUploading(false);
      setProgress(0);
      setErr("Connexion au serveur perdue");
    });

    xhr.open("POST", "/api/upload");
    xhr.send(form);
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (file) upload(file);
  }

  const isVideo = v.type === "video" || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(v.src || "");
  const previewSrc = v.src
    ? (v.src.startsWith("http") ? v.src : `/api/preview?p=${encodeURIComponent(v.src)}`)
    : "";

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div>
          <label>Type</label>
          <select value={v.type || "image"} onChange={(e) => set("type", e.target.value)}>
            <option value="image">Image</option>
            <option value="video">Vidéo</option>
          </select>
        </div>
        <div>
          <label>Crédit (texte affiché)</label>
          <input value={v.credit || ""} onChange={(e) => set("credit", e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <label>Fichier (upload) ou URL externe</label>
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <input
            value={v.src || ""}
            placeholder="img/f-marque.jpg ou https://..."
            onChange={(e) => set("src", e.target.value)}
            style={{ flex: 1 }}
          />
          <label className="btn btn--ghost" style={{ margin: 0, cursor: "pointer", whiteSpace: "nowrap" }}>
            {uploading ? `↑ ${progress}%` : "↑ Uploader"}
            <input
              type="file"
              accept="image/*,video/*"
              onChange={onFile}
              disabled={uploading}
              style={{ display: "none" }}
            />
          </label>
        </div>
        {uploading && (
          <div style={{ height: 3, background: "var(--rule)", marginTop: 6 }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "var(--ink)", transition: "width 0.2s" }} />
          </div>
        )}
        {err && <p className="note" style={{ color: "var(--danger)" }}>✗ {err}</p>}
        <p className="note">
          Upload : image (.jpg, .png, .svg, .webp) ou vidéo (.mp4, .mov, .webm). Limite 500 Mo.
          Le fichier va dans <code>apps/lagriotheque/img/</code>.
        </p>
      </div>

      {/* Preview du média sélectionné */}
      {v.src && (
        <div style={{ marginTop: 18, border: "1px solid var(--rule)", padding: 8, background: "var(--paper)" }}>
          <p className="note" style={{ marginBottom: 8 }}>Aperçu :</p>
          {isVideo ? (
            <video
              src={previewSrc}
              controls
              muted
              style={{ width: "100%", maxHeight: 320, objectFit: "contain", background: "#000" }}
            />
          ) : (
            <img
              src={previewSrc}
              alt={v.credit || ""}
              style={{ width: "100%", maxHeight: 320, objectFit: "contain", background: "#000" }}
            />
          )}
        </div>
      )}
    </div>
  );
}
