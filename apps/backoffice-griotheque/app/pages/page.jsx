// Toggles pour activer/désactiver chaque page du site lagriotheque.
// Si une page est désactivée : son lien disparaît du menu et l'URL est bloquée.
"use client";
import { useEffect, useState } from "react";
import Type from "../components/Type";

const PAGE_LABELS = {
  home: { label: "Accueil", desc: "Page d'entrée avec splash vidéo + manifeste" },
  approche: { label: "Notre Approche", desc: "6 critères ADN de la pédagogie" },
  formations: { label: "Formations", desc: "Catalogue des formations longues" },
  workshops: { label: "Workshops", desc: "Catalogue des formats courts" },
  agenda: { label: "Agenda", desc: "Sessions à venir (formations + workshops)" },
  financement: { label: "Financement", desc: "OPCO, FAF, CPF, financement personnel" },
  ressources: { label: "Ressources", desc: "Guides, articles, outils téléchargeables" },
  cgv: { label: "CGV", desc: "Conditions générales de vente (Qualiopi)" },
  contact: { label: "Contact", desc: "Email + Instagram + LinkedIn" },
};

export default function ActivePagesPage() {
  const [pages, setPages] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/pages").then((r) => r.json()).then(setPages);
  }, []);

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const r = await fetch("/api/pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pages),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setMsg("✓ Sauvegardé. Pense à cliquer Exporter pour pousser sur le site.");
    } catch (e) {
      setMsg(`✗ ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (!pages) return <div className="empty">Chargement…</div>;

  const orderedKeys = Object.keys(PAGE_LABELS);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1><Type text="pages actives" speed={28} cursor="always" /></h1>
        <div className="actions" style={{ margin: 0 }}>
          <a className="btn btn--ghost" href="/">← Accueil</a>
          <button className="btn" onClick={save} disabled={saving}>
            {saving ? "..." : "Sauvegarder"}
          </button>
        </div>
      </div>

      <p className="note" style={{ marginTop: 12, marginBottom: 18 }}>
        Désactive une page pour la masquer du menu et bloquer son URL sur le site.
        Pratique pour cacher temporairement une section pas prête (ex: Ressources tant
        que les PDF ne sont pas finalisés). N'oublie pas <strong>Exporter</strong> après.
      </p>
      {msg && <p className="note" style={{ marginTop: 8 }}>{msg}</p>}

      <table>
        <thead>
          <tr>
            <th style={{ width: 80 }}>Active</th>
            <th>Page</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {orderedKeys.map((key) => {
            const info = PAGE_LABELS[key];
            return (
              <tr key={key}>
                <td>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: 0, fontSize: 12, textTransform: "none", letterSpacing: 0 }}>
                    <input
                      type="checkbox"
                      checked={pages[key] !== false}
                      onChange={(e) => setPages({ ...pages, [key]: e.target.checked })}
                      style={{ width: "auto" }}
                    />
                    {pages[key] !== false ? "ON" : "OFF"}
                  </label>
                </td>
                <td style={{ fontWeight: 500 }}>{info.label}</td>
                <td style={{ color: "var(--ink-dim)", fontSize: 12 }}>{info.desc}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
