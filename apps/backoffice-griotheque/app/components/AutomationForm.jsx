// Éditeur d'une automatisation Instagram (Griot DM).
// Colonne de gauche : les réglages, dans l'ordre où la personne les vit.
// Colonne de droite : l'aperçu de la conversation, recalculé à chaque frappe.
"use client";
import { useEffect, useMemo, useState } from "react";
import { DEFAULTS } from "../../lib/griot-dm-defaults.js";

const VIDE = {
  id: "", title: "", active: false, trigger: "comment", match: "contains", keywords: "",
  media_ids: [], public_replies: "Je t'envoie ça en DM 📩\nRegarde tes messages 👀\nC'est parti, check tes DM ✨",
  opening_text: "", opening_button: "", follow_gate: false, follow_text: "",
  ask_email: true, email_text: "", email_invalid_text: "", newsletter: true,
  resource_id: "", link_url: "", link_label: "", delivery_text: "", followup_text: "", position: 0,
};

const slug = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
const asText = (v) => (Array.isArray(v) ? v.join("\n") : v || "");

export default function AutomationForm({ initial, isNew }) {
  const [f, setF] = useState(() => ({
    ...VIDE, ...(initial || {}),
    keywords: Array.isArray(initial?.keywords) ? initial.keywords.join(", ") : (initial?.keywords ?? VIDE.keywords),
    public_replies: initial ? asText(initial.public_replies) : VIDE.public_replies,
    media_ids: initial?.media_ids || [],
  }));
  const [resources, setResources] = useState([]);
  const [media, setMedia] = useState(null);
  const [mediaErr, setMediaErr] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/resources").then((r) => r.json()).then((r) => setResources(Array.isArray(r) ? r : [])).catch(() => {});
    fetch("/api/instagram/media").then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setMedia(d); else { setMedia([]); setMediaErr(d.error || "indisponible"); }
    }).catch((e) => { setMedia([]); setMediaErr(e.message); });
  }, []);

  const set = (k) => (e) => {
    const v = e && e.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e;
    setF((x) => {
      const n = { ...x, [k]: v };
      if (k === "title" && isNew && (!x.id || x.id === slug(x.title))) n.id = slug(v);
      return n;
    });
  };

  function toggleMedia(id) {
    setF((x) => ({ ...x, media_ids: x.media_ids.includes(id) ? x.media_ids.filter((m) => m !== id) : [...x.media_ids, id] }));
  }

  async function save() {
    setSaving(true); setMsg("");
    const body = {
      ...f,
      keywords: String(f.keywords).split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
      public_replies: String(f.public_replies).split("\n").map((s) => s.trim()).filter(Boolean),
    };
    const r = await fetch(isNew ? "/api/instagram/automations" : `/api/instagram/automations/${f.id}`, {
      method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { setMsg("⚠ " + (d.error || "Erreur")); return; }
    setMsg("Enregistré ✓");
    if (isNew) window.location.href = (window.__BP || "") + `/instagram/${d.id}`;
  }

  async function del() {
    if (!confirm("Supprimer cette automatisation ?")) return;
    await fetch(`/api/instagram/automations/${f.id}`, { method: "DELETE" });
    window.location.href = (window.__BP || "") + "/instagram";
  }

  const res = resources.find((r) => r.id === f.resource_id);
  const url = f.link_url || (res ? (/^https?:/i.test(res.href || "") ? res.href : `https://lagriotheque.com/${String(res.href || "").replace(/^\/+/, "")}`) : "");
  const kw = String(f.keywords).split(/[,\n]/).map((s) => s.trim()).filter(Boolean);

  // Aperçu : la conversation telle que la personne la vivra.
  const apercu = useMemo(() => {
    const p = (t) => String(t || "").replace(/\{pseudo\}/g, "@camille").replace(/\{prenom\}/g, "camille").replace(/\{lien\}/g, url);
    const steps = [];
    const replies = String(f.public_replies).split("\n").filter((s) => s.trim());
    if (f.trigger !== "dm") {
      steps.push({ who: "eux", where: "commentaire", text: kw[0] ? kw[0].toUpperCase() : (f.match === "any" ? "Trop bien 🔥" : "…") });
      if (replies.length) steps.push({ who: "nous", where: "réponse publique", text: p(replies[0]) + (replies.length > 1 ? `  (+${replies.length - 1} variante${replies.length > 2 ? "s" : ""})` : "") });
      steps.push({ who: "nous", where: "DM", text: p(f.opening_text || DEFAULTS.opening_text), quick: f.opening_button || DEFAULTS.opening_button });
      steps.push({ who: "eux", where: "DM", text: f.opening_button || DEFAULTS.opening_button });
    } else {
      steps.push({ who: "eux", where: "DM", text: kw[0] ? kw[0].toUpperCase() : "…" });
    }
    if (f.follow_gate) steps.push({ who: "nous", where: "DM · si pas abonné·e", text: p(f.follow_text || DEFAULTS.follow_text), quick: "C'est fait ✅" });
    if (f.ask_email) {
      steps.push({ who: "nous", where: "DM", text: p(f.email_text || DEFAULTS.email_text) });
      steps.push({ who: "eux", where: "DM", text: "camille@gmail.com" });
    }
    steps.push({ who: "nous", where: "DM", text: p(f.delivery_text || DEFAULTS.delivery_text), button: url ? (f.link_label || DEFAULTS.link_label) : "" });
    if (f.followup_text) steps.push({ who: "nous", where: "DM", text: p(f.followup_text) });
    return steps;
  }, [f, url]);

  return (
    <div className="gdm-edit">
      <style>{CSS}</style>
      <div>
        <h2>1 · Déclencheur</h2>
        <div className="row">
          <div className="champ"><label>Nom de l'automatisation</label><input value={f.title} onChange={set("title")} placeholder="Grille 4 couches — post du 12/10" /></div>
          <div className="champ"><label>Identifiant</label><input className="mono" value={f.id} onChange={set("id")} disabled={!isNew} /></div>
        </div>
        <div className="row">
          <div className="champ"><label>Où</label>
            <select value={f.trigger} onChange={set("trigger")}>
              <option value="comment">Commentaire sous un post / reel</option>
              <option value="dm">Message direct (ou réponse à une story)</option>
              <option value="both">Les deux</option>
            </select></div>
          <div className="champ"><label>Correspondance</label>
            <select value={f.match} onChange={set("match")}>
              <option value="contains">Contient le mot-clé</option>
              <option value="exact">Est exactement le mot-clé</option>
              <option value="any">N'importe quel commentaire</option>
            </select></div>
        </div>
        {f.match !== "any" && (
          <div className="champ"><label>Mots-clés</label><input value={f.keywords} onChange={set("keywords")} placeholder="RECIT, récit, guide" />
            <div className="champ__aide">Séparés par des virgules. Majuscules et accents ignorés : « recit » attrape « RÉCIT ».</div></div>
        )}

        {f.trigger !== "dm" && (
          <div className="champ"><label>Sur quels posts</label>
            {media === null ? <div className="note">Chargement des posts…</div>
              : media.length ? (
                <>
                  <div className="champ__aide" style={{ marginBottom: 8 }}>{f.media_ids.length ? `${f.media_ids.length} post(s) ciblé(s)` : "Aucun coché = tous les posts."}</div>
                  <div className="gdm-media">
                    {media.map((m) => (
                      <button type="button" key={m.id} className={"gdm-media__item" + (f.media_ids.includes(m.id) ? " est-choisi" : "")} onClick={() => toggleMedia(m.id)} title={(m.caption || "").slice(0, 140)}>
                        <img src={m.thumbnail_url || m.media_url} alt="" loading="lazy" />
                        <span>{m.timestamp ? new Date(m.timestamp).toLocaleDateString("fr-FR") : ""}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="champ__aide">Posts indisponibles ({mediaErr || "compte non connecté"}). Laisser vide = tous les posts, ou coller des identifiants de média :</div>
                  <input className="mono" value={f.media_ids.join(", ")} onChange={(e) => set("media_ids")(e.target.value.split(/[,\s]+/).filter(Boolean))} />
                </>
              )}
          </div>
        )}

        {f.trigger !== "dm" && (<>
          <h2>2 · Réponse publique &amp; premier DM</h2>
          <div className="champ"><label>Réponses publiques (une par ligne, tirée au sort)</label>
            <textarea value={f.public_replies} onChange={set("public_replies")} rows={3} />
            <div className="champ__aide">Varier évite que l'algorithme lise des réponses identiques comme du spam. Vide = pas de réponse publique.</div></div>
          <div className="champ"><label>Premier DM</label>
            <textarea value={f.opening_text} onChange={set("opening_text")} placeholder={DEFAULTS.opening_text} rows={3} />
            <div className="champ__aide">Meta n'autorise qu'UN message tant que la personne n'a pas répondu : d'où le bouton, qui ouvre la conversation.</div></div>
          <div className="champ"><label>Texte du bouton (20 car.)</label><input value={f.opening_button} onChange={set("opening_button")} placeholder={DEFAULTS.opening_button} maxLength={20} /></div>
        </>)}

        <h2>{f.trigger !== "dm" ? "3" : "2"} · Conditions</h2>
        <label className="gdm-case"><input type="checkbox" checked={f.follow_gate} onChange={set("follow_gate")} /> Exiger d'être abonné·e au compte</label>
        {f.follow_gate && <div className="champ"><label>Message si pas abonné·e</label><textarea value={f.follow_text} onChange={set("follow_text")} placeholder={DEFAULTS.follow_text} rows={2} /></div>}
        <label className="gdm-case"><input type="checkbox" checked={f.ask_email} onChange={set("ask_email")} /> Demander l'email (lead dans le BO + Systeme.io)</label>
        {f.ask_email && (<>
          <div className="champ"><label>Demande d'email</label><textarea value={f.email_text} onChange={set("email_text")} placeholder={DEFAULTS.email_text} rows={2} /></div>
          <div className="champ"><label>Si l'email est invalide</label><input value={f.email_invalid_text} onChange={set("email_invalid_text")} placeholder={DEFAULTS.email_invalid_text} /></div>
          <label className="gdm-case"><input type="checkbox" checked={f.newsletter} onChange={set("newsletter")} /> Inscrire à la newsletter (tag « Newsletter », consentement noté)</label>
          <div className="champ__aide">Si coché, la demande d'email doit le dire clairement (RGPD) — c'est le cas du texte par défaut.</div>
        </>)}

        <h2>{f.trigger !== "dm" ? "4" : "3"} · Livraison</h2>
        <div className="row">
          <div className="champ"><label>Ressource du BO</label>
            <select value={f.resource_id} onChange={set("resource_id")}>
              <option value="">— aucune —</option>
              {resources.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select></div>
          <div className="champ"><label>…ou lien libre (prioritaire)</label><input className="mono" value={f.link_url} onChange={set("link_url")} placeholder="https://lagriotheque.com/…" /></div>
        </div>
        <div className="champ"><label>Message de livraison</label><textarea value={f.delivery_text} onChange={set("delivery_text")} placeholder={DEFAULTS.delivery_text} rows={3} /></div>
        <div className="champ"><label>Texte du bouton lien (20 car.)</label><input value={f.link_label} onChange={set("link_label")} placeholder={DEFAULTS.link_label} maxLength={20} /></div>
        <div className="champ"><label>Message de relance (optionnel, juste après)</label>
          <textarea value={f.followup_text} onChange={set("followup_text")} rows={2} placeholder="Si tu veux aller plus loin, le workshop Stratégie et Storytelling c'est ici : https://lagriotheque.com/…" />
          <div className="champ__aide">Une ressource = une douleur = une offre payante derrière. C'est l'endroit pour la nommer.</div></div>
        <div className="champ__aide" style={{ marginTop: 14 }}>Variables : <code>{"{pseudo}"}</code> (@pseudo), <code>{"{prenom}"}</code> (pseudo sans @), <code>{"{lien}"}</code>.</div>

        <div className="bo-actions-collees">
          <label className="gdm-case" style={{ margin: 0 }}><input type="checkbox" checked={f.active} onChange={set("active")} /> Active</label>
          <button className="btn" onClick={save} disabled={saving}>{saving ? "…" : "Enregistrer"}</button>
          {!isNew && <a className="btn btn--ghost" href="/instagram?tab=simulateur">Tester</a>}
          {!isNew && <button className="btn btn--danger" onClick={del}>Supprimer</button>}
          <span className="note" style={{ margin: 0 }}>{msg}</span>
        </div>
      </div>

      <aside className="gdm-apercu" aria-label="Aperçu de la conversation">
        <div className="gdm-apercu__tete">Aperçu</div>
        <div className="gdm-fil">
          {apercu.map((s, i) => (
            <div key={i} className={"gdm-bulle gdm-bulle--" + s.who}>
              <div className="gdm-bulle__ou">{s.where}</div>
              <div className="gdm-bulle__txt">{s.text}</div>
              {s.button ? <div className="gdm-bulle__btn">{s.button} ↗</div> : null}
              {s.quick ? <div className="gdm-bulle__quick">{s.quick}</div> : null}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

export const CSS = `
.gdm-edit { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 36px; align-items: start; }
.gdm-apercu { position: sticky; top: 20px; border: 1px solid var(--ink); background: #fff; }
.gdm-apercu__tete { font-family: var(--font-mono); font-size: 10px; letter-spacing: .16em; text-transform: uppercase; padding: 10px 14px; border-bottom: 1px solid var(--ink); }
.gdm-fil { padding: 14px; display: grid; gap: 10px; max-height: calc(100vh - 120px); overflow-y: auto; }
.gdm-bulle { max-width: 86%; display: grid; gap: 4px; }
.gdm-bulle--eux { justify-self: start; }
.gdm-bulle--nous { justify-self: end; text-align: left; }
.gdm-bulle__ou { font-family: var(--font-mono); font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-dim); }
.gdm-bulle--nous .gdm-bulle__ou { text-align: right; }
.gdm-bulle__txt { padding: 9px 12px; border-radius: 16px; font-size: 13px; line-height: 1.4; white-space: pre-line; background: var(--paper-2); }
.gdm-bulle--nous .gdm-bulle__txt { background: var(--ink); color: var(--paper); }
.gdm-bulle__btn { border: 1px solid var(--ink); border-radius: 10px; padding: 7px 10px; text-align: center; font-size: 12.5px; font-weight: 500; }
.gdm-bulle__quick { justify-self: end; border: 1px solid var(--ink); border-radius: 999px; padding: 5px 12px; font-size: 12px; }
.gdm-case { display: flex; align-items: center; gap: 9px; text-transform: none; letter-spacing: 0; font-family: var(--font-sans); font-size: 14px; color: var(--ink); margin: 16px 0 0; cursor: pointer; }
.gdm-case input { width: auto; }
.gdm-media { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
.gdm-media__item { position: relative; border: 2px solid transparent; padding: 0; background: var(--paper-3); cursor: pointer; aspect-ratio: 4/5; overflow: hidden; }
.gdm-media__item img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: .55; }
.gdm-media__item.est-choisi { border-color: var(--ink); }
.gdm-media__item.est-choisi img { opacity: 1; }
.gdm-media__item span { position: absolute; left: 0; right: 0; bottom: 0; font-family: var(--font-mono); font-size: 9px; background: rgba(246,245,243,.9); padding: 2px 4px; }
@media (max-width: 1100px) { .gdm-edit { grid-template-columns: 1fr; } .gdm-apercu { position: static; } }
`;
