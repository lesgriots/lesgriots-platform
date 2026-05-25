"use client";
import EntityList from "../components/EntityList";

export default function SessionsPage() {
  return (
    <EntityList
      entityName="sessions"
      entityLabel="Sessions"
      newHref="/sessions/new"
      columns={[
        { key: "date", label: "Date", width: 120 },
        { key: "formation_id", label: "Formation" },
        { key: "workshop_id", label: "Workshop" },
        { key: "places", label: "Places", width: 80 },
        { key: "status", label: "Statut", width: 100 },
      ]}
    />
  );
}
