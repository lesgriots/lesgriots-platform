// Page d'édition des 4 textes mutualisés (méthodes, évaluation, accessibilité, lieu).
// Ces textes sont injectés dans chaque formation/workshop quand le champ
// correspondant est vide. Permet de mettre à jour 3 formations d'un coup.
"use client";
import { useEffect, useState } from "react";
import Type from "../components/Type";

const FIELDS = [
  { key: "methods", label: "Méthodes pédagogiques",
    hint: "Comment se déroule la formation : groupes, exposés, cas pratiques, etc." },
  { key: "evaluation", label: "Modalités d'évaluation",
    hint: "Questionnaire amont, évaluation des acquis, certificat, enquête de satisfaction." },
  { key: "accessibility", label: "Accessibilité",
    hint: "Mesures pour personnes en situation de handicap, contact référente." },
  { key: "location", label: "Lieu",
    hint: "Présentiel et/ou en ligne, modalités d'accès au lieu." },
];

export default function DefaultsPage() {
  const [values, setValues] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/defaults").then((r) => r.json()).then(setValues);
  }, []);

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const r = await fetch("/api/defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setMsg("✓ Sauvegardé. Cliquer 'Exporter' pour pousser sur le site.");
    } catch (e) {
      setMsg(`✗ ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (!values) return <div className="empty">Chargement…</div>;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1><Type text="textes par défaut" speed={28} cursor="always" /></h1>
        <div className="actions" style={{ margin: 0 }}>
          <a className="btn btn--ghost" href="/">← Accueil</a>
          <button className="btn" onClick={save} disabled={saving}>
            {saving ? "..." : "Sauvegarder"}
          </button>
        </div>
      </div>

      <p className="note" style={{ marginTop: 12 }}>
        Ces 4 textes sont injectés dans chaque formation et workshop quand le
        champ correspondant est laissé vide. Édite ici une fois, ça se propage
        partout au prochain export.
      </p>
      {msg && <p className="note" style={{ marginTop: 8 }}>{msg}</p>}

      {FIELDS.map((f) => (
        <div key={f.key} style={{ marginTop: 28 }}>
          <label>{f.label}</label>
          <textarea
            value={values[f.key] || ""}
            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            rows={6}
          />
          <p className="note">{f.hint}</p>
        </div>
      ))}
    </>
  );
}
