// Formulaire dédié aux événements IRL (masterclasses, talks, soirées, projections).
// Un événement n'est PAS lié à une formation : c'est un rendez-vous ponctuel
// avec sa propre date, son lieu, sa ville, son image et son lien d'inscription.
"use client";
import { useEffect, useState } from "react";
import Type from "./Type";
import MediaInput from "./MediaInput";

const STATUS_OPTIONS = ["À VENIR", "COMPLET", "ANNULÉ", "PASSÉ"];

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
      position: 0,
    };
  }

  const set = (key, val) => setData((d) => ({ ...d, [key]: val }));

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
      if (!isEdit) setTimeout(() => window.location.href = `/events/${j.id}`, 800);
    } catch (e) { setMsg(`✗ ${e.message}`); }
    finally { setSaving(false); }
  }

  async function del() {
    if (!isEdit) return;
    if (!confirm(`Supprimer l'événement "${data.id}" ?`)) return;
    await fetch(`/api/events/${data.id}`, { method: "DELETE" });
    window.location.href = "/events";
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
