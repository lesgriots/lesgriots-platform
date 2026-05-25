"use client";
import SimpleForm from "../../components/SimpleForm";

const TRAINER_FIELDS = [
  { key: "name", label: "Nom (en MAJUSCULES)", type: "text", required: true },
  { key: "role", label: "Rôle / titre", type: "text" },
  { key: "bio", label: "Bio (paragraphe)", type: "textarea", rows: 5 },
  { key: "photo", label: "Photo (chemin ou URL)", type: "text", hint: 'ex: "img/trainer-moos.jpg"' },
];

export default function TrainerNewPage() {
  return <SimpleForm entity="trainers" entityLabel="Intervenant" fields={TRAINER_FIELDS} initial={null} />;
}
