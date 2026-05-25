// Page neutralisée — héritage backoffice studio.
"use client";
import { useEffect } from "react";

export default function ObsoletePage() {
  useEffect(() => {
    if (typeof window !== "undefined") window.location.replace("/");
  }, []);
  return <div className="empty">Redirection vers l'accueil…</div>;
}
