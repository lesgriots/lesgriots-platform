// Page d'accueil — bibliothèque de projets façon YouTube Studio.
// Cards visuelles avec preview vidéo au hover (thumb video), badges de
// statut, actions rapides (éditer / masquer / dupliquer / supprimer),
// recherche, et réordonnancement par drag & drop (persiste les positions).
"use client";
import { useEffect, useRef, useState } from "react";
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
  const [q, setQ] = useState("");               // recherche
  const [hoverId, setHoverId] = useState(null); // card survolée → preview vidéo
  // Drag & drop : index de la card déplacée + index survolé (feedback visuel).
  const dragIdx = useRef(null);
  const [dropIdx, setDropIdx] = useState(null);
  const [dragging, setDragging] = useState(null);

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

  // Masquer / republier en un clic depuis la card (comme la visibilité
  // publique/privée de YouTube Studio).
  async function toggleHidden(p) {
    const next = { ...p, hidden: !p.hidden };
    setProjects((arr) => arr.map((x) => (x.id === p.id ? next : x)));
    const r = await fetch(`/api/projects/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!r.ok) {
      setProjects((arr) => arr.map((x) => (x.id === p.id ? p : x)));
      setMsg("✗ Changement de visibilité échoué");
      setMsgKind("err");
      return;
    }
    setMsg(`« ${p.name} » ${next.hidden ? "masqué" : "republié"} — pense à re-sync vers le site.`);
    setMsgKind("ok");
  }

  // Duplique un projet (id + nom suffixés, ajouté en fin de liste, caché
  // par défaut pour ne rien publier par accident).
  async function duplicate(p) {
    const copy = {
      ...p,
      id: `${p.id}-copie`,
      name: `${p.name} (copie)`,
      position: projects.length + 1,
      hidden: true,
    };
    const r = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(copy),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setMsg(`✗ Duplication échouée : ${j.error || r.status} (l'id "${copy.id}" existe peut-être déjà)`);
      setMsgKind("err");
      return;
    }
    setProjects((arr) => [...arr, copy]);
    setMsg(`« ${p.name} » dupliqué (caché par défaut) — ouvre la copie pour l'adapter.`);
    setMsgKind("ok");
  }

  // Persiste les positions après réordonnancement (position = index + 1).
  async function persistOrder(renumbered, before) {
    setSaving(true);
    try {
      const changed = renumbered.filter((p) => {
        const prev = before.find((x) => x.id === p.id);
        return prev && prev.position !== p.position;
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

  // Déplace la card d'index `from` à l'index `to` (drag & drop).
  function reorder(from, to) {
    if (from === to || from == null || to == null) return;
    const before = projects;
    const arr = [...projects];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    const renumbered = arr.map((p, idx) => ({ ...p, position: idx + 1 }));
    setProjects(renumbered);
    persistOrder(renumbered, before);
  }

  // Alerte qualité sur un projet (badge sur la card).
  function warnings(p) {
    const w = [];
    // Une thumb video vaut cover : à l'export, une image est générée
    // automatiquement depuis une frame de la vidéo (ffmpeg). On n'alerte
    // "sans cover" que si le projet n'a NI cover NI thumb video.
    const hasThumbVid = !!(p.thumbVideo && p.thumbVideo.trim());
    if ((!p.cover || !p.cover.trim()) && !hasThumbVid) w.push("sans cover");
    else if (p.cover && p.cover.trim() && NON_WEB.test(p.cover)) w.push("cover non-web");
    if ((p.resources || []).some((r) => r.src && NON_WEB.test(r.src) && !isExternal(r.src))) {
      w.push("média .mov/.tif");
    }
    return w;
  }

  // Preview au hover : thumb video self-hostée du projet (comme les
  // aperçus animés de YouTube). URLs externes / YouTube → cover statique.
  function hoverVideoSrc(p) {
    const tv = (p.thumbVideo || "").trim();
    if (!tv || isExternal(tv) || !/\.(mp4|webm|m4v)$/i.test(tv)) return null;
    return `/api/preview?p=${encodeURIComponent(tv)}`;
  }

  function coverSrc(p) {
    const cover = p.cover && p.cover.trim();
    if (!cover || NON_WEB.test(cover)) return null;
    return isExternal(cover) ? cover : `/api/preview?p=${encodeURIComponent(cover)}`;
  }

  const visibleCount = projects.filter((p) => !p.hidden).length;
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? projects.filter((p) =>
        [p.name, p.client, p.id, ...(p.tags || []), ...(Array.isArray(p.role) ? p.role : [p.role])]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(needle)))
    : projects;
  const dndEnabled = !needle && !saving;

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

      <div className="bo-toolbar">
        <div className="bo-search">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un projet, client, tag…"
            aria-label="Rechercher"
          />
        </div>
        {needle && (
          <span className="note" style={{ margin: 0 }}>
            {filtered.length} résultat{filtered.length > 1 ? "s" : ""} — le réordonnancement est désactivé pendant la recherche.
          </span>
        )}
      </div>

      {msg && (
        <p className="note" style={{ marginTop: 0, marginBottom: 12, color: msgKind === "err" ? "var(--danger)" : "var(--accent)" }}>
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
        <div className="projlib">
          {filtered.map((p) => {
            const i = projects.indexOf(p);
            const warns = warnings(p);
            const cSrc = coverSrc(p);
            const vSrc = hoverVideoSrc(p);
            const showVideo = hoverId === p.id && vSrc;
            return (
              <div
                key={p.id}
                className={
                  "projcard" +
                  (p.hidden ? " projcard--hidden" : "") +
                  (dragging === p.id ? " projcard--dragging" : "") +
                  (dropIdx === i && dragging && dragging !== p.id ? " projcard--dropover" : "")
                }
                draggable={dndEnabled}
                onDragStart={(e) => {
                  if (!dndEnabled) return;
                  dragIdx.current = i;
                  setDragging(p.id);
                  e.dataTransfer.effectAllowed = "move";
                  // Firefox exige un setData pour initier le drag.
                  e.dataTransfer.setData("text/plain", p.id);
                }}
                onDragOver={(e) => { if (dndEnabled && dragging) { e.preventDefault(); setDropIdx(i); } }}
                onDrop={(e) => {
                  if (!dndEnabled) return;
                  e.preventDefault();
                  reorder(dragIdx.current, i);
                  dragIdx.current = null;
                  setDragging(null);
                  setDropIdx(null);
                }}
                onDragEnd={() => { dragIdx.current = null; setDragging(null); setDropIdx(null); }}
                onMouseEnter={() => setHoverId(p.id)}
                onMouseLeave={() => setHoverId((h) => (h === p.id ? null : h))}
              >
                <a href={`/projects/${p.id}`} className="projcard__thumb" style={{ display: "block" }}>
                  {showVideo ? (
                    <video src={vSrc} poster={cSrc || undefined} autoPlay muted loop playsInline />
                  ) : cSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cSrc} alt="" loading="lazy" />
                  ) : (
                    <span style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: "100%", height: "100%", fontSize: 11, color: "var(--dim)",
                      letterSpacing: "0.12em",
                    }}>{vSrc ? "▶ VIDEO" : "NO COVER"}</span>
                  )}
                  <span className="projcard__order">#{i + 1}</span>
                  <span className="projcard__badges">
                    {p.hidden && <span className="projcard__badge">caché</span>}
                    {vSrc && !p.hidden && <span className="projcard__badge">▶</span>}
                    {warns.map((w) => (
                      <span key={w} className="projcard__badge projcard__badge--warn">⚠ {w}</span>
                    ))}
                  </span>
                </a>

                {/* Actions rapides au hover — façon YouTube Studio */}
                <div className="projcard__actions">
                  <a href={`/projects/${p.id}`} className="projcard__act" title="Éditer">✎</a>
                  <button
                    type="button"
                    className="projcard__act"
                    style={{ fontSize: 9, letterSpacing: "0.08em" }}
                    title={p.hidden ? "Republier sur le site" : "Masquer du site"}
                    onClick={() => toggleHidden(p)}
                  >{p.hidden ? "SHOW" : "HIDE"}</button>
                  <button
                    type="button"
                    className="projcard__act"
                    style={{ fontSize: 9, letterSpacing: "0.08em" }}
                    title="Dupliquer"
                    onClick={() => duplicate(p)}
                  >DUP</button>
                  <button
                    type="button"
                    className="projcard__act projcard__act--danger"
                    title="Supprimer"
                    onClick={() => del(p.id)}
                  >×</button>
                </div>

                <div className="projcard__meta">
                  <a href={`/projects/${p.id}`} className="projcard__name">{p.name}</a>
                  <div className="projcard__sub">
                    {[p.client, Array.isArray(p.role) ? p.role.join(" / ") : p.role]
                      .filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loaded && projects.length > 0 && (
        <p className="note" style={{ marginTop: 16 }}>
          Glisse une card pour réordonner (l'ordre du site suit). Survole une card pour prévisualiser la thumb video.
        </p>
      )}
    </>
  );
}
