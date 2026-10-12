// Formulaire dédié aux événements IRL (masterclasses, talks, soirées, projections).
// Un événement n'est PAS lié à une formation : c'est un rendez-vous ponctuel
// avec sa propre date, son lieu, sa ville, son image et son lien d'inscription.
"use client";
import { useEffect, useState } from "react";
import Type from "./Type";
import MediaInput from "./MediaInput";

const STATUS_OPTIONS = ["À VENIR", "COMPLET", "ANNULÉ", "PASSÉ"];

// Liste éditable (programme, intervenants) : une carte par élément.
function ListeEditable({ items, onChange, champs, nouveau, libelle }) {
  const liste = Array.isArray(items) ? items : [];
  const maj = (i, k, v) => onChange(liste.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const bouge = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= liste.length) return;
    const copie = liste.slice();
    [copie[i], copie[j]] = [copie[j], copie[i]];
    onChange(copie);
  };
  return (
    <div style={{ display: "grid", gap: 14, marginTop: 8 }}>
      {liste.map((it, i) => (
        <div key={i} style={{ border: "1px solid var(--line, #ddd)", padding: 14, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>{libelle} {i + 1}</strong>
            <span style={{ display: "flex", gap: 6 }}>
              <button type="button" className="btn btn--ghost" onClick={() => bouge(i, -1)}>↑</button>
              <button type="button" className="btn btn--ghost" onClick={() => bouge(i, 1)}>↓</button>
              <button type="button" className="btn btn--danger" onClick={() => onChange(liste.filter((_, j) => j !== i))}>Retirer</button>
            </span>
          </div>
          {champs.map(([k, label, type, ph]) => (
            <div key={k}>
              <label>{label}</label>
              {type === "lignes" ? (
                <textarea rows={4} value={(it[k] || []).join("\n")} placeholder={ph} onChange={(e) => maj(i, k, e.target.value.split("\n"))} />
              ) : type === "texte" ? (
                <textarea rows={3} value={it[k] || ""} placeholder={ph} onChange={(e) => maj(i, k, e.target.value)} />
              ) : (
                <input value={it[k] || ""} placeholder={ph} onChange={(e) => maj(i, k, e.target.value)} />
              )}
            </div>
          ))}
        </div>
      ))}
      <button type="button" className="btn btn--ghost" onClick={() => onChange([...liste, { ...nouveau }])}>+ Ajouter</button>
    </div>
  );
}


export default function EventForm({ initial = null }) {
  const isEdit = initial !== null;
  const [data, setData] = useState(() => initial || newBlank());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function newBlank() {
    return {
      id: "",
      title: "",
      kind: "",          // ex: "Masterclass", "Talk", "Soirée", "Projection"
      date: "",
      time: "",
      location: "",
      city: "",
      description: "",
      media: { type: "image", src: "", credit: "" },
      link: "",
      link_label: "",
      status: "À VENIR",
      capacity: 0,
      min_age: 0,
      position: 0,
    };
  }

  const set = (key, val) => setData((d) => ({ ...d, [key]: val }));

  // Jauge en direct (places prises / restantes) pour un événement existant.
  const [places, setPlaces] = useState(null);
  useEffect(() => {
    if (!isEdit || !data.id) return;
    fetch((window.__BP || "") + `/api/places/${data.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setPlaces)
      .catch(() => {});
  }, [isEdit, data.id]);

  // Auto-id à partir du titre + date
  useEffect(() => {
    if (!isEdit && !data.id && data.title) {
      const slug = data.title
        .toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const stamp = /^\d{4}-\d{2}-\d{2}/.test(data.date) ? "-" + data.date.replace(/-/g, "").slice(2) : "";
      set("id", `evt-${slug}${stamp}`.slice(0, 60));
    }
  }, [data.title, data.date]);

  async function save() {
    if (!data.title) { setMsg("✗ Titre requis"); return; }
    if (!data.id) { setMsg("✗ Renseigne un titre pour générer l'id"); return; }
    setSaving(true); setMsg("");
    try {
      const url = isEdit ? `/api/events/${data.id}` : `/api/events`;
      const r = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setMsg(`✓ Sauvegardé. ${isEdit ? "" : "Redirection..."}`);
      if (!isEdit) setTimeout(() => window.location.href = (window.__BP || "") + `/events/${j.id}`, 800);
    } catch (e) { setMsg(`✗ ${e.message}`); }
    finally { setSaving(false); }
  }

  async function del() {
    if (!isEdit) return;
    if (!confirm(`Supprimer l'événement "${data.id}" ?`)) return;
    await fetch(`/api/events/${data.id}`, { method: "DELETE" });
    window.location.href = (window.__BP || "") + "/events";
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>
          <Type
            text={isEdit ? `événement — ${data.id}` : "nouvel événement"}
            speed={28} cursor="always"
          />
        </h1>
        <div className="actions" style={{ margin: 0 }}>
          <a className="btn btn--ghost" href="/events">← Liste</a>
          {isEdit && <button className="btn btn--danger" onClick={del}>Supprimer</button>}
          <button className="btn" onClick={save} disabled={saving}>
            {saving ? "..." : "Sauvegarder"}
          </button>
        </div>
      </div>
      {msg && <p className="note" style={{ marginTop: 12 }}>{msg}</p>}

      <section style={{ marginTop: 28 }}>
        <div>
          <label>Titre <span style={{ color: "var(--accent)" }}>*</span></label>
          <input
            value={data.title || ""}
            onChange={(e) => set("title", e.target.value)}
            placeholder='ex: "Masterclass — Bâtir son récit de marque"'
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <label>Type d'événement</label>
          <input
            value={data.kind || ""}
            onChange={(e) => set("kind", e.target.value)}
            placeholder='ex: "Masterclass", "Talk", "Soirée", "Projection"'
          />
          <p className="note">Petit label affiché au-dessus du titre.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 16 }}>
          <div>
            <label>Date</label>
            <input
              type="date"
              value={/^\d{4}-\d{2}-\d{2}/.test(data.date) ? data.date.slice(0, 10) : ""}
              onChange={(e) => set("date", e.target.value)}
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </div>
          <div>
            <label>Heure</label>
            <input
              value={data.time || ""}
              onChange={(e) => set("time", e.target.value)}
              placeholder='ex: "19h00" ou "19h – 22h"'
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 16 }}>
          <div>
            <label>Lieu</label>
            <input
              value={data.location || ""}
              onChange={(e) => set("location", e.target.value)}
              placeholder='ex: "La Griothèque — atelier"'
            />
          </div>
          <div>
            <label>Ville</label>
            <input
              value={data.city || ""}
              onChange={(e) => set("city", e.target.value)}
              placeholder='ex: "Le Havre" ou "Paris"'
            />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <label>ID (slug)</label>
          <input
            value={data.id || ""}
            disabled={isEdit}
            onChange={(e) => set("id", e.target.value)}
          />
          {!isEdit && <p className="note">Généré auto depuis le titre + la date.</p>}
        </div>

        <div style={{ marginTop: 16 }}>
          <label>Description</label>
          <textarea
            rows={4}
            value={data.description || ""}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Ce qui se passe, à qui ça s'adresse, ce qu'on en repart."
          />
        </div>

        <div style={{ marginTop: 24 }}>
          <label style={{ fontWeight: 600 }}>Média (image ou vidéo)</label>
          <MediaInput value={data.media} onChange={(m) => set("media", m)} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 24 }}>
          <div>
            <label>Lien (inscription / billetterie)</label>
            <input
              value={data.link || ""}
              onChange={(e) => set("link", e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <label>Texte du bouton</label>
            <input
              value={data.link_label || ""}
              onChange={(e) => set("link_label", e.target.value)}
              placeholder={`ex : "Réserver", "S'inscrire", "En savoir plus"`}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 16 }}>
          <div>
            <label>Statut</label>
            <select value={data.status || "À VENIR"} onChange={(e) => set("status", e.target.value)}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label>Position (ordre d'affichage)</label>
            <input
              type="number"
              value={data.position ?? 0}
              onChange={(e) => set("position", Number(e.target.value))}
            />
            <p className="note">Plus petit = affiché en premier.</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 16 }}>
          <div>
            <label>Places max (inscriptions en ligne)</label>
            <input
              type="number"
              min={0}
              value={data.capacity ?? 0}
              onChange={(e) => set("capacity", Math.max(0, Number(e.target.value) || 0))}
            />
            <p className="note">0 = pas de limite. Une fois atteint, le site affiche « Complet » et ferme le formulaire.</p>
          </div>
          <div>
            <label>Inscrits</label>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 15, marginTop: 10 }}>
              {places
                ? (places.capacity
                    ? `${places.capacity - places.remaining} / ${places.capacity}${places.full ? " — complet" : ` — ${places.remaining} restante${places.remaining > 1 ? "s" : ""}`}`
                    : "pas de limite")
                : "—"}
            </p>
            <p className="note">Détail dans l'onglet Leads (source inscription-evenement).</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 16 }}>
          <div>
            <label>Âge minimum</label>
            <input
              type="number"
              min={0}
              value={data.min_age ?? 0}
              onChange={(e) => set("min_age", Math.max(0, Number(e.target.value) || 0))}
            />
            <p className="note">0 = pas de limite. Ex. 18 : l'inscription est refusée en dessous.</p>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 20 }}>Contenu de la page</h2>
        <p className="note">Gabarit workshop : promesse, tu repars avec, programme (un écran par temps, comme les formations), avec qui, pour qui, réserver, et après. Une section vide n'est pas affichée.</p>

        <div style={{ marginTop: 16 }}>
          <label>Accroche (sous le titre, en haut de page)</label>
          <input value={data.tagline || ""} onChange={(e) => set("tagline", e.target.value)} placeholder="Une ligne." />
        </div>

        <div style={{ marginTop: 16 }}>
          <label>Promesse (le texte qui passe du gris au noir)</label>
          <textarea rows={3} value={data.promise || ""} onChange={(e) => set("promise", e.target.value)} placeholder="Ce que tu sais faire en sortant, pas ce qu'on va aborder." />
        </div>

        <div style={{ marginTop: 16 }}>
          <label>Tu repars avec (une ligne par point, « Titre : détail »)</label>
          <textarea rows={5} value={(data.included || []).join("\n")} onChange={(e) => set("included", e.target.value.split("\n"))} placeholder={"La grammaire de Snapchat : face caméra, sur le vif, sous-titré."} />
        </div>

        <div style={{ marginTop: 24 }}>
          <label style={{ fontWeight: 600 }}>Section en écrans (programme, enjeux…)</label>
          <p className="note">Un écran par élément, comme le programme des formations. Sans image, l'écran affiche la durée en grand, ou son numéro.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 8 }}>
            <div><label>Titre de la section</label><input value={data.program_title || ""} onChange={(e) => set("program_title", e.target.value)} placeholder="Programme" /></div>
            <div><label>Pastille (facultatif)</label><input value={data.program_pill || ""} onChange={(e) => set("program_pill", e.target.value)} placeholder="ex : 3 enjeux" /></div>
          </div>
          <ListeEditable
            items={data.program}
            onChange={(v) => set("program", v)}
            libelle="Écran"
            nouveau={{ label: "", duration: "", title: "", text: "", items: [], image: "" }}
            champs={[
              ["label", "Étiquette", "input", "ex : Temps 1 (laisser vide = automatique)"],
              ["duration", "Durée", "input", "ex : 20 min"],
              ["title", "Titre", "input", "ex : La génération Snapchat"],
              ["text", "Texte", "texte", "Une ou deux phrases."],
              ["items", "Points (un par ligne)", "lignes", ""],
              ["image", "Image (chemin ou URL, facultatif)", "input", "img/..."],
            ]}
          />
        </div>

        <div style={{ marginTop: 24 }}>
          <label style={{ fontWeight: 600 }}>Avec qui</label>
          <ListeEditable
            items={data.speakers}
            onChange={(v) => set("speakers", v)}
            libelle="Intervenant"
            nouveau={{ name: "", role: "", bio: "", photo: "" }}
            champs={[
              ["name", "Nom", "input", ""],
              ["role", "Rôle", "input", "ex : Head of Creative Strategy, Snap"],
              ["bio", "Une phrase (facultatif)", "texte", ""],
              ["photo", "Photo (chemin ou URL, facultatif)", "input", "img/..."],
            ]}
          />
          <div style={{ marginTop: 12 }}>
            <label>Note sous les intervenants (facultatif)</label>
            <input value={data.speakers_note || ""} onChange={(e) => set("speakers_note", e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <label>Pour qui (une ligne par profil)</label>
          <textarea rows={3} value={(data.audience_points || []).join("\n")} onChange={(e) => set("audience_points", e.target.value.split("\n"))} />
        </div>
        <div style={{ marginTop: 16 }}>
          <label>Pour qui, en une phrase (carte de réservation)</label>
          <input value={data.audience || ""} onChange={(e) => set("audience", e.target.value)} />
        </div>

        <div style={{ marginTop: 24 }}>
          <label style={{ fontWeight: 600 }}>Et après</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 8 }}>
            <div><label>Titre</label><input value={(data.after || {}).title || ""} onChange={(e) => set("after", { ...(data.after || {}), title: e.target.value })} placeholder="La Griothèque" /></div>
            <div><label>Lien</label><input value={(data.after || {}).link || ""} onChange={(e) => set("after", { ...(data.after || {}), link: e.target.value })} placeholder="/formations" /></div>
          </div>
          <div style={{ marginTop: 12 }}><label>Texte</label><textarea rows={3} value={(data.after || {}).text || ""} onChange={(e) => set("after", { ...(data.after || {}), text: e.target.value })} /></div>
          <div style={{ marginTop: 12 }}><label>Texte du bouton</label><input value={(data.after || {}).label || ""} onChange={(e) => set("after", { ...(data.after || {}), label: e.target.value })} placeholder="Voir les formations" /></div>
        </div>
      </section>

      <div className="actions" style={{ marginTop: 32 }}>
        <a className="btn btn--ghost" href="/events">← Annuler</a>
        {isEdit && <button className="btn btn--danger" onClick={del}>Supprimer</button>}
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? "..." : "Sauvegarder"}
        </button>
      </div>
    </>
  );
}
