// Champ d'upload de fichier unique (PDF, image, etc.) + saisie manuelle d'URL.
// Utilisé pour les ressources : on uploade un PDF/template et la valeur stockée
// devient le chemin relatif (ex: img/ressources/guide-xxxx.pdf).
//
// Comportement :
// - Bouton "Uploader" → POST /api/upload (multipart) avec progression XHR
// - Input texte à gauche pour coller une URL externe au lieu d'uploader
// - Lien "voir le fichier" apparaît une fois quelque chose est renseigné
"use client";
import { useState } from "react";

export default function FileInput({ value, onChange, accept, subdir, placeholder }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState("");

  function upload(file) {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setErr("");

    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);
    if (subdir) form.append("subdir", subdir);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    });

    xhr.addEventListener("load", () => {
      setUploading(false);
      setProgress(0);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const j = JSON.parse(xhr.responseText);
          onChange(j.path);
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
      setErr("Connexion perdue");
    });

    xhr.open("POST", "/api/upload");
    xhr.send(form);
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (file) upload(file);
    // Reset l'input pour permettre de réuploader le même fichier
    e.target.value = "";
  }

  const v = value || "";
  // Si valeur ressemble à un chemin relatif (img/...), on passe par /api/preview
  // qui sait servir le fichier depuis apps/lagriotheque/img/. Sinon URL directe.
  const isRelative = v && !v.startsWith("http") && !v.startsWith("/") && !v.startsWith("#");
  const previewSrc = isRelative ? `/api/preview?p=${encodeURIComponent(v)}` : v;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        <input
          value={v}
          placeholder={placeholder || "img/ressources/fichier.pdf ou https://..."}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1 }}
        />
        <label
          className="btn btn--ghost"
          style={{ margin: 0, cursor: uploading ? "wait" : "pointer", whiteSpace: "nowrap" }}
        >
          {uploading ? `↑ ${progress}%` : "↑ Uploader"}
          <input
            type="file"
            accept={accept || ".pdf,.jpg,.jpeg,.png,.svg,.webp,.mp4,.mov"}
            onChange={onFile}
            disabled={uploading}
            style={{ display: "none" }}
          />
        </label>
      </div>
      {uploading && (
        <div style={{ height: 3, background: "var(--rule)", marginTop: 6 }}>
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "var(--ink)",
              transition: "width 0.2s",
            }}
          />
        </div>
      )}
      {err && <p className="note" style={{ color: "var(--danger)" }}>✗ {err}</p>}
      {v && v !== "#" && !uploading && (
        <p className="note" style={{ marginTop: 6 }}>
          → <a href={previewSrc} target="_blank" rel="noopener">voir le fichier</a>
        </p>
      )}
    </div>
  );
}
