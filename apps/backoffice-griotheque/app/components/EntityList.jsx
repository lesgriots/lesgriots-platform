// Composant générique de liste d'entités — utilisé par formations/, workshops/,
// trainers/, sessions/, resources/. Affiche un tableau avec actions inline.
"use client";
import { useEffect, useState } from "react";
import Type from "./Type";

export default function EntityList({
  entityName,    // ex: "formations"
  entityLabel,   // ex: "Formations" (titre affiché)
  columns,       // ex: [{ key: "title", label: "Titre" }, { key: "duration", label: "Durée" }]
  newHref,       // ex: "/formations/new"
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function reload() {
    setLoading(true);
    try {
      const r = await fetch(`/api/${entityName}`);
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
      setErr("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  async function del(id) {
    if (!confirm(`Supprimer "${id}" ?`)) return;
    await fetch(`/api/${entityName}/${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1><Type text={`${entityLabel.toLowerCase()} — ${items.length}`} speed={28} cursor="always" /></h1>
        <div className="actions" style={{ margin: 0 }}>
          {newHref && <a className="btn btn--ghost" href={newHref}>+ Nouveau</a>}
          <a className="btn btn--ghost" href="/">← Accueil</a>
        </div>
      </div>

      {err && <p className="note" style={{ color: "var(--danger)", marginTop: 12 }}>✗ {err}</p>}

      {loading ? (
        <div className="empty">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="empty">
          Aucune entrée pour le moment.
          {newHref && <> Crée la première via <a href={newHref}>+ Nouveau</a>.</>}
        </div>
      ) : (
        <table style={{ marginTop: 18 }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={c.width ? { width: c.width } : undefined}>{c.label}</th>
              ))}
              <th style={{ width: 130 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                {columns.map((c) => (
                  <td key={c.key}>
                    {c.render
                      ? c.render(it)
                      : (Array.isArray(it[c.key]) ? it[c.key].join(", ") : (it[c.key] || "—"))}
                  </td>
                ))}
                <td>
                  <a href={`/${entityName}/${it.id}`} className="btn btn--ghost"
                     style={{ padding: "4px 10px", fontSize: 11 }}>Éditer</a>
                  <button className="btn btn--danger"
                          style={{ padding: "4px 10px", fontSize: 11, marginLeft: 6 }}
                          onClick={() => del(it.id)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
