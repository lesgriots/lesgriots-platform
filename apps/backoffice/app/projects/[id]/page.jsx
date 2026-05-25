// Page d'édition d'un projet existant.
"use client";
import { useEffect, useState } from "react";
import ProjectForm from "../../components/ProjectForm";
import Type from "../../components/Type";

export default function EditProjectPage({ params }) {
  const [project, setProject] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/projects/${params.id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`projet introuvable (${r.status})`);
        return r.json();
      })
      .then(setProject)
      .catch((e) => setErr(e.message));
  }, [params.id]);

  if (err) return (
    <>
      <h1>Erreur</h1>
      <p className="note" style={{ color: "var(--danger)" }}>{err}</p>
      <p><a href="/" className="btn btn--ghost">← Retour</a></p>
    </>
  );

  if (!project) return <p className="note">Chargement…</p>;

  return (
    <>
      <h1><Type text={`edit · ${project.name.toLowerCase()}`} speed={26} cursor="always" /></h1>
      <p className="note" style={{ marginBottom: 18 }}>
        ID : <code>{project.id}</code> &middot; Mis à jour le {project.updated_at}
      </p>
      <ProjectForm initial={project} isNew={false} />
    </>
  );
}
