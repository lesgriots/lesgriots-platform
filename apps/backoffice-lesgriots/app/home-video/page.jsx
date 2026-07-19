// Vidéo d'accueil : la boucle plein écran de la stage-home du site ombrelle.
// Upload (conversion + faststart côté serveur) ou URL directe, + poster.
"use client";
import { useEffect, useRef, useState } from "react";
import { BP, mediaUrl } from "../../lib/bp.js";

export default function HomeVideoPage() {
  const [video, setVideo] = useState(null); // { src, poster } | null (chargement)
  const [busy, setBusy] = useState("");     // "" | "video" | "poster" | "save"
  const [msg, setMsg] = useState("");
  const [kind, setKind] = useState("ok");
  const fileVideo = useRef(null);
  const filePoster = useRef(null);

  useEffect(() => {
    fetch(`${BP}/api/home-video`)
      .then((r) => r.json())
      .then(setVideo)
      .catch(() => setVideo({ src: "", poster: "" }));
  }, []);

  function flash(text, k = "ok") {
    setMsg(text); setKind(k);
  }

  async function upload(file, field) {
    if (!file) return;
    setBusy(field);
    flash(`… upload ${field === "video" ? "de la vidéo" : "du poster"} (${Math.round(file.size / 1e6)} Mo)`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${BP}/api/upload`, { method: "POST", body: fd });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      const next = field === "video" ? { ...video, src: j.path } : { ...video, poster: j.path };
      await save(next, true);
      flash(`✓ ${field === "video" ? "vidéo" : "poster"} en place${j.converted ? ` (${j.converted})` : ""}${j.storage === "r2" ? " · stockée sur R2" : ""} — pense à Sync`);
    } catch (e) {
      flash(`✗ ${e.message}`, "err");
    }
    setBusy("");
  }

  async function save(next, silent = false) {
    setBusy("save");
    try {
      const r = await fetch(`${BP}/api/home-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setVideo(j);
      if (!silent) flash("✓ enregistré — pense à Sync");
    } catch (e) {
      flash(`✗ ${e.message}`, "err");
    }
    setBusy("");
  }

  if (video === null) return (<><h1>vidéo d'accueil</h1><p className="note">Chargement…</p></>);

  const hasVideo = !!video.src;

  return (
    <>
      <h1>vidéo d'accueil</h1>
      <p className="note" style={{ marginTop: -8, marginBottom: 20 }}>
        La boucle plein écran de la page d'accueil du site ombrelle. Formats
        acceptés : mp4/webm directs, mov/avi convertis automatiquement.
      </p>

      <div className="media-editor" style={{ maxWidth: 720 }}>
        {hasVideo ? (
          <video
            key={video.src}
            src={mediaUrl(video.src)}
            poster={video.poster ? mediaUrl(video.poster) : undefined}
            controls muted loop playsInline
            style={{ width: "100%", display: "block", background: "#000" }}
          />
        ) : (
          <div className="empty" style={{ padding: "48px 20px", textAlign: "center" }}>
            Aucune vidéo définie.
          </div>
        )}

        <div className="row" style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn" disabled={!!busy} onClick={() => fileVideo.current?.click()}>
            {busy === "video" ? "…" : hasVideo ? "Remplacer la vidéo" : "Uploader une vidéo"}
          </button>
          <button type="button" className="btn btn--ghost" disabled={!!busy} onClick={() => filePoster.current?.click()}>
            {busy === "poster" ? "…" : video.poster ? "Remplacer le poster" : "Ajouter un poster"}
          </button>
          {hasVideo && (
            <button
              type="button" className="btn btn--danger" disabled={!!busy}
              onClick={() => save({ src: "", poster: "" })}
            >
              Retirer
            </button>
          )}
        </div>

        <input ref={fileVideo} type="file" accept="video/*" hidden
          onChange={(e) => { upload(e.target.files?.[0], "video"); e.target.value = ""; }} />
        <input ref={filePoster} type="file" accept="image/*" hidden
          onChange={(e) => { upload(e.target.files?.[0], "poster"); e.target.value = ""; }} />

        <div style={{ marginTop: 18 }}>
          <div className="bo-navgroup__title" style={{ border: "none", padding: 0, marginBottom: 6 }}>
            Chemins (édition manuelle)
          </div>
          <label className="note" style={{ display: "block", marginBottom: 8 }}>
            src
            <input
              type="text" value={video.src}
              onChange={(e) => setVideo({ ...video, src: e.target.value })}
              onBlur={() => save(video, true)}
              placeholder="assets/florale.mp4 ou https://media…"
              style={{ width: "100%", display: "block", marginTop: 4 }}
            />
          </label>
          <label className="note" style={{ display: "block" }}>
            poster
            <input
              type="text" value={video.poster}
              onChange={(e) => setVideo({ ...video, poster: e.target.value })}
              onBlur={() => save(video, true)}
              placeholder="assets/florale.jpg"
              style={{ width: "100%", display: "block", marginTop: 4 }}
            />
          </label>
        </div>

        {video.poster && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={mediaUrl(video.poster)} alt="poster" style={{ marginTop: 12, maxWidth: 240, display: "block" }} />
        )}
      </div>

      {msg && (
        <p className="note" style={{ marginTop: 16, color: kind === "err" ? "var(--danger)" : "var(--accent)" }}>{msg}</p>
      )}
    </>
  );
}
