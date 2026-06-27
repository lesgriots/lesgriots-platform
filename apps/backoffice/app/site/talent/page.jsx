// Éditeur de la page Talent du site studio.
// Stocké en DB sous la clé "talent" = {
//   bio: { fr: [...lignes], en: [...lignes] },   // 1 ligne textarea = 1 ligne bio
//   portrait: "img/xxx.jpg",                      // image portrait (optionnel)
//   hoverVideo: "img/xxx.mp4",                    // vidéo au survol (optionnel)
//   instagramUrl: "https://instagram.com/..."     // lien du @handle
// }
// La page publique talent.jsx lit window.SITE_CONTENT.talent.
"use client";
import { useEffect, useState } from "react";
import Type from "../../components/Type";

export default function TalentEditorPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [fr, setFr] = useState("");
  const [en, setEn] = useState("");
  const [portrait, setPortrait] = useState("");
  const [hoverVideo, setHoverVideo] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");

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
      .catch(() => { setMsg("✗ Impossible de charger le contenu Talent"); setLoading(false); });
  }, []);

  // Une ligne non vide = une entrée bio (on garde la ligne @handle telle quelle).
  function splitLines(txt) {
    return txt.split(/\n/).map((s) => s.trim()).filter(Boolean);
  }

  async function save() {
    setSaving(true);
    setMsg("");
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
    if (r.ok) {
      setMsg(`✓ Enregistré (${payload.bio.fr.length} lignes FR, ${payload.bio.en.length} EN). Clique "Sync vers le site" sur la home pour publier.`);
    } else {
      setMsg("✗ Erreur lors de l'enregistrement");
    }
  }

  if (loading) return <p className="note">Chargement…</p>;

  const frCount = splitLines(fr).length;
  const enCount = splitLines(en).length;

  return (
    <>
      <h1><Type text="page talent" speed={28} cursor="always" /></h1>
      <p className="note" style={{ marginBottom: 18 }}>
        Contenu de la page <code>/#talent</code> du site. La bio s'écrit en typewriter, ligne par ligne.
        Une ligne par bloc (sépare avec Entrée). Pour le lien Instagram cliquable, mets une ligne
        commençant par <code>@</code> (ex. <code>@mooscoulibaly</code>) — elle pointera vers l'URL ci-dessous.
        Garde les majuscules, le site les conserve.
      </p>

      <h2>Bio · Français · {frCount} ligne{frCount > 1 ? "s" : ""}</h2>
      <textarea
        value={fr}
        onChange={(e) => setFr(e.target.value)}
        style={{ minHeight: 200, lineHeight: 1.6 }}
        placeholder={"MOOS COULIBALY EST UN ARTISTE…\nDANSEUR DEVENU CHORÉGRAPHE…\n@mooscoulibaly"}
      />

      <h2>Bio · English · {enCount} line{enCount > 1 ? "s" : ""}</h2>
      <textarea
        value={en}
        onChange={(e) => setEn(e.target.value)}
        style={{ minHeight: 200, lineHeight: 1.6 }}
        placeholder={"MOOS COULIBALY IS A MULTIDISCIPLINARY ARTIST…\nA DANCER TURNED CHOREOGRAPHER…\n@mooscoulibaly"}
      />

      <div className="row" style={{ marginTop: 8 }}>
        <div>
          <label>Image portrait (chemin)</label>
          <input
            value={portrait}
            onChange={(e) => setPortrait(e.target.value)}
            placeholder="img/moos-portrait.jpg"
          />
          <p className="note">Laisse vide pour n'afficher que la vidéo de survol.</p>
        </div>
        <div>
          <label>Vidéo au survol (chemin)</label>
          <input
            value={hoverVideo}
            onChange={(e) => setHoverVideo(e.target.value)}
            placeholder="img/riles-live-04.mp4"
          />
          <p className="note">Vide = vidéo par défaut (riles-live-04.mp4).</p>
        </div>
      </div>

      <label>Lien Instagram (pour la ligne @handle)</label>
      <input
        value={instagramUrl}
        onChange={(e) => setInstagramUrl(e.target.value)}
        placeholder="https://instagram.com/mooscoulibaly"
      />

      {msg && (
        <p className="note" style={{ marginTop: 14, color: msg.startsWith("✓") ? "var(--accent)" : "var(--danger)" }}>
          {msg}
        </p>
      )}

      <div className="actions" style={{ marginTop: 28 }}>
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? "..." : "Enregistrer"}
        </button>
        <a href="/" className="btn btn--ghost">← Retour</a>
      </div>
    </>
  );
}
