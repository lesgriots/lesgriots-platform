// Tableau de bord du BO LES GRIOTS (site ombrelle).
// Server component : lit directement le store lesgriots.json et affiche
// un résumé des 4 sections éditables + accès rapide. Le Sync est dans la nav.
import { getHomeVideo, listProjects, getAbout, listShop, getMode } from "../lib/db.js";

export const dynamic = "force-dynamic"; // toujours relire le store à chaud

function Card({ href, title, value, note }) {
  return (
    <a
      href={href}
      className="projcard"
      style={{ display: "block", padding: "18px 20px", cursor: "pointer" }}
    >
      <div className="bo-navgroup__title" style={{ border: "none", padding: 0, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 30, fontWeight: 500, color: "var(--yellow)", lineHeight: 1.1 }}>
        {value}
      </div>
      <div className="note" style={{ marginTop: 6 }}>{note}</div>
    </a>
  );
}

export default function Dashboard() {
  const home = getHomeVideo();
  const projects = listProjects();
  const about = getAbout();
  const shop = listShop();

  const hasHome = !!(home && home.src);
  const visibleProjects = projects.filter((p) => !p.hidden).length;
  const mode = getMode();

  return (
    <>
      <h1>tableau de bord — les griots</h1>
      <p className="note" style={{ marginTop: -8, marginBottom: 18 }}>
        Site ombrelle <code>apps/lesgriots</code>. Édite chaque section puis clique
        <strong> ↑ Sync vers le site</strong> (menu) pour publier.
      </p>

      <div
        className="projlib"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
      >
        <Card
          href="/site-mode"
          title="Mode du site"
          value={mode === "live" ? "En ligne" : "Attente"}
          note={mode === "live" ? "Site complet publié" : "Page coming-soon publiée"}
        />
        <Card
          href="/home-video"
          title="Vidéo d'accueil"
          value={hasHome ? "✓" : "—"}
          note={hasHome ? home.src : "Aucune vidéo définie"}
        />
        <Card
          href="/projects"
          title="Projets (stage)"
          value={`${visibleProjects} / ${projects.length}`}
          note={`${visibleProjects} visibles sur ${projects.length}`}
        />
        <Card
          href="/about"
          title="About + liens"
          value={(about.links || []).length}
          note={about.text ? "Texte défini" : "Texte à écrire"}
        />
        <Card
          href="/shop"
          title="Boutique"
          value={shop.length}
          note={shop.length ? `${shop.length} article(s)` : "Aucun article"}
        />
      </div>

      <h2>Prochaines étapes</h2>
      <p className="note">
        Milestone 1 (fait) : structure du BO + store <code>lesgriots.json</code>.
        Milestone 2 : l'exporter qui écrit <code>data.jsx</code> et hydrate le site.
        Milestone 3 : les formulaires d'édition de chaque section.
      </p>
    </>
  );
}
