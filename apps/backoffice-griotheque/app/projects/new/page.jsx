// Page neutralisée — héritée du backoffice studio, n'est plus utilisée.
// Redirige vers /formations/new (l'équivalent griothèque).
"use client";
import { useEffect } from "react";

export default function ObsoletePage() {
  useEffect(() => {
    if (typeof window !== "undefined") window.location.replace("/formations/new");
  }, []);
  return <div className="empty">Redirection vers /formations/new…</div>;
}
