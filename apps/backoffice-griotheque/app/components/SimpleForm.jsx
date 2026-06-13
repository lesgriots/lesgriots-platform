// Formulaire générique pour entités simples (trainers, sessions, resources).
// Reçoit la liste des champs à éditer via `fields` (cf. signatures plus bas).
"use client";
import { useEffect, useState } from "react";
import Type from "./Type";
import FileInput from "./FileInput";

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export default function SimpleForm({
  entity,
  entityLabel,
  fields,
  initial = null,
  // ex: ["trainers"] — autres collections à charger pour faire des dropdowns
  relatedCollections = {},
}) {
  const isEdit = initial !== null;
  const [data, setData] = useState(() => initial || makeBlank(fields));
  const [related, setRelated] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    // Charge les collections liées (ex: trainers pour les sessions)
    Object.entries(relatedCollections).forEach(([key, coll]) => {
      fetch(`/api/${coll}`).then((r) => r.json()).then((arr) => {
        setRelated((r) => ({ ...r, [key]: arr }));
      });
    });
  }, []);

  // Auto-id depuis le 1er champ texte si en création
  const firstTextField = fields.find((f) => f.type === "text" || f.type === "textarea");
  useEffect(() => {
    if (!isEdit && firstTextField && data[firstTextField.key] && !data.id) {
      setData((d) => ({ ...d, id: slugify(d[firstTextField.key]) }));
    }
  }, [firstTextField && data[firstTextField.key]]);

  const set = (key, val) => setData((d) => ({ ...d, [key]: val }));

  async function save() {
    if (!data.id) {
      setMsg("✗ Il faut un id (généré auto depuis le premier champ)");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const url = isEdit ? `/api/${entity}/${data.id}` : `/api/${entity}`;
      const method = isEdit ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setMsg(`✓ Sauvegardé. ${isEdit ? "" : `Redirection...`}`);
      if (!isEdit) {
        setTimeout(() => window.location.href = `/${entity}/${j.id}`, 800);
      }
    } catch (e) {
      setMsg(`✗ ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!isEdit) return;
    if (!confirm(`Supprimer "${data.id}" ?`)) return;
    await fetch(`/api/${entity}/${data.id}`, { method: "DELETE" });
    window.location.href = `/${entity}`;
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>
          <Type
            text={isEdit ? `${entityLabel.toLowerCase()} — ${data.id}` : `nouveau ${entityLabel.toLowerCase()}`}
            speed={28}
            cursor="always"
          />
        </h1>
        <div className="actions" style={{ margin: 0 }}>
          <a className="btn btn--ghost" href={`/${entity}`}>← Liste</a>
          {isEdit && <button className="btn btn--danger" onClick={del}>Supprimer</button>}
          <button className="btn" onClick={save} disabled={saving}>
            {saving ? "..." : "Sauvegarder"}
          </button>
        </div>
      </div>
      {msg && <p className="note" style={{ marginTop: 12 }}>{msg}</p>}

      <section style={{ marginTop: 24 }}>
        <div>
          <label>ID (slug)</label>
          <input
            value={data.id || ""}
            disabled={isEdit}
            onChange={(e) => set("id", e.target.value)}
          />
          {!isEdit && <p className="note">Auto depuis le premier champ texte</p>}
        </div>

        {fields.map((f) => (
          <div key={f.key} style={{ marginTop: 16 }}>
            <label>
              {f.label}
              {f.required && <span style={{ color: "var(--accent)" }}> *</span>}
            </label>
            <FieldRenderer
              field={f}
              value={data[f.key]}
              onChange={(v) => set(f.key, v)}
              related={related}
            />
            {f.hint && <p className="note">{f.hint}</p>}
          </div>
        ))}
      </section>

      <div className="actions" style={{ marginTop: 32 }}>
        <a className="btn btn--ghost" href={`/${entity}`}>← Annuler</a>
        {isEdit && <button className="btn btn--danger" onClick={del}>Supprimer</button>}
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? "..." : "Sauvegarder"}
        </button>
      </div>
    </>
  );
}

function makeBlank(fields) {
  const out = { id: "" };
  for (const f of fields) {
    out[f.key] = f.type === "bool" ? false
      : f.type === "number" ? 0
      : "";
  }
  return out;
}

function FieldRenderer({ field, value, onChange, related }) {
  const v = value === undefined || value === null ? "" : value;
  switch (field.type) {
    case "textarea":
      return <textarea value={v} rows={field.rows || 4} onChange={(e) => onChange(e.target.value)} />;
    case "bool":
      return (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          style={{ width: "auto" }}
        />
      );
    case "select":
      return (
        <select value={v} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Aucun —</option>
          {(field.options || []).map((o) =>
            typeof o === "string"
              ? <option key={o} value={o}>{o}</option>
              : <option key={o.value} value={o.value}>{o.label}</option>
          )}
        </select>
      );
    case "select-from-collection": {
      const items = related[field.from] || [];
      return (
        <select value={v} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Aucun —</option>
          {items.map((it) =>
            <option key={it.id} value={it.id}>
              {it.title || it.name || it.id}
            </option>
          )}
        </select>
      );
    }
    case "file":
      // Upload de fichier (PDF, image…) avec progression + fallback URL.
      // Le `subdir` permet de ranger par type (ex: "ressources" → img/ressources/).
      return (
        <FileInput
          value={v}
          onChange={onChange}
          accept={field.accept}
          subdir={field.subdir}
          placeholder={field.placeholder}
        />
      );
    case "number":
      return <input type="number" value={v} onChange={(e) => onChange(Number(e.target.value))} />;
    case "date":
      // Sélecteur natif HTML5 : ouvre le calendrier du navigateur au clic.
      // Format stocké = ISO "YYYY-MM-DD" (standard, facile à parser).
      // On accepte aussi les anciennes valeurs texte (ex: "MARS 2026") qui
      // ne s'affichent pas dans le picker mais ne sont pas perdues.
      return (
        <input
          type="date"
          value={/^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : ""}
          onChange={(e) => onChange(e.target.value)}
          style={{ fontFamily: "var(--font-mono)" }}
        />
      );
    case "text":
    default:
      return <input value={v} onChange={(e) => onChange(e.target.value)} />;
  }
}
