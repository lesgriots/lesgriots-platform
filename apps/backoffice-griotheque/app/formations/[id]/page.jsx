// Édition d'une formation existante.
"use client";
import { useEffect, useState } from "react";
import FormationForm from "../../components/FormationForm";

export default function FormationEditPage({ params }) {
  const [initial, setInitial] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/formations/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Formation introuvable" : "Erreur réseau");
        return r.json();
      })
      .then(setInitial)
      .catch((e) => setErr(e.message));
  }, [params.id]);

  if (err) return <div className="empty" style={{ color: "var(--danger)" }}>✗ {err}</div>;
  if (!initial) return <div className="empty">Chargement…</div>;

  return <FormationForm entity="formations" entityLabel="Formation" initial={initial} />;
}
