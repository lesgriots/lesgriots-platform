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
    return out.length ? out.join(" · ") : "—";
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
          {PROJECTS.map((p, i) => {
            const year = (p.date || "").slice(-4);
            const month = (p.date || "").slice(0, 2) || "--";
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
                <span className="c-client">{p.client || "—"}</span>
                <span className="c-date">{month}.{year}</span>
                <span className="c-svc">{servicesOf(p)}</span>
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
