"use client";
import { useEffect, useState } from "react";
import AutomationForm from "../../components/AutomationForm";

export default function EditAutomation({ params }) {
  const [a, setA] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch(`/api/instagram/automations/${params.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Introuvable"))))
      .then(setA).catch((e) => setErr(e.message));
  }, [params.id]);
  return (
    <div className="bo-page">
      <div className="bo-tete"><div className="bo-tete__gauche">
        <div className="bo-fil"><a href="/instagram">Instagram</a> / {params.id}</div>
        <h1>{a ? a.title : "Automatisation"}</h1>
      </div></div>
      {err ? <div className="empty" style={{ color: "var(--danger)" }}>✗ {err}</div>
        : !a ? <div className="empty">Chargement…</div>
        : <AutomationForm initial={a} isNew={false} />}
    </div>
  );
}
