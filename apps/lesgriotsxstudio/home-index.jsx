/* global React, PROJECTS, useLang, tr */
// Home — INDEX view: terminal-style inline listing of all projects.
// Hover on a row reveals the project cover as full-bleed background
// (the parent <HomeView> wires that up via onHover).

const { useState: useStateI, useEffect: useEffectI } = React;

function pad(str, n) {
  str = String(str ?? "");
  if (str.length >= n) return str.slice(0, n);
  return str + " ".repeat(n - str.length);
}

function HomeIndex({ onOpenProject, onHover }) {
  const lang = useLang();
  const [hovered, setHovered] = useStateI(null);
  useEffectI(() => { onHover && onHover(hovered); }, [hovered]);

  // Derive a project's "services" line from its tags (Chems style)
  const servicesOf = (p) => {
    const t = (p.tags || []).map((x) => x.toUpperCase());
    const out = [];
    if (t.includes("CAMPAIGN") || t.includes("LOOKBOOK")) out.push(tr("filt.campaign", lang));
    if (t.includes("EDITORIAL") || t.includes("PHOTOGRAPHY")) out.push(tr("filt.editorial", lang));
    if (t.includes("MUSIC VIDEO")) out.push(tr("filt.music", lang));
    if (t.includes("FILM") || t.includes("SHORT FILM") || t.includes("DOCUMENTARY")) out.push(tr("filt.film", lang));
    // Aucune correspondance ? On montre les mots-cles du projet plutot qu'un
    // tiret : mieux vaut l'information brute que rien.
    if (!out.length && t.length) return t.slice(0, 2).join(" · ");
    return out.length ? out.join(" · ") : "—";
  };

  // La date est du texte libre (« 2020 », « 2025 — PRESENT », « — ») : on
  // l'affiche telle quelle. L'ancien decoupage mois/annee fabriquait des
  // valeurs fausses du type « 20.SENT ».
  const dateLisible = (p) => {
    const d = String(p.date || "").trim();
    return d ? d.toUpperCase() : "—";
  };

  const total = PROJECTS.length;
  const cmd = lang === "fr" ? "projets" : "projects";

  return (
    <div className="idx-term" role="region" aria-label="Projects index">
      <div className="idx-term__inner">
        <div className="idx-term__line idx-term__cmd">
          <span className="prompt">&gt;</span> {cmd} <span className="idx-term__meta">— {String(total).padStart(2, "0")}</span>
        </div>
        <div className="idx-term__line idx-term__spacer">&nbsp;</div>

        <ol className="idx-term__rows">
          {/* En-tete : nomme les colonnes, sans cliquer ni survoler. */}
          <li className="idx-term__row idx-term__row--head" aria-hidden="true">
            <span className="c-num">№</span>
            <span className="c-name">{lang === "fr" ? "Projet" : "Project"}</span>
            <span className="c-svc">{lang === "fr" ? "Nature" : "Scope"}</span>
            <span className="c-meta">{lang === "fr" ? "Client · Date" : "Client · Date"}</span>
          </li>

          {PROJECTS.map((p, i) => {
            return (
              <li
                key={p.id}
                className={"idx-term__row" + (hovered === i ? " is-active" : "")}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onOpenProject(p.id)}
              >
                <span className="c-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="c-name">{p.name}</span>
                <span className="c-svc">{servicesOf(p)}</span>
                <span className="c-meta">{[p.client, dateLisible(p)].filter(Boolean).join(" · ")}</span>
              </li>
            );
          })}
        </ol>

        <div className="idx-term__line idx-term__spacer">&nbsp;</div>
        <div className="idx-term__line idx-term__cmd">
          <span className="prompt">&gt;</span> <span className="blink">█</span>
        </div>
      </div>

    </div>
  );
}

window.HomeIndex = HomeIndex;
