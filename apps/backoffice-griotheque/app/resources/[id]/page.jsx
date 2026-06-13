"use client";
import { useEffect, useState } from "react";
import SimpleForm from "../../components/SimpleForm";
import { RESOURCE_FIELDS } from "../fields";

export default function ResourceEditPage({ params }) {
  const [initial, setInitial] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/resources/${params.id}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("Introuvable")))
      .then(setInitial)
      .catch((e) => setErr(e.message));
  }, [params.id]);

  if (err) return <div className="empty" style={{ color: "var(--danger)" }}>✗ {err}</div>;
  if (!initial) return <div className="empty">Chargement…</div>;

  return <SimpleForm entity="resources" entityLabel="Ressource" fields={RESOURCE_FIELDS} initial={initial} />;
}
