// Formulaire dédié aux sessions. Pourquoi pas SimpleForm ?
// → Une session est soit liée à une FORMATION soit à un WORKSHOP, jamais les deux.
//   Une dropdown unifiée (combine formations + workshops avec un préfixe type)
//   est plus juste qu'avoir 2 dropdowns séparés "soit l'une soit l'autre".
"use client";
import { useEffect, useState } from "react";
import Type from "./Type";

const STATUS_OPTIONS = ["OUVERTE", "COMPLET", "ANNULÉE", "À VENIR"];

export default function SessionForm({ initial = null }) {
  const isEdit = initial !== null;
  const [data, setData] = useState(() => initial || newBlank());
  const [formations, setFormations] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Charge formations + workshops pour la dropdown unifiée
  useEffect(() => {
    fetch("/api/formations").then((r) => r.json()).then(setFormations);
    fetch("/api/workshops").then((r) => r.json()).then(setWorkshops);
  }, []);

  function newBlank() {
    return {
      id: "",
      date: "",
      formation_id: "",
      workshop_id: "",
      places: "",
      status: "OUVERTE",
    };
  }

  const set = (key, val) => setData((d) => ({ ...d, [key]: val }));

  // Valeur synthétique de la dropdown : "formation:<id>" ou "workshop:<id>"
  const linkedValue = data.formation_id
    ? `formation:${data.formation_id}`
    : data.workshop_id
      ? `workshop:${data.workshop_id}`
      : "";

  // Gère le choix dans la dropdown unifiée : met à jour formation_id OU workshop_id,
  // jamais les deux à la fois.
  function onLinkedChange(val) {
    if (!val) {
      setData((d) => ({ ...d, formation_id: "", workshop_id: "" }));
      return;
    }
    const [type, id] = val.split(":");
    if (type === "formation") {
      setData((d) => ({ ...d, formation_id: id, workshop_id: "" }));
    } else if (type === "workshop") {
      setData((d) => ({ ...d, formation_id: "", workshop_id: id }));
    }
  }

  // Auto-id à partir du target + date
  useEffect(() => {
    if (!isEdit && !data.id && (data.formation_id || data.workshop_id) && data.date) {
      const target = data.formation_id || data.workshop_id;
      const stamp = data.date.replace(/-/g, "").slice(2);
      set("id", `ses-${target}-${stamp}`.toLowerCase().slice(0, 60));
    }
  }, [data.formation_id, data.workshop_id, data.date]);

  async function save() {
    if (!data.id) { setMsg("✗ Choisis une formation/workshop + une date pour générer l'id"); return; }
    if (!data.date) { setMsg("✗ Date requise"); return; }
    if (!data.formation_id && !data.workshop_id) { setMsg("✗ Choisis une formation ou un workshop"); return; }
    setSaving(true); setMsg("");
    try {
      const url = isEdit ? `/api/sessions/${data.id}` : `/api/sessions`;
      const r = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setMsg(`✓ Sauvegardé. ${isEdit ? "" : "Redirection..."}`);
      if (!isEdit) setTimeout(() => window.location.href = `/sessions/${j.id}`, 800);
    } catch (e) { setMsg(`✗ ${e.message}`); }
    finally { setSaving(false); }
  }

  async function del() {
    if (!isEdit) return;
    if (!confirm(`Supprimer la session "${data.id}" ?`)) return;
    await fetch(`/api/sessions/${data.id}`, { method: "DELETE" });
    window.location.href = "/sessions";
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>
          <Type
            text={isEdit ? `session — ${data.id}` : "nouvelle session"}
            speed={28} cursor="always"
          />
        </h1>
        <div className="actions" style={{ margin: 0 }}>
          <a className="btn btn--ghost" href="/sessions">← Liste</a>
          {isEdit && <button className="btn btn--danger" onClick={del}>Supprimer</button>}
          <button className="btn" onClick={save} disabled={saving}>
            {saving ? "..." : "Sauvegarder"}
          </button>
        </div>
      </div>
      {msg && <p className="note" style={{ marginTop: 12 }}>{msg}</p>}

      <section style={{ marginTop: 28 }}>
        {/* Dropdown unifiée : Formations + Workshops avec préfixe type */}
        <div>
          <label>
            Formation ou workshop <span style={{ color: "var(--accent)" }}>*</span>
          </label>
          <select value={linkedValue} onChange={(e) => onLinkedChange(e.target.value)}>
            <option value="">— Choisis dans la liste —</option>
            {formations.length > 0 && (
              <optgroup label="Formations">
                {formations.map((f) => (
                  <option key={f.id} value={`formation:${f.id}`}>
                    {f.title || f.id}
                  </option>
                ))}
              </optgroup>
            )}
            {workshops.length > 0 && (
              <optgroup label="Workshops">
                {workshops.map((w) => (
                  <option key={w.id} value={`workshop:${w.id}`}>
                    {w.title || w.id}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <p className="note">
            Une session est liée à <strong>une seule</strong> formation OU un seul workshop.
          </p>
        </div>

        {/* Date — calendrier natif */}
        <div style={{ marginTop: 16 }}>
          <label>Date <span style={{ color: "var(--accent)" }}>*</span></label>
          <input
            type="date"
            value={/^\d{4}-\d{2}-\d{2}/.test(data.date) ? data.date.slice(0, 10) : ""}
            onChange={(e) => set("date", e.target.value)}
            style={{ fontFamily: "var(--font-mono)" }}
          />
          <p className="note">Clique pour ouvrir le calendrier.</p>
        </div>

        {/* ID — auto-généré, modifiable si besoin */}
        <div style={{ marginTop: 16 }}>
          <label>ID (slug)</label>
          <input
            value={data.id || ""}
            disabled={isEdit}
            onChange={(e) => set("id", e.target.value)}
          />
          {!isEdit && <p className="note">Généré auto depuis la cible + la date.</p>}
        </div>

        <div style={{ marginTop: 16 }}>
          <label>Places disponibles</label>
          <input
            value={data.places || ""}
            onChange={(e) => set("places", e.target.value)}
            placeholder='ex: "8 / 12" ou "10"'
          />
          <p className="note">Information affichée publiquement.</p>
        </div>

        <div style={{ marginTop: 16 }}>
          <label>Statut</label>
          <select value={data.status || "OUVERTE"} onChange={(e) => set("status", e.target.value)}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </section>

      <div className="actions" style={{ marginTop: 32 }}>
        <a className="btn btn--ghost" href="/sessions">← Annuler</a>
        {isEdit && <button className="btn btn--danger" onClick={del}>Supprimer</button>}
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? "..." : "Sauvegarder"}
        </button>
      </div>
    </>
  );
}
