"use client";
import EntityList from "../components/EntityList";

export default function WorkshopsPage() {
  return (
    <EntityList
      entityName="workshops"
      entityLabel="Workshops"
      newHref="/workshops/new"
      columns={[
        { key: "title", label: "Titre" },
        { key: "discipline", label: "Discipline" },
        { key: "duration", label: "Durée" },
        { key: "price", label: "Prix", width: 80 },
      ]}
    />
  );
}
