// Formulaire d'édition d'une formation (ou d'un workshop, même schéma).
// Utilisé par /formations/new + /formations/[id] (et workshops/* via prop entity).
//
// Sections collapsables pour rester gérable malgré les ~18 champs.
// Sauvegarde via POST /api/formations (ou PUT /api/formations/[id] si edit).
"use client";
import { useEffect, useState } from "react";
import Type from "./Type";
import MediaInput from "./MediaInput";

// Slugify pour générer un id à partir du titre
function slugify(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

const DEFAULT_AWARE = ["methods", "evaluation", "accessibility", "location"];

export default function FormationForm({
  entity = "formations",   // "formations" ou "workshops"
  entityLabel = "Formation",
  initial = null,           // null = mode création
}) {
  const isWorkshop = entity === "workshops";
  const isEdit = initial !== null;
  const [data, setData] = useState(() => initial || newBlank(isWorkshop));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [defaults, setDefaults] = useState({});
  const [trainers, setTrainers] = useState([]);

  // Charge les textes par défaut + la liste des intervenants
  useEffect(() => {
    fetch("/api/defaults").then((r) => r.json()).then(setDefaults);
    fetch("/api/trainers").then((r) => r.json()).then(setTrainers);
  }, []);

  function newBlank(isWorkshop) {
    const base = {
      id: "",
      title: "",
      tagline: "",
      discipline: "",
      duration: "",
      format: "",
      price: "",
      cpf: false,
      opco: false,
      trainer: { name: "", role: "" },
      media: { type: "image", src: "", credit: "" },
      description: "",
      audience: "",
      prerequisites: "",
      objectives: [],
      chapters: [],
      methods: null,
      evaluation: null,
      accessibility: null,
      location: null,
    };
    if (isWorkshop) {
      // Workshops : pas d'overview ni de program, mais 2 champs dédiés
      return { ...base, available: false, next: "—" };
    }
    // Formations : overview (3 blocs) + program (jour par jour)
    return { ...base, overview: [["", ""], ["", ""], ["", ""]], program: [] };
  }

  // Update un champ simple (string, bool, number)
  const set = (key, val) => setData((d) => ({ ...d, [key]: val }));
  // Update un champ nested (trainer.name, media.src, etc.)
  const setNested = (key, sub, val) =>
    setData((d) => ({ ...d, [key]: { ...d[key], [sub]: val } }));

  // Auto-génère l'id depuis le titre si on est en création et que l'id est vide
  useEffect(() => {
    if (!isEdit && data.title && !data.id) {
      set("id", slugify(data.title));
    }
  }, [data.title]);

  async function save() {
    if (!data.id) {
      setMsg("✗ Il faut un id (généré auto depuis le titre)");
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
    if (!confirm(`Supprimer "${data.title}" ?`)) return;
    await fetch(`/api/${entity}/${data.id}`, { method: "DELETE" });
    window.location.href = `/${entity}`;
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>
          <Type
            text={isEdit ? `${entityLabel.toLowerCase()} — ${data.title || data.id}` : `nouvelle ${entityLabel.toLowerCase()}`}
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

      <p className="note" style={{ marginTop: 18, marginBottom: 24 }}>
        Édite les champs ci-dessous puis clique Sauvegarder. Pense ensuite à
        cliquer "↳ Exporter" depuis l'accueil pour pousser vers le site.
      </p>

      {/* ========== IDENTITÉ ========== */}
      <Section title="Identité">
        <Row>
          <Field label="Titre" required>
            <input value={data.title || ""} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="ID (slug, ne pas changer après création)" hint="Auto depuis le titre">
            <input value={data.id || ""} onChange={(e) => set("id", e.target.value)} disabled={isEdit} />
          </Field>
        </Row>
        <Field label="Tagline (1 phrase choc)">
          <textarea value={data.tagline || ""} onChange={(e) => set("tagline", e.target.value)} rows={2} />
        </Field>
        <Field label="Discipline (ex: STRATÉGIE · MARQUE)">
          <input value={data.discipline || ""} onChange={(e) => set("discipline", e.target.value)} />
        </Field>
      </Section>

      {/* ========== PRATIQUE ========== */}
      <Section title="Pratique">
        <Row>
          <Field label="Durée" hint='ex: "7H · 1 JOURNÉE"'>
            <input value={data.duration || ""} onChange={(e) => set("duration", e.target.value)} />
          </Field>
          <Field label="Format" hint='ex: "PRÉSENTIEL · PARIS / EN LIGNE"'>
            <input value={data.format || ""} onChange={(e) => set("format", e.target.value)} />
          </Field>
        </Row>
        <Row>
          <Field label="Prix" hint='ex: "300 €"'>
            <input value={data.price || ""} onChange={(e) => set("price", e.target.value)} />
          </Field>
          <Field label="Financements">
            <div style={{ display: "flex", gap: 18, alignItems: "center", paddingTop: 8 }}>
              <label style={{ display: "inline-flex", gap: 6, margin: 0, fontSize: 12, textTransform: "none", letterSpacing: 0 }}>
                <input type="checkbox" checked={!!data.cpf} onChange={(e) => set("cpf", e.target.checked)} style={{ width: "auto" }} />
                CPF
              </label>
              <label style={{ display: "inline-flex", gap: 6, margin: 0, fontSize: 12, textTransform: "none", letterSpacing: 0 }}>
                <input type="checkbox" checked={!!data.opco} onChange={(e) => set("opco", e.target.checked)} style={{ width: "auto" }} />
                OPCO
              </label>
            </div>
          </Field>
        </Row>
        <DefaultAwareField
          label="Lieu"
          field="location"
          value={data.location}
          defaultValue={defaults.location}
          onChange={(v) => set("location", v)}
        />
      </Section>

      {/* ========== MÉDIA (image ou vidéo en haut de page) ========== */}
      <Section title="Média (image ou vidéo en haut de page)">
        <MediaInput
          value={data.media}
          onChange={(media) => set("media", media)}
        />
      </Section>

      {/* ========== INTERVENANT ========== */}
      <Section title="Intervenant principal">
        <Field
          label="Choisir dans la liste"
          hint={
            <>
              Pour ajouter ou modifier un intervenant, va sur <a href="/trainers">/trainers</a>.
              Tu peux aussi taper un intervenant ponctuel directement ci-dessous (utilisé seulement
              si aucun intervenant de la liste n'est sélectionné).
            </>
          }
        >
          <select
            value={data.trainer_id || ""}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) {
                set("trainer_id", "");
                return;
              }
              const t = trainers.find((x) => x.id === id);
              setData((d) => ({
                ...d,
                trainer_id: id,
                // On copie aussi name/role dans trainer{} pour rétrocompat,
                // mais le trainer_id reste la source de vérité.
                trainer: t ? { name: t.name || "", role: t.role || "" } : d.trainer,
              }));
            }}
          >
            <option value="">— Aucun (utilise les champs custom ci-dessous) —</option>
            {trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.role ? `· ${t.role}` : ""}
              </option>
            ))}
          </select>
        </Field>

        {!data.trainer_id && (
          <Row>
            <Field label="Nom (custom, sans intervenant lié)">
              <input value={data.trainer?.name || ""} onChange={(e) => setNested("trainer", "name", e.target.value)} />
            </Field>
            <Field label="Rôle">
              <input value={data.trainer?.role || ""} onChange={(e) => setNested("trainer", "role", e.target.value)} />
            </Field>
          </Row>
        )}
        {data.trainer_id && (
          <p className="note" style={{ marginTop: 10 }}>
            → Intervenant lié : <strong>{data.trainer?.name || "?"}</strong>
            {data.trainer?.role ? ` · ${data.trainer.role}` : ""}
          </p>
        )}
      </Section>

      {/* ========== PÉDAGOGIE ========== */}
      <Section title="Pédagogie">
        <Field label="Description (paragraphe long)">
          <textarea value={data.description || ""} onChange={(e) => set("description", e.target.value)} rows={5} />
        </Field>
        <Field label="Public visé">
          <textarea value={data.audience || ""} onChange={(e) => set("audience", e.target.value)} rows={3} />
        </Field>
        <Field label="Prérequis">
          <textarea value={data.prerequisites || ""} onChange={(e) => set("prerequisites", e.target.value)} rows={3} />
        </Field>
        <ListEditor
          label="Objectifs pédagogiques"
          items={data.objectives || []}
          onChange={(arr) => set("objectives", arr)}
          placeholder="Distinguer identité, positionnement et récit"
        />
        <ListEditor
          label="Chapitres"
          items={data.chapters || []}
          onChange={(arr) => set("chapters", arr)}
          placeholder="Identité — territoire, valeurs, promesse"
        />
      </Section>

      {/* ========== OVERVIEW (formations uniquement) ========== */}
      {!isWorkshop && (
        <Section title="Overview (intro narrative — 3 blocs titre + paragraphe)">
          {(data.overview || []).map((block, i) => (
            <div key={i} style={{ marginBottom: 20, borderLeft: "2px solid var(--rule)", paddingLeft: 14 }}>
              <Field label={`Bloc ${i + 1} — titre`}>
                <input
                  value={block[0] || ""}
                  onChange={(e) => {
                    const next = [...data.overview];
                    next[i] = [e.target.value, next[i][1] || ""];
                    set("overview", next);
                  }}
                />
              </Field>
              <Field label={`Bloc ${i + 1} — paragraphe`}>
                <textarea
                  value={block[1] || ""}
                  rows={4}
                  onChange={(e) => {
                    const next = [...data.overview];
                    next[i] = [next[i][0] || "", e.target.value];
                    set("overview", next);
                  }}
                />
              </Field>
            </div>
          ))}
        </Section>
      )}

      {/* ========== PROGRAMME (formations uniquement) ========== */}
      {!isWorkshop && (
        <Section title="Programme (jour par jour)">
          <p className="note" style={{ marginBottom: 14 }}>
            Pour chaque jour, liste les sessions/modules. Champ JSON brut pour
            l'instant — on fera une UI plus fluide plus tard.
          </p>
          <textarea
            value={JSON.stringify(data.program || [], null, 2)}
            rows={12}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                set("program", parsed);
                setMsg("");
              } catch {
                setMsg("⚠ JSON invalide pour 'program', non sauvegardé");
              }
            }}
          />
        </Section>
      )}

      {/* ========== DISPONIBILITÉ (workshops uniquement) ========== */}
      {isWorkshop && (
        <Section title="Disponibilité (workshop)">
          <Row>
            <Field label="Ouvert aux inscriptions ?">
              <div style={{ paddingTop: 8 }}>
                <label style={{ display: "inline-flex", gap: 8, alignItems: "center", margin: 0, fontSize: 12, textTransform: "none", letterSpacing: 0 }}>
                  <input
                    type="checkbox"
                    checked={!!data.available}
                    onChange={(e) => set("available", e.target.checked)}
                    style={{ width: "auto" }}
                  />
                  Inscriptions ouvertes
                </label>
              </div>
            </Field>
            <Field label="Prochaine session" hint='ex: "MARS 2026" ou "—" si pas encore programmé'>
              <input value={data.next || ""} onChange={(e) => set("next", e.target.value)} />
            </Field>
          </Row>
        </Section>
      )}

      {/* ========== TEXTES MUTUALISÉS (overrides) ========== */}
      <Section title="Textes mutualisés (overrides)">
        <p className="note" style={{ marginBottom: 14 }}>
          Si tu laisses la case "Utiliser le texte par défaut" cochée, le texte
          de la page <a href="/defaults">Textes par défaut</a> sera utilisé.
          Décoche pour personnaliser pour cette formation.
        </p>
        {DEFAULT_AWARE.filter((f) => f !== "location").map((field) => (
          <DefaultAwareField
            key={field}
            label={field === "methods" ? "Méthodes pédagogiques"
              : field === "evaluation" ? "Modalités d'évaluation"
              : "Accessibilité"}
            field={field}
            value={data[field]}
            defaultValue={defaults[field]}
            onChange={(v) => set(field, v)}
          />
        ))}
      </Section>

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

