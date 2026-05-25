// Page d'accueil du backoffice Griothèque.
// Vue d'ensemble : 6 cards (les 5 entités + le bloc Textes mutualisés)
// avec le nombre d'entrées et un lien vers chaque liste.
"use client";
import { useEffect, useState } from "react";
import Type from "./components/Type";
import ExportButton from "./components/ExportButton";

const SECTIONS = [
  { key: "formations", title: "FORMATIONS", desc: "Formations longues, 1-3 jours" },
  { key: "workshops", title: "WORKSHOPS", desc: "Formats courts, sessions thématiques" },
  { key: "trainers", title: "INTERVENANTS", desc: "Profils des formateurs" },
  { key: "sessions", title: "SESSIONS", desc: "Dates concrètes, places dispo" },
  { key: "resources", title: "RESSOURCES", desc: "Guides, articles, outils téléchargeables" },
  { key: "leads", title: "LEADS", desc: "Emails capturés via téléchargement de ressource" },
  { key: "defaults", title: "TEXTES PAR DÉFAUT", desc: "Méthodes, évaluation, accessibilité, lieu" },
  { key: "pages", title: "PAGES ACTIVES", desc: "Activer/désactiver chaque page du site" },
];

export default function HomePage() {
  const [counts, setCounts] = useState({});

  useEffect(() => {
    // Charge les compteurs de chaque collection en parallèle.
    // defaults et pages renvoient un objet (pas un array) → on compte les clés.
    Promise.all(
      SECTIONS.filter((s) => s.key !== "defaults" && s.key !== "pages").map((s) =>
        fetch(`/api/${s.key}`)
          .then((r) => (r.ok ? r.json() : []))
          .then((arr) => [s.key, Array.isArray(arr) ? arr.length : 0])
          .catch(() => [s.key, 0])
      )
    ).then((entries) => setCounts(Object.fromEntries(entries)));

    // Pages actives : compte combien sont ON
    fetch("/api/pages").then((r) => r.json()).then((obj) => {
      const active = Object.values(obj || {}).filter(Boolean).length;
      const total = Object.keys(obj || {}).length;
      setCounts((c) => ({ ...c, pages: `${active}/${total}` }));
    }).catch(() => {});
  }, []);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>
          <Type text="griothèque — back office" speed={28} cursor="always" />
        </h1>
        <ExportButton variant="btn" />
      </div>

      <p className="note" style={{ marginTop: 18 }}>
        Le back office de La Griothèque permet d'éditer les contenus du site
        <code>lagriotheque.com</code> : formations, workshops, intervenants,
        sessions, ressources, et les textes mutualisés. Les modifs sont
        sauvegardées dans <code>griotheque.json</code>. Cliquer "Exporter"
        régénère <code>apps/lagriotheque/data.jsx</code>.
      </p>

      <div className="cards-grid">
        {SECTIONS.map((s) => (
          <a key={s.key} href={`/${s.key}`} className="card">
            <div className="card__title">{s.title}</div>
            <div className="card__desc">{s.desc}</div>
            <div className="card__count">
              {s.key === "defaults"
                ? "4 textes"
                : s.key === "pages"
                ? (counts.pages ? `${counts.pages} actives` : "…")
                : counts[s.key] !== undefined
                ? `${counts[s.key]} entrée${counts[s.key] > 1 ? "s" : ""}`
                : "…"}
            </div>
          </a>
        ))}
      </div>

      <style jsx>{`
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 0;
          margin-top: 40px;
          border-top: 1px solid var(--ink);
          border-left: 1px solid var(--ink);
        }
        .card {
          display: block;
          padding: 28px 22px;
          border-right: 1px solid var(--ink);
          border-bottom: 1px solid var(--ink);
          background: var(--paper);
          color: var(--ink);
          text-decoration: none;
          transition: background 0.15s;
          min-height: 180px;
          display: flex;
          flex-direction: column;
        }
        .card:hover {
          background: var(--accent);
          text-decoration: none;
        }
        .card__title {
          font-family: var(--font-mono);
          font-size: 12px;
          letter-spacing: 0.16em;
          font-weight: 600;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        .card__desc {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--ink-dim);
          line-height: 1.6;
          margin-bottom: 22px;
          flex: 1;
        }
        .card:hover .card__desc { color: var(--ink); }
        .card__count {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--ink);
          letter-spacing: 0.14em;
          text-transform: uppercase;
          padding-top: 14px;
          border-top: 1px solid var(--rule);
          font-weight: 500;
        }
        .card:hover .card__count { border-top-color: var(--ink); }
      `}</style>
    </>
  );
}
