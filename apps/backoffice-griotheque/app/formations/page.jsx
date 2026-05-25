"use client";
import EntityList from "../components/EntityList";

export default function FormationsPage() {
  return (
    <EntityList
      entityName="formations"
      entityLabel="Formations"
      newHref="/formations/new"
      columns={[
        { key: "title", label: "Titre" },
        { key: "discipline", label: "Discipline" },
        { key: "duration", label: "Durée" },
        { key: "price", label: "Prix", width: 80 },
      ]}
    />
  );
}
