"use client";
import { useEffect, useState } from "react";
import SimpleForm from "../../components/SimpleForm";

const TRAINER_FIELDS = [
  { key: "name", label: "Nom (en MAJUSCULES)", type: "text", required: true },
  { key: "role", label: "Rôle / titre", type: "text" },
  { key: "bio", label: "Bio (paragraphe)", type: "textarea", rows: 5 },
  { key: "photo", label: "Photo (chemin ou URL)", type: "text", hint: 'ex: "img/trainer-moos.jpg"' },
];

export default function TrainerEditPage({ params }) {
  const [initial, setInitial] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/trainers/${params.id}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("Introuvable")))
      .then(setInitial)
      .catch((e) => setErr(e.message));
  }, [params.id]);

  if (err) return <div className="empty" style={{ color: "var(--danger)" }}>✗ {err}</div>;
  if (!initial) return <div className="empty">Chargement…</div>;

  return <SimpleForm entity="trainers" entityLabel="Intervenant" fields={TRAINER_FIELDS} initial={initial} />;
}
