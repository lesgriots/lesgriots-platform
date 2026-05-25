"use client";
import { useEffect, useState } from "react";
import SessionForm from "../../components/SessionForm";

export default function SessionEditPage({ params }) {
  const [initial, setInitial] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/sessions/${params.id}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("Introuvable")))
      .then(setInitial)
      .catch((e) => setErr(e.message));
  }, [params.id]);

  if (err) return <div className="empty" style={{ color: "var(--danger)" }}>✗ {err}</div>;
  if (!initial) return <div className="empty">Chargement…</div>;

  return <SessionForm initial={initial} />;
}
