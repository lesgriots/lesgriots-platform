"use client";
import EntityList from "../components/EntityList";

export default function TrainersPage() {
  return (
    <EntityList
      entityName="trainers"
      entityLabel="Intervenants"
      newHref="/trainers/new"
      columns={[
        { key: "name", label: "Nom" },
        { key: "role", label: "Rôle" },
      ]}
    />
  );
}