// ===== Sous-composants ==========================================

function Section({ title, children }) {
  return (
    <section style={{ marginTop: 32 }}>
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function Row({ children }) {
  return <div className="row">{children}</div>;
}

function Field({ label, hint, required, children }) {
  return (
    <div>
      <label>
        {label}
        {required && <span style={{ color: "var(--accent)" }}> *</span>}
      </label>
      {children}
      {hint && <p className="note">{hint}</p>}
    </div>
  );
}

// Champ qui peut être "défaut" (= null, utilise DEFAULT_X) ou "custom" (string)
function DefaultAwareField({ label, field, value, defaultValue, onChange }) {
  const isDefault = value === null || value === undefined;
  return (
    <Field label={label}>
      <label style={{ display: "inline-flex", gap: 6, alignItems: "center", marginBottom: 6, fontSize: 11, textTransform: "none", letterSpacing: 0 }}>
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => onChange(e.target.checked ? null : (defaultValue || ""))}
          style={{ width: "auto" }}
        />
        Utiliser le texte par défaut
      </label>
      {!isDefault && (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
        />
      )}
      {isDefault && defaultValue && (
        <p className="note" style={{ fontStyle: "italic", opacity: 0.7 }}>
          → {defaultValue.slice(0, 200)}{defaultValue.length > 200 ? "…" : ""}
        </p>
      )}
    </Field>
  );
}

// Édition d'une liste de strings (objectifs, chapitres, etc.)
function ListEditor({ label, items, onChange, placeholder }) {
  function add() { onChange([...items, ""]); }
  function update(i, v) {
    const next = [...items];
    next[i] = v;
    onChange(next);
  }
  function remove(i) { onChange(items.filter((_, j) => j !== i)); }

  return (
    <Field label={label}>
      {items.length === 0 && (
        <p className="note" style={{ fontStyle: "italic" }}>Aucun item — ajoute le premier ci-dessous.</p>
      )}
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
          <input
            value={it || ""}
            placeholder={placeholder}
            onChange={(e) => update(i, e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn--danger"
            style={{ padding: "4px 10px", fontSize: 11 }}
            onClick={() => remove(i)}
          >×</button>
        </div>
      ))}
      <button
        className="btn btn--ghost"
        style={{ marginTop: 6 }}
        onClick={add}
      >+ Ajouter</button>
    </Field>
  );
}
