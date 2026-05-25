// Éditeur des pages actives du site.
// Stocké en DB sous la clé "activePages" = { work: true, about: true, eco: true }
// Le menu du site filtre les items selon ces valeurs après Sync.
"use client";
import { useEffect, useState } from "react";
import Type from "../../components/Type";

const PAGES = [
  { id: "work",  label: "WORK / PROJETS", description: "La grille principale des projets — la home du site." },
  { id: "about", label: "ABOUT",          description: "Page À propos avec services + contact + intro éditoriale." },
  { id: "eco",   label: "ECOSYSTEM",      description: "Vue solaire des collaborateurs, studios partenaires, clients." },
];

// Par défaut tout est actif (rétrocompatibilité avec l'état avant l'ajout
// du toggle — si aucune valeur en DB, on considère que les 3 pages sont ON).
const DEFAULT_ACTIVE = { work: true, about: true, eco: true };

export default function PagesEditorPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [active, setActive] = useState(DEFAULT_ACTIVE);

  useEffect(() => {
    fetch("/api/site/activePages")
      .then((r) => r.json())
      .then((j) => {
        if (j.value && typeof j.value === "object") setActive({ ...DEFAULT_ACTIVE, ...j.value });
        setLoading(false);
      });
  }, []);

  function toggle(id) {
    setActive((a) => ({ ...a, [id]: !a[id] }));
  }

  async function save() {
    setSaving(true);
    setMsg("");
    const r = await fetch("/api/site/activePages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(active),
    });
    setSaving(false);
    if (r.ok) {
      const onCount = Object.values(active).filter(Boolean).length;
      setMsg(`✓ Enregistré (${onCount} page${onCount > 1 ? "s" : ""} active${onCount > 1 ? "s" : ""}). Clique "Sync vers le site" sur la home pour publier.`);
    } else {
      setMsg("✗ Erreur lors de l'enregistrement");
    }
  }

  if (loading) return <p className="note">Chargement…</p>;

  const offCount = Object.values(active).filter((v) => !v).length;

  return (
    <>
      <h1><Type text="pages actives du site" speed={28} cursor="always" /></h1>
      <p className="note" style={{ marginBottom: 18 }}>
        Coche les pages qui doivent apparaître dans le menu du site studio. Les pages décochées sont masquées de la navigation mais leur URL directe reste accessible (utile pour les passer en brouillon sans casser un lien existant).
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 28 }}>
        {PAGES.map((p) => (
          <label key={p.id} className="page-row">
            <input
              type="checkbox"
              checked={!!active[p.id]}
              onChange={() => toggle(p.id)}
            />
            <div>
              <div className="page-row__title">
                {p.label}
                <span className="page-row__state">{active[p.id] ? "ACTIVE" : "MASQUÉE"}</span>
              </div>
              <div className="page-row__desc">{p.description}</div>
            </div>
          </label>
        ))}
      </div>

      {offCount === 3 && (
        <p className="note" style={{ marginTop: 14, color: "var(--danger)" }}>
          ⚠ Tout est désactivé — le menu du site va être vide. Réactive au moins une page.
        </p>
      )}

      {msg && <p className="note" style={{ marginTop: 14, color: msg.startsWith("✓") ? "var(--yellow)" : "var(--danger)" }}>{msg}</p>}

      <div className="actions" style={{ marginTop: 28 }}>
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? "..." : "Enregistrer"}
        </button>
        <a href="/" className="btn btn--ghost">← Retour</a>
      </div>

      <style jsx>{`
        .page-row {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          padding: 14px 16px;
          border: 1px solid var(--rule);
          background: #0f0e0a;
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .page-row:hover { border-color: var(--ink-dim); }
        .page-row input {
          width: auto;
          margin-top: 3px;
          accent-color: var(--yellow);
        }
        .page-row__title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          letter-spacing: 0.12em;
          color: var(--ink);
          text-transform: uppercase;
          font-weight: 500;
        }
        .page-row__state {
          font-size: 10px;
          letter-spacing: 0.16em;
          padding: 1px 7px;
          border: 1px solid var(--rule);
          color: var(--ink-dim);
        }
        input:checked + div .page-row__state,
        .page-row input:checked ~ div .page-row__state {
          background: var(--yellow);
          color: #000;
          border-color: var(--yellow);
        }
        .page-row__desc {
          margin-top: 6px;
          color: var(--ink-dim);
          font-size: 11px;
          line-height: 1.5;
          letter-spacing: 0.04em;
        }
      `}</style>
    </>
  );
}
