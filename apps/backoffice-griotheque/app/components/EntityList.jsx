// Composant générique de liste d'entités — utilisé par formations/, workshops/,
// trainers/, sessions/, resources/. Affiche un tableau avec actions inline.
"use client";
import { useEffect, useState } from "react";

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
      {/* L'en-tete dit trois choses dans cet ordre : d'ou l'on vient, ce
          qu'on regarde, ce qu'on peut faire. Le compteur quitte le titre
          pour une pastille : « formations — 7 » se lisait comme un titre a
          rallonge, et le chiffre changeait sous les yeux pendant le
          chargement. */}
      <div className="bo-tete">
        <div className="bo-tete__gauche">
          <div className="bo-fil"><a href="/">Back office</a> · {entityLabel}</div>
          <h1>
            {entityLabel}
            {!loading && <span className="bo-tete__compte">{items.length}</span>}
          </h1>
        </div>
        <div className="actions">
          <a className="btn btn--ghost" href="/">← Accueil</a>
          {newHref && <a className="btn" href={newHref}>+ Nouveau</a>}
        </div>
      </div>

      {err && <p className="note" style={{ color: "var(--danger)" }}>✗ {err}</p>}

      {loading ? (
        <div className="empty">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="empty">
          Aucune entrée pour le moment.
          {newHref && <> Crée la première via <a href={newHref}>+ Nouveau</a>.</>}
        </div>
      ) : (
        <div className="bo-tableau"><table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={c.width ? { width: c.width } : undefined}>{c.label}</th>
              ))}
              <th style={{ width: 190 }}></th>
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
                  <div className="actions">
                    <a href={`/${entityName}/${it.id}`} className="btn btn--ghost btn--petit">Éditer</a>
                    {/* « × » ne disait pas ce qu'il faisait. Le mot, lui, le dit. */}
                    <button className="btn btn--danger btn--petit"
                            onClick={() => del(it.id)}>Supprimer</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </>
  );
}
