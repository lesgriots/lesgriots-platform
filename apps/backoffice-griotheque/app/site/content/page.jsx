// Page d'édition de TOUS les textes marketing du site lagriotheque.
//
// Phase 1 — sections couvertes :
//   - home (hero + manifesto)
//   - approche (3 piliers)
//   - catalogue, workshops_page, ressources, agenda (intros)
//   - faq (4 questions génériques)
//
// UI : accordéon par section. Chaque section a son bouton Sauvegarder
// individuel pour éviter de tout écrire d'un coup (et de tout perdre si
// le réseau lâche en plein milieu).
"use client";
import { useEffect, useState } from "react";
import Type from "../../components/Type";

export default function ContentPage() {
  const [data, setData] = useState(null); // { content, sections }
  const [openSection, setOpenSection] = useState(null);
  const [savingKey, setSavingKey] = useState(null); // section key en cours de sauvegarde
  const [msg, setMsg] = useState({}); // par section : "✓ ..." ou "✗ ..."

  // Charge tout au mount
  useEffect(() => {
    fetch("/api/content")
      .then((r) => r.json())
      .then((j) => {
        setData(j);
        // Ouvre la première section par défaut pour qu'on voie quelque chose
        if (j.sections && j.sections.length) {
          setOpenSection(j.sections[0].key);
        }
      });
  }, []);

  function updateField(sectionKey, fieldKey, value) {
    setData((cur) => {
      if (!cur) return cur;
      return {
        ...cur,
        content: {
          ...cur.content,
          [sectionKey]: {
            ...(cur.content[sectionKey] || {}),
            [fieldKey]: value,
          },
        },
      };
    });
  }

  async function saveSection(sectionKey) {
    if (!data) return;
    setSavingKey(sectionKey);
    setMsg((m) => ({ ...m, [sectionKey]: "" }));
    try {
      const payload = { [sectionKey]: data.content[sectionKey] };
      const r = await fetch("/api/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setMsg((m) => ({
        ...m,
        [sectionKey]: "✓ Sauvegardé. Clique « Exporter » en haut pour pousser sur le site.",
      }));
    } catch (e) {
      setMsg((m) => ({ ...m, [sectionKey]: `✗ ${e.message}` }));
    } finally {
      setSavingKey(null);
    }
  }

  if (!data) return <div className="empty">Chargement…</div>;

  const { content, sections } = data;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1><Type text="contenu du site" speed={28} cursor="always" /></h1>
        <div className="actions" style={{ margin: 0 }}>
          <a className="btn btn--ghost" href="/">← Accueil</a>
        </div>
      </div>

      <p className="note" style={{ marginTop: 12, marginBottom: 28 }}>
        Édite les textes marketing affichés sur <code>lagriotheque.com</code> —
        manifeste home, approche, headers de page, FAQ générique. Les sections
        sont indépendantes : chaque sauvegarde n'affecte que sa section.
        N'oublie pas d'« Exporter » depuis l'accueil pour pousser les
        changements sur le site.
      </p>

      <div className="sections">
        {sections.map((section) => {
          const isOpen = openSection === section.key;
          const sectionContent = content[section.key] || {};
          const isSaving = savingKey === section.key;
          return (
            <div key={section.key} className={"section" + (isOpen ? " is-open" : "")}>
              <button
                type="button"
                className="section__head"
                onClick={() => setOpenSection(isOpen ? null : section.key)}
              >
                <span className="section__title">{section.title}</span>
                <span className="section__desc">{section.desc}</span>
                <span className="section__chev">{isOpen ? "−" : "+"}</span>
              </button>

              {isOpen && (
                <div className="section__body">
                  {section.fields.map((f) => (
                    <div key={f.key} className="field">
                      <label>{f.label}</label>
                      {f.type === "textarea" ? (
                        <textarea
                          rows={f.rows || 4}
                          value={sectionContent[f.key] || ""}
                          onChange={(e) => updateField(section.key, f.key, e.target.value)}
                        />
                      ) : (
                        <input
                          type="text"
                          value={sectionContent[f.key] || ""}
                          onChange={(e) => updateField(section.key, f.key, e.target.value)}
                        />
                      )}
                    </div>
                  ))}

                  <div className="section__actions">
                    <button
                      className="btn"
                      onClick={() => saveSection(section.key)}
                      disabled={isSaving}
                    >
                      {isSaving ? "..." : "Sauvegarder " + section.title}
                    </button>
                    {msg[section.key] && (
                      <span className="section__msg">{msg[section.key]}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .sections {
          display: flex;
          flex-direction: column;
          border-top: 1px solid var(--ink);
        }
        .section {
          border-bottom: 1px solid var(--ink);
        }
        .section__head {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 2fr auto;
          gap: 20px;
          align-items: center;
          padding: 20px 4px;
          background: transparent;
          border: 0;
          cursor: pointer;
          text-align: left;
          color: var(--ink);
          font-family: var(--font-mono);
        }
        .section__head:hover {
          background: var(--accent);
        }
        .section__title {
          font-size: 14px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-weight: 600;
        }
        .section__desc {
          font-size: 12px;
          color: var(--ink-dim);
          line-height: 1.5;
        }
        .section.is-open .section__desc,
        .section__head:hover .section__desc {
          color: var(--ink);
        }
        .section__chev {
          font-family: var(--font-mono);
          font-size: 18px;
          font-weight: 500;
        }
        .section__body {
          padding: 12px 4px 32px;
        }
        .field {
          margin-top: 20px;
        }
        .field label {
          display: block;
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ink);
          margin-bottom: 6px;
        }
        .field input,
        .field textarea {
          width: 100%;
          font-family: var(--font-sans);
          font-size: 15px;
          padding: 10px 12px;
          border: 1px solid var(--ink);
          background: var(--paper);
          color: var(--ink);
          border-radius: 0;
        }
        .field textarea {
          line-height: 1.55;
          resize: vertical;
        }
        .section__actions {
          margin-top: 28px;
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }
        .section__msg {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--ink-dim);
        }
      `}</style>
    </>
  );
}
