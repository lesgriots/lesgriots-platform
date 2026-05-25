"use client";
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

export default function ResourceNewPage() {
  return <SimpleForm entity="resources" entityLabel="Ressource" fields={RESOURCE_FIELDS} initial={null} />;
}
