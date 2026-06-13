// Page d'accueil — liste tous les projets + bouton Sync.
// Réordonnancement ↑/↓ directement dans la liste (persiste les positions),
// miniatures cover, badges d'alerte (cover manquante / format non-web).
"use client";
import { useEffect, useState } from "react";
import Type from "./components/Type";

// Formats que les navigateurs n'affichent pas (ou mal) — à signaler avant lancement.
const NON_WEB = /\.(tif|tiff|mov|heic|psd|raw)$/i;

function isExternal(s) {
  return typeof s === "string" && /^https?:\/\//i.test(s);
}

export default function ProjectsListPage() {
  const [projects, setProjects] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState("ok"); // "ok" | "err"

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((arr) => { setProjects(arr); setLoaded(true); })
      .catch(() => { setMsg("Impossible de charger les projets"); setMsgKind("err"); setLoaded(true); });
  }, []);

  async function sync() {
    setSyncing(true);
    setMsg("");
    try {
      const r = await fetch("/api/export", { method: "POST" });
      const j = await r.json();
      if (j.ok) {
        const t = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        setMsg(`✓ ${j.count} projets écrits dans data.jsx (${(j.bytes / 1024).toFixed(1)} Ko) — ${t}`);
        setMsgKind("ok");
      } else {
        setMsg(`✗ Sync échoué : ${j.error}`);
        setMsgKind("err");
      }
    } catch (e) {
      setMsg(`✗ Sync échoué : ${e.message}`);
      setMsgKind("err");
    }
    setSyncing(false);
  }

  async function del(id) {
    if (!confirm(`Supprimer le projet "${id}" ?\n\nCette action est définitive (pense à re-sync après).`)) return;
    const r = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!r.ok) { setMsg("✗ Suppression échouée"); setMsgKind("err"); return; }
    setProjects((arr) => arr.filter((p) => p.id !== id));
    setMsg(`Projet "${id}" supprimé — pense à re-sync vers le site.`);
    setMsgKind("ok");
  }

  // Déplace le projet d'index i vers i+dir, puis persiste les positions
  // de TOUTE la liste (position = index + 1) pour garder un ordre propre.
  async function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= projects.length || saving) return;
    const arr = [...projects];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    const renumbered = arr.map((p, idx) => ({ ...p, position: idx + 1 }));
    setProjects(renumbered);
    setSaving(true);
    try {
      // Ne PUT que les projets dont la position a réellement changé.
      const changed = renumbered.filter((p) => {
        const before = projects.find((q) => q.id === p.id);
        return before && before.position !== p.position;
      });
      for (const p of changed) {
        await fetch(`/api/projects/${p.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        });
      }
      setMsg("Ordre enregistré — pense à re-sync vers le site.");
      setMsgKind("ok");
    } catch (e) {
      setMsg(`✗ Ordre non enregistré : ${e.message}`);
      setMsgKind("err");
    }
    setSaving(false);
  }

  // Alerte qualité sur un projet (affichée comme badge dans la liste).
  function warnings(p) {
    const w = [];
    if (!p.cover || !p.cover.trim()) w.push("sans cover");
    else if (NON_WEB.test(p.cover)) w.push("cover non-web");
    if ((p.resources || []).some((r) => r.src && NON_WEB.test(r.src) && !isExternal(r.src))) {
      w.push("média .mov/.tif");
    }
    return w;
  }

  const visibleCount = projects.filter((p) => !p.hidden).length;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h1><Type text={`projets — ${visibleCount} publiés / ${projects.length}`} speed={28} cursor="always" /></h1>
        <div className="actions" style={{ margin: 0 }}>
          <a className="btn btn--ghost" href="/projects/new">+ Nouveau projet</a>
          <button className="btn" onClick={sync} disabled={syncing}>
            {syncing ? "Sync en cours…" : "↳ Sync vers le site"}
          </button>
        </div>
      </div>
      {msg && (
        <p className="note" style={{ marginTop: 12, color: msgKind === "err" ? "var(--danger)" : "var(--accent)" }}>
          {msg}
        </p>
      )}

      {!loaded ? (
        <p className="note" style={{ marginTop: 24 }}>Chargement…</p>
      ) : projects.length === 0 ? (
        <div className="empty">
          Aucun projet. <a href="/projects/new">Créer le premier</a> ou seed depuis data.jsx :
          <br /><code>cd backoffice && node scripts/seed.mjs</code>
        </div>
      ) : (
        <table style={{ marginTop: 18 }}>
          <thead>
            <tr>
              <th style={{ width: 70 }}>Ordre</th>
              <th style={{ width: 70 }}></th>
              <th>Nom</th>
              <th>Client</th>
              <th>Rôle</th>
              <th>Tags</th>
              <th style={{ width: 130 }}></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p, i) => {
              const warns = warnings(p);
              const cover = p.cover && p.cover.trim();
              const coverSrc = cover
                ? (isExternal(cover) ? cover : `/api/preview?p=${encodeURIComponent(cover)}`)
                : null;
              const coverIsImg = coverSrc && !NON_WEB.test(cover);
              return (
                <tr key={p.id} style={p.hidden ? { opacity: 0.45 } : undefined}>
                  <td>
                    <span style={{ color: "var(--dim)", marginRight: 6 }}>{i + 1}</span>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ padding: "1px 6px", fontSize: 11 }}
                      disabled={i === 0 || saving}
                      onClick={() => move(i, -1)}
                      title="Monter"
                    >↑</button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      style={{ padding: "1px 6px", fontSize: 11, marginLeft: 3 }}
                      disabled={i === projects.length - 1 || saving}
                      onClick={() => move(i, +1)}
                      title="Descendre"
                    >↓</button>
                  </td>
                  <td>
                    <a href={`/projects/${p.id}`} style={{
                      display: "block", width: 56, height: 36,
                      border: "1px solid var(--rule)", background: "#141210",
                      overflow: "hidden",
                    }}>
                      {coverIsImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={coverSrc} alt="" loading="lazy"
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      ) : (
                        <span style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: "100%", height: "100%", fontSize: 10, color: "var(--dim)",
                        }}>{cover ? "⚠" : "—"}</span>
                      )}
                    </a>
                  </td>
                  <td>
                    <a href={`/projects/${p.id}`} style={{ fontWeight: 500 }}>{p.name}</a>
                    {p.hidden && <span className="pill" style={{ marginLeft: 6 }}>caché</span>}
                    {warns.map((w) => (
                      <span key={w} className="pill" style={{ marginLeft: 6, borderColor: "var(--danger)", color: "var(--danger)" }}>
                        ⚠ {w}
                      </span>
                    ))}
                  </td>
                  <td>{p.client || "—"}</td>
                  <td style={{ color: "var(--dim)" }}>
                    {Array.isArray(p.role) ? p.role.join(" / ") : (p.role || "—")}
                  </td>
                  <td>
                    {(p.tags || []).map((t) => <span key={t} className="pill">{t}</span>)}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <a href={`/projects/${p.id}`} className="btn btn--ghost" style={{ padding: "4px 10px", fontSize: 11 }}>Éditer</a>
                    <button className="btn btn--danger" style={{ padding: "4px 10px", fontSize: 11, marginLeft: 6 }} onClick={() => del(p.id)} title="Supprimer">×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
