// Éditeur de la page Talent du site studio.
// Stocké en DB sous la clé "talent" = {
//   bio: { fr: [...lignes], en: [...lignes] },   // 1 ligne textarea = 1 ligne bio
//   portrait: "img/xxx.jpg",                      // image portrait (upload)
//   hoverVideo: "img/xxx.mp4",                    // vidéo au survol (upload)
//   instagramUrl: "https://instagram.com/..."     // lien du @handle
// }
// La page publique talent.jsx lit window.SITE_CONTENT.talent.
// L'activation/désactivation de la page Talent se fait dans l'onglet "Pages actives".
"use client";
import { useEffect, useState } from "react";
import Type from "../../components/Type";

export default function TalentEditorPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState("ok");
  const [fr, setFr] = useState("");
  const [en, setEn] = useState("");
  const [portrait, setPortrait] = useState("");
  const [hoverVideo, setHoverVideo] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [upPhoto, setUpPhoto] = useState(false);
  const [upVideo, setUpVideo] = useState(false);

  useEffect(() => {
    fetch("/api/site/talent")
      .then((r) => r.json())
      .then((j) => {
        const v = j.value || {};
        const bio = v.bio || { fr: [], en: [] };
        setFr((bio.fr || []).join("\n"));
        setEn((bio.en || []).join("\n"));
        setPortrait(v.portrait || "");
        setHoverVideo(v.hoverVideo || "");
        setInstagramUrl(v.instagramUrl || "");
        setLoading(false);
      })
      .catch(() => { flash("✗ Impossible de charger le contenu Talent", "err"); setLoading(false); });
  }, []);

  function flash(text, kind = "ok") { setMsg(text); setMsgKind(kind); }

  // Une ligne non vide = une entrée bio (on garde la ligne @handle telle quelle).
  function splitLines(txt) {
    return txt.split(/\n/).map((s) => s.trim()).filter(Boolean);
  }

  // Upload générique via /api/upload (convertit .heic/.mov si besoin côté serveur).
  async function upload(file, setter, setBusy) {
    if (!file) return;
    setBusy(true);
    flash(`Upload de ${file.name}…`, "ok");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (r.ok && j.path) {
        setter(j.path);
        flash(`✓ Uploadé : ${j.path}${j.converted ? " — " + j.converted : ""}. Enregistre puis Sync pour publier.`, "ok");
      } else {
        flash("✗ Upload échoué : " + (j.error || "erreur inconnue"), "err");
      }
    } catch (e) {
      flash("✗ Upload échoué : " + e.message, "err");
    }
    setBusy(false);
  }

  async function save() {
    setSaving(true);
    flash("", "ok");
    const payload = {
      bio: { fr: splitLines(fr), en: splitLines(en) },
      portrait: portrait.trim(),
      hoverVideo: hoverVideo.trim(),
      instagramUrl: instagramUrl.trim(),
    };
    const r = await fetch("/api/site/talent", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (r.ok) flash(`✓ Enregistré (${payload.bio.fr.length} lignes FR, ${payload.bio.en.length} EN). Clique "Sync vers le site" sur la home pour publier.`, "ok");
    else flash("✗ Erreur lors de l'enregistrement", "err");
  }

  if (loading) return <p className="note">Chargement…</p>;

  const frCount = splitLines(fr).length;
  const enCount = splitLines(en).length;

  return (
    <>
      <h1><Type text="page talent" speed={28} cursor="always" /></h1>
      <p className="note" style={{ marginBottom: 18 }}>
        Contenu de la page <code>/#talent</code> du site. La bio s'écrit en typewriter, ligne par ligne
        (une ligne par bloc, sépare avec Entrée). Pour le lien Instagram cliquable, mets une ligne
        commençant par <code>@</code> — elle pointera vers l'URL Instagram ci-dessous.
        Pour <strong>activer ou masquer</strong> la page Talent dans le menu du site, va dans l'onglet
        <a href="/site/pages"> Pages actives</a>.
      </p>

      <h2>Photo & vidéo</h2>
      <div className="row" style={{ marginTop: 8 }}>
        <div>
          <label>Photo portrait</label>
          <input
            type="file"
            accept="image/*"
            disabled={upPhoto}
            onChange={(e) => upload(e.target.files[0], setPortrait, setUpPhoto)}
          />
          <input
            value={portrait}
            onChange={(e) => setPortrait(e.target.value)}
            placeholder="img/moos-portrait.jpg"
            style={{ marginTop: 8 }}
          />
          {portrait ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/preview?p=${encodeURIComponent(portrait)}`} alt="portrait" style={{ marginTop: 10, maxWidth: "100%", maxHeight: 180, border: "1px solid var(--rule)" }} />
          ) : <p className="note">{upPhoto ? "Upload en cours…" : "Aucune photo — seule la vidéo s'affichera."}</p>}
        </div>
        <div>
          <label>Vidéo au survol</label>
          <input
            type="file"
            accept="video/*"
            disabled={upVideo}
            onChange={(e) => upload(e.target.files[0], setHoverVideo, setUpVideo)}
          />
          <input
            value={hoverVideo}
            onChange={(e) => setHoverVideo(e.target.value)}
            placeholder="img/riles-live-04.mp4"
            style={{ marginTop: 8 }}
          />
          {hoverVideo ? (
            <video src={`/api/preview?p=${encodeURIComponent(hoverVideo)}`} muted loop playsInline controls style={{ marginTop: 10, maxWidth: "100%", maxHeight: 180, border: "1px solid var(--rule)" }} />
          ) : <p className="note">{upVideo ? "Upload en cours…" : "Vide = vidéo par défaut (riles-live-04.mp4)."}</p>}
        </div>
      </div>

      <h2 style={{ marginTop: 28 }}>Bio · Français · {frCount} ligne{frCount > 1 ? "s" : ""}</h2>
      <textarea
        value={fr}
        onChange={(e) => setFr(e.target.value)}
        style={{ minHeight: 180, lineHeight: 1.6 }}
        placeholder={"MOOS COULIBALY EST UN ARTISTE…\nDANSEUR DEVENU CHORÉGRAPHE…\n@mooscoulibaly"}
      />

      <h2>Bio · English · {enCount} line{enCount > 1 ? "s" : ""}</h2>
      <textarea
        value={en}
        onChange={(e) => setEn(e.target.value)}
        style={{ minHeight: 180, lineHeight: 1.6 }}
        placeholder={"MOOS COULIBALY IS A MULTIDISCIPLINARY ARTIST…\nA DANCER TURNED CHOREOGRAPHER…\n@mooscoulibaly"}
      />

      <label>Lien Instagram (pour la ligne @handle)</label>
      <input
        value={instagramUrl}
        onChange={(e) => setInstagramUrl(e.target.value)}
        placeholder="https://instagram.com/mooscoulibaly"
      />

      {msg && (
        <p className="note" style={{ marginTop: 14, color: msgKind === "ok" ? "var(--accent)" : "var(--danger)" }}>
          {msg}
        </p>
      )}

      <div className="actions" style={{ marginTop: 28 }}>
        <button className="btn" onClick={save} disabled={saving || upPhoto || upVideo}>
          {saving ? "..." : "Enregistrer"}
        </button>
        <a href="/" className="btn btn--ghost">← Retour</a>
      </div>
    </>
  );
}
