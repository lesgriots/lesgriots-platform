// Nouvelle publication Instagram : médias, légende, quand, et (option) une
// automatisation Griot DM reliée au post dès sa mise en ligne.
"use client";
import { useEffect, useMemo, useState } from "react";
import { CSS as FORM_CSS } from "../../components/AutomationForm";

const TYPES = [
  ["image", "Photo"],
  ["carousel", "Carrousel"],
  ["reel", "Reel"],
  ["story", "Story"],
];
const preview = (p) => `/api/preview?p=${encodeURIComponent(p)}`;
const isVid = (m) => m.type === "video";

function pad(n) { return String(n).padStart(2, "0"); }
function inOneHour() {
  const d = new Date(Date.now() + 3600e3);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

export default function Publier() {
  const [kind, setKind] = useState("image");
  const [media, setMedia] = useState([]);
  const [caption, setCaption] = useState("");
  const [when, setWhen] = useState("now");
  const [at, setAt] = useState(inOneHour());
  const [autoMode, setAutoMode] = useState("none");
  const [autoId, setAutoId] = useState("");
  const [keywords, setKeywords] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [autos, setAutos] = useState([]);
  const [resources, setResources] = useState([]);
  const [upload, setUpload] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    fetch("/api/instagram/automations").then((r) => r.json()).then((a) => setAutos(Array.isArray(a) ? a : [])).catch(() => {});
    fetch("/api/resources").then((r) => r.json()).then((a) => setResources(Array.isArray(a) ? a : [])).catch(() => {});
  }, []);

  const max = kind === "carousel" ? 10 : 1;
  const accept = kind === "reel" ? "video/mp4,video/quicktime" : kind === "image" ? "image/jpeg" : "image/jpeg,video/mp4,video/quicktime";

  function sendFile(file) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append("file", file);
      form.append("subdir", "instagram");
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) setUpload({ name: file.name, pct: Math.round((e.loaded / e.total) * 100) });
      });
      xhr.addEventListener("load", () => {
        let d = {};
        try { d = JSON.parse(xhr.responseText); } catch { /* */ }
        xhr.status < 300 && d.path ? resolve({ path: d.path, type: d.type }) : reject(new Error(d.error || "Envoi échoué"));
      });
      xhr.addEventListener("error", () => reject(new Error("Envoi interrompu")));
      xhr.open("POST", "/api/upload");
      xhr.send(form);
    });
  }

  async function addFiles(list) {
    setMsg("");
    const files = [...list].slice(0, max - media.length);
    for (const f of files) {
      if (/\.(png|webp|heic|gif)$/i.test(f.name)) { setMsg(`« ${f.name} » : Instagram n'accepte que le JPEG pour les photos. Exporte-la en .jpg.`); continue; }
      try { const m = await sendFile(f); setMedia((x) => [...x, m].slice(0, max)); }
      catch (e) { setMsg("⚠ " + e.message); }
    }
    setUpload(null);
  }

  function move(k, d) {
    setMedia((x) => { const y = [...x]; const j = k + d; if (j < 0 || j >= y.length) return y; [y[k], y[j]] = [y[j], y[k]]; return y; });
  }

  function changeKind(k) {
    setKind(k);
    setI(0);
    if (k !== "carousel") setMedia((x) => x.slice(0, 1));
  }

  const tags = (caption.match(/#/g) || []).length;
  const cur = media[Math.min(i, media.length - 1)];

  async function submit() {
    setBusy(true); setMsg("");
    const body = {
      kind, media, caption,
      scheduled_at: when === "later" ? new Date(at).toISOString() : null,
      automation: autoMode === "none" ? null
        : autoMode === "existing" ? { mode: "existing", id: autoId }
        : { mode: "new", keywords, resource_id: resourceId, link_url: linkUrl },
    };
    const r = await fetch("/api/instagram/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg("⚠ " + (d.error || "Erreur")); return; }
    window.location.href = (window.__BP || "") + "/instagram?tab=publications";
  }

  const pret = media.length && (kind !== "carousel" || media.length >= 2) && (autoMode !== "new" || keywords.trim()) && (autoMode !== "existing" || autoId);

  return (
    <div className="bo-page">
      <style>{FORM_CSS + CSS}</style>
      <div className="bo-tete"><div className="bo-tete__gauche">
        <div className="bo-fil"><a href="/instagram?tab=publications">Instagram</a> / nouvelle publication</div>
        <h1>Publier sur @lagriotheque</h1>
      </div></div>

      <div className="gdm-edit">
        <div>
          <h2>Type</h2>
          <div className="pub-types">
            {TYPES.map(([k, l]) => <button key={k} type="button" className={kind === k ? "est-actif" : ""} onClick={() => changeKind(k)}>{l}</button>)}
          </div>

          <h2>{kind === "carousel" ? `Médias (${media.length}/10)` : "Média"}</h2>
          <div className="pub-medias">
            {media.map((m, k) => (
              <div key={m.path} className={"pub-media" + (k === i ? " est-vu" : "")} onClick={() => setI(k)}>
                {isVid(m) ? <video src={preview(m.path)} muted /> : <img src={preview(m.path)} alt="" />}
                <div className="pub-media__outils" onClick={(e) => e.stopPropagation()}>
                  {kind === "carousel" && <><button type="button" onClick={() => move(k, -1)} aria-label="Avancer">‹</button><button type="button" onClick={() => move(k, 1)} aria-label="Reculer">›</button></>}
                  <button type="button" onClick={() => setMedia((x) => x.filter((_, j) => j !== k))} aria-label="Retirer">×</button>
                </div>
              </div>
            ))}
            {media.length < max && (
              <label className="pub-ajout">
                <input type="file" accept={accept} multiple={kind === "carousel"} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                <span>{upload ? `${upload.pct} %` : "+ Ajouter"}</span>
              </label>
            )}
          </div>
          <div className="champ__aide">
            {kind === "reel" ? "Vidéo MP4 ou MOV, 3 s à 15 min, son déjà monté (pas de musique Instagram via l'API)."
              : kind === "story" ? "Une photo JPEG ou une vidéo. La story disparaît au bout de 24 h, sans légende."
              : "Photos en JPEG, format 4:5 ou carré conseillé."}
          </div>

          {kind !== "story" && (<>
            <h2>Légende</h2>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={7} placeholder={"Commente RECIT et je t'envoie la grille en DM 📩"} />
            <div className="champ__aide">{caption.length} / 2 200 caractères · {tags} / 30 hashtags</div>
          </>)}

          <h2>Quand</h2>
          <div className="pub-types">
            <button type="button" className={when === "now" ? "est-actif" : ""} onClick={() => setWhen("now")}>Maintenant</button>
            <button type="button" className={when === "later" ? "est-actif" : ""} onClick={() => setWhen("later")}>Programmer</button>
          </div>
          {when === "later" && <div className="champ"><label>Date et heure (heure de Paris)</label><input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></div>}

          {kind !== "story" && (<>
            <h2>Réponse automatique en DM</h2>
            <div className="pub-types">
              <button type="button" className={autoMode === "none" ? "est-actif" : ""} onClick={() => setAutoMode("none")}>Aucune</button>
              <button type="button" className={autoMode === "new" ? "est-actif" : ""} onClick={() => setAutoMode("new")}>Nouvelle</button>
              <button type="button" className={autoMode === "existing" ? "est-actif" : ""} onClick={() => setAutoMode("existing")} disabled={!autos.length}>Existante</button>
            </div>
            {autoMode === "new" && (<>
              <div className="champ"><label>Mot-clé à commenter</label><input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="RECIT" /></div>
              <div className="row">
                <div className="champ"><label>Ressource envoyée</label>
                  <select value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
                    <option value="">— aucune —</option>
                    {resources.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                  </select></div>
                <div className="champ"><label>…ou lien</label><input className="mono" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://lagriotheque.com/…" /></div>
              </div>
              <div className="champ__aide">Crée une automatisation active sur ce post : réponse publique, DM, email demandé, puis le lien. Tu pourras l'affiner ensuite dans l'onglet Automatisations.</div>
            </>)}
            {autoMode === "existing" && (
              <div className="champ"><label>Automatisation</label>
                <select value={autoId} onChange={(e) => setAutoId(e.target.value)}>
                  <option value="">— choisir —</option>
                  {autos.map((a) => <option key={a.id} value={a.id}>{a.title}{a.active ? "" : " (en pause)"}</option>)}
                </select></div>
            )}
          </>)}

          <div className="bo-actions-collees">
            <button className="btn" onClick={submit} disabled={!pret || busy}>{busy ? "…" : when === "later" ? "Programmer" : "Publier maintenant"}</button>
            <a className="btn btn--ghost" href="/instagram?tab=publications">Annuler</a>
            <span className="note" style={{ margin: 0 }}>{msg}</span>
          </div>
        </div>

        <aside className="gdm-apercu pub-apercu" aria-label="Aperçu du post">
          <div className="gdm-apercu__tete">lagriotheque</div>
          <div className={"pub-cadre pub-cadre--" + kind}>
            {cur ? (isVid(cur) ? <video src={preview(cur.path)} muted autoPlay loop playsInline /> : <img src={preview(cur.path)} alt="" />)
              : <span>Ajoute un média</span>}
            {kind === "carousel" && media.length > 1 && <div className="pub-points">{media.map((_, k) => <i key={k} className={k === i ? "on" : ""} onClick={() => setI(k)} />)}</div>}
          </div>
          {kind !== "story" && <div className="pub-legende"><b>lagriotheque</b> {caption || <span className="note" style={{ display: "inline" }}>ta légende</span>}</div>}
        </aside>
      </div>
    </div>
  );
}

const CSS = `
.pub-types { display: flex; gap: 6px; flex-wrap: wrap; }
.pub-types button { border: 1px solid var(--rule-fort); background: transparent; border-radius: 999px; padding: 8px 16px; font: inherit; font-size: 14px; cursor: pointer; color: var(--ink-2); }
.pub-types button:hover { border-color: var(--ink); color: var(--ink); }
.pub-types button.est-actif { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.pub-types button:disabled { opacity: .35; cursor: default; }
.pub-medias { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 10px; }
.pub-media, .pub-ajout { position: relative; aspect-ratio: 4/5; border-radius: 14px; overflow: hidden; background: var(--beige); box-shadow: inset 0 0 0 1px var(--rule); cursor: pointer; }
.pub-media.est-vu { box-shadow: 0 0 0 2px var(--ink); }
.pub-media img, .pub-media video { width: 100%; height: 100%; object-fit: cover; display: block; }
.pub-media__outils { position: absolute; right: 6px; top: 6px; display: flex; gap: 4px; }
.pub-media__outils button { width: 24px; height: 24px; border-radius: 50%; border: 0; background: rgba(246,245,243,.92); font-size: 14px; line-height: 1; cursor: pointer; }
.pub-ajout { display: grid; place-items: center; border: 1px dashed var(--rule-fort); box-shadow: none; color: var(--ink-2); font-size: 14px; margin: 0; }
.pub-ajout input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.bo .pub-apercu .gdm-apercu__tete { font-weight: 500; }
.pub-cadre { position: relative; aspect-ratio: 4/5; background: var(--paper-3); display: grid; place-items: center; color: var(--ink-dim); font-size: 13px; }
.pub-cadre--story, .pub-cadre--reel { aspect-ratio: 9/16; }
.pub-cadre img, .pub-cadre video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.pub-points { position: absolute; bottom: 10px; left: 0; right: 0; display: flex; justify-content: center; gap: 5px; }
.pub-points i { width: 6px; height: 6px; border-radius: 50%; background: rgba(246,245,243,.55); cursor: pointer; }
.pub-points i.on { background: var(--paper); }
.pub-legende { padding: 14px 16px 18px; font-size: 13.5px; line-height: 1.45; white-space: pre-line; max-height: 260px; overflow-y: auto; }
`;
