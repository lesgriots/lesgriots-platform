// Page d'accueil — liste tous les projets + bouton Sync.
"use client";
import { useEffect, useState } from "react";
import Type from "./components/Type";

export default function ProjectsListPage() {
  const [projects, setProjects] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then(setProjects);
  }, []);

  async function sync() {
    setSyncing(true);
    setMsg("");
    const r = await fetch("/api/export", { method: "POST" });
    const j = await r.json();
    setSyncing(false);
    setMsg(j.ok ? `✓ ${j.count} projets écrits dans data.jsx (${(j.bytes/1024).toFixed(1)} Ko)` : `✗ ${j.error}`);
  }

  async function del(id) {
    if (!confirm(`Supprimer le projet "${id}" ?`)) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((arr) => arr.filter((p) => p.id !== id));
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1><Type text={`projets — ${projects.length}`} speed={28} cursor="always" /></h1>
        <div className="actions" style={{ margin: 0 }}>
          <a className="btn btn--ghost" href="/projects/new">+ Nouveau projet</a>
          <button className="btn" onClick={sync} disabled={syncing}>
            {syncing ? "..." : "↳ Sync vers le site"}
          </button>
        </div>
      </div>
      {msg && <p className="note" style={{ marginTop: 12 }}>{msg}</p>}

      {projects.length === 0 ? (
        <div className="empty">
          Aucun projet. <a href="/projects/new">Créer le premier</a> ou seed depuis data.jsx :
          <br /><code>cd backoffice && node scripts/seed.mjs</code>
        </div>
      ) : (
        <table style={{ marginTop: 18 }}>
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th>Nom</th>
              <th>Client</th>
              <th>Rôle</th>
              <th>Tags</th>
              <th style={{ width: 130 }}></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td style={{ color: "var(--dim)" }}>{p.position}</td>
                <td>
                  <a href={`/projects/${p.id}`} style={{ fontWeight: 500 }}>{p.name}</a>
                  {p.hidden && <span className="pill">caché</span>}
                </td>
                <td>{p.client || "—"}</td>
                <td style={{ color: "var(--dim)" }}>
                  {Array.isArray(p.role) ? p.role.join(" / ") : (p.role || "—")}
                </td>
                <td>
                  {(p.tags || []).map((t) => <span key={t} className="pill">{t}</span>)}
                </td>
                <td>
                  <a href={`/projects/${p.id}`} className="btn btn--ghost" style={{ padding: "4px 10px", fontSize: 11 }}>Éditer</a>
                  <button className="btn btn--danger" style={{ padding: "4px 10px", fontSize: 11, marginLeft: 6 }} onClick={() => del(p.id)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
