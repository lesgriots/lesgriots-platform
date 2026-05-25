"use client";
import { useEffect, useState } from "react";
import SimpleForm from "../../components/SimpleForm";

const RESOURCE_FIELDS = [
  { key: "title", label: "Titre", type: "text", required: true },
  { key: "type", label: "Type", type: "select",
    options: ["guide", "article", "template", "outil"] },
  { key: "format", label: "Format", type: "text",
    hint: 'ex: "PDF · 12 PAGES" ou "LECTURE · 6 MIN"' },
  { key: "href", label: "Lien (URL ou chemin)", type: "text",
    hint: 'ex: "#" tant que pas dispo, sinon URL' },
  { key: "available", label: "Disponible maintenant ?", type: "bool" },
];

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
