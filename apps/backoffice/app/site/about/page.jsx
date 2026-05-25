// Éditeur du texte d'intro de la page About du site studio.
// Stocké en DB sous la clé "aboutIntro" = { en: [...], fr: [...] }
// Une ligne de textarea = un paragraphe (séparateur \n\n à la save).
"use client";
import { useEffect, useState } from "react";
import Type from "../../components/Type";

export default function AboutEditorPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [fr, setFr] = useState("");
  const [en, setEn] = useState("");

  useEffect(() => {
    fetch("/api/site/aboutIntro")
      .then((r) => r.json())
      .then((j) => {
        const v = j.value || { fr: [], en: [] };
        setFr((v.fr || []).join("\n\n"));
        setEn((v.en || []).join("\n\n"));
        setLoading(false);
      });
  }, []);

  function splitParas(txt) {
    return txt.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  }

  async function save() {
    setSaving(true);
    setMsg("");
    const payload = { fr: splitParas(fr), en: splitParas(en) };
    const r = await fetch("/api/site/aboutIntro", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (r.ok) setMsg(`✓ Enregistré (${payload.fr.length} paragraphes FR, ${payload.en.length} EN). Clique "Sync vers le site" sur la home pour publier.`);
    else setMsg("✗ Erreur lors de l'enregistrement");
  }

  if (loading) return <p className="note">Chargement…</p>;

  const frCount = splitParas(fr).length;
  const enCount = splitParas(en).length;

  return (
    <>
      <h1><Type text="page about — intro" speed={28} cursor="always" /></h1>
      <p className="note" style={{ marginBottom: 18 }}>
        Le texte qui s'écrit en typewriter en haut de la page <code>/#about</code> du site.
        Un paragraphe par bloc, séparé par une ligne vide. Garde les majuscules — le site les conserve.
      </p>

      <h2>Français · {frCount} paragraphe{frCount > 1 ? "s" : ""}</h2>
      <textarea
        value={fr}
        onChange={(e) => setFr(e.target.value)}
        style={{ minHeight: 200, lineHeight: 1.5 }}
        placeholder="LESGRIOTSxSTUDIO EST UN STUDIO CRÉATIF…\n\nNOUS RÉUNISSONS…"
      />

      <h2>English · {enCount} paragraph{enCount > 1 ? "s" : ""}</h2>
      <textarea
        value={en}
        onChange={(e) => setEn(e.target.value)}
        style={{ minHeight: 200, lineHeight: 1.5 }}
        placeholder="LESGRIOTSxSTUDIO IS A TRANSDISCIPLINARY…\n\nWE COMBINE…"
      />

      {msg && <p className="note" style={{ marginTop: 14, color: msg.startsWith("✓") ? "var(--accent)" : "var(--danger)" }}>{msg}</p>}

      <div className="actions" style={{ marginTop: 28 }}>
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? "..." : "Enregistrer"}
        </button>
        <a href="/" className="btn btn--ghost">← Retour</a>
      </div>
    </>
  );
}
