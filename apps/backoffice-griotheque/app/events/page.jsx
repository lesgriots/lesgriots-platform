"use client";
import EntityList from "../components/EntityList";

export default function EventsPage() {
  return (
    <EntityList
      entityName="events"
      entityLabel="Événements"
      newHref="/events/new"
      columns={[
        { key: "title", label: "Titre" },
        { key: "kind", label: "Type", width: 120 },
        { key: "date", label: "Date", width: 120 },
        { key: "city", label: "Ville", width: 120 },
        { key: "status", label: "Statut", width: 100 },
      ]}
    />
  );
}
