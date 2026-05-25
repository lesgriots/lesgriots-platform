// Création d'une nouvelle formation.
"use client";
import FormationForm from "../../components/FormationForm";

export default function FormationNewPage() {
  return <FormationForm entity="formations" entityLabel="Formation" initial={null} />;
}
