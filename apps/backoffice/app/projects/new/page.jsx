// Page de création d'un projet.
"use client";
import ProjectForm from "../../components/ProjectForm";
import Type from "../../components/Type";

export default function NewProjectPage() {
  return (
    <>
      <h1><Type text="nouveau projet" speed={28} cursor="always" /></h1>
      <p className="note" style={{ marginBottom: 18 }}>
        L'<strong>ID</strong> est le slug utilisé dans l'URL et en clé primaire. Il n'est plus modifiable après création.
      </p>
      <ProjectForm initial={null} isNew={true} />
    </>
  );
}
