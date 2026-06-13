// Éditeur de la liste des services de l'agence (page About du site studio).
// Stocké en DB sous la clé "services" = { en: [...], fr: [...] }.
// Une ligne = un service. L'ordre est conservé tel quel sur le site.
"use client";
import { useEffect, useState } from "react";
import Type from "../../components/Type";

// Valeurs par défaut affichées si rien n'a encore été enregistré
// (= ce qui est actuellement codé en dur sur le site).
const DEFAULT_FR = ["STRATÉGIE DE MARQUE", "DIRECTION CRÉATIVE", "DIRECTION SCÉNIQUE & MOUVEMENT", "PRODUCTION"];
const DEFAULT_EN = ["BRAND STRATEGY", "CREATIVE DIRECTION", "STAGE DIRECTION & MOVEMENT", "PRODUCTION"];

export default function ServicesEditorPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(true);
  const [fr, setFr] = useState("");
  const [en, setEn] = useState("");

  useEffect(() => {
    fetch("/api/site/services")
      .then((r) => r.json())
      .then((j) => {
        const v = j.value || {};
        setFr(((v.fr && v.fr.length) ? v.fr : DEFAULT_FR).join("\n"));
        setEn(((v.en && v.en.length) ? v.en : DEFAULT_EN).join("\n"));
        setLoading(false);
      })
      .catch(() => {
        setFr(DEFAULT_FR.join("\n"));
        setEn(DEFAULT_EN.join("\n"));
        setLoading(false);
      });
  }, []);

  // Une ligne non vide = un service. On nettoie les espaces superflus.
  function splitLines(txt) {
    return txt.split("\n").map((s) => s.trim()).filter(Boolean);
  }

  async function save() {
    const frList = splitLines(fr);
    const enList = splitLines(en);
    if (frList.length !== enList.length) {
      setMsg(`⚠ Attention : ${frList.length} services en FR mais ${enList.length} en EN. Garde le même nombre de lignes dans les deux langues pour qu'ils correspondent.`);
      setMsgOk(false);
      return;
    }
    setSaving(true);
    setMsg("");
    const payload = { fr: frList, en: enList };
    try {
      const r = await fetch("/api/site/services", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSaving(false);
      if (r.ok) {
        setMsg(`✓ Enregistré (${frList.length} services). Clique "↳ Sync vers le site" sur la home pour publier.`);
        setMsgOk(true);
      } else {
        setMsg("✗ Erreur lors de l'enregistrement");
        setMsgOk(false);
      }
    } catch (e) {
      setSaving(false);
      setMsg(`✗ ${e.message}`);
      setMsgOk(false);
    }
  }

  if (loading) return <p className="note">Chargement…</p>;

  const frCount = splitLines(fr).length;
  const enCount = splitLines(en).length;
  const mismatch = frCount !== enCount;

  return (
    <>
      <h1><Type text="agence — services" speed={28} cursor="always" /></h1>
      <p className="note" style={{ marginBottom: 18 }}>
        La liste des services affichée dans la colonne <code>SERVICES</code> de la page
        <code>/#about</code>. <strong>Un service par ligne</strong>, dans l'ordre d'affichage.
        Les majuscules sont conservées telles quelles sur le site.
      </p>

      <h2>Français · {frCount} service{frCount > 1 ? "s" : ""}</h2>
      <textarea
        value={fr}
        onChange={(e) => setFr(e.target.value)}
        style={{ minHeight: 170, lineHeight: 1.7 }}
        placeholder={"STRATÉGIE DE MARQUE\nDIRECTION CRÉATIVE\nPRODUCTION"}
      />

      <h2>English · {enCount} service{enCount > 1 ? "s" : ""}</h2>
      <textarea
        value={en}
        onChange={(e) => setEn(e.target.value)}
        style={{ minHeight: 170, lineHeight: 1.7 }}
        placeholder={"BRAND STRATEGY\nCREATIVE DIRECTION\nPRODUCTION"}
      />

      {mismatch && (
        <p className="note" style={{ marginTop: 10, color: "var(--danger)" }}>
          ⚠ {frCount} lignes FR / {enCount} lignes EN — garde le même nombre dans les deux langues
          (chaque ligne FR correspond à la même ligne EN).
        </p>
      )}

      {msg && <p className="note" style={{ marginTop: 14, color: msgOk ? "var(--accent)" : "var(--danger)" }}>{msg}</p>}

      <div className="actions" style={{ marginTop: 28 }}>
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? "..." : "Enregistrer"}
        </button>
        <a href="/" className="btn btn--ghost">← Retour</a>
      </div>
    </>
  );
}
