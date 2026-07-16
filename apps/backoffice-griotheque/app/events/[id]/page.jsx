"use client";
import { useEffect, useState } from "react";
import EventForm from "../../components/EventForm";

export default function EventEditPage({ params }) {
  const [initial, setInitial] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/events/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Événement introuvable" : "Erreur réseau");
        return r.json();
      })
      .then(setInitial)
      .catch((e) => setErr(e.message));
  }, [params.id]);

  if (err) return <div className="empty" style={{ color: "var(--danger)" }}>✗ {err}</div>;
  if (!initial) return <div className="empty">Chargement…</div>;

  return <EventForm initial={initial} />;
}
