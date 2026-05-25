"use client";
import EntityList from "../components/EntityList";

export default function ResourcesPage() {
  return (
    <EntityList
      entityName="resources"
      entityLabel="Ressources"
      newHref="/resources/new"
      columns={[
        { key: "title", label: "Titre" },
        { key: "type", label: "Type", width: 120 },
        { key: "format", label: "Format", width: 160 },
        { key: "available", label: "Dispo ?", width: 80, render: (r) => r.available ? "✓" : "—" },
      ]}
    />
  );
}
