// Page neutralisée — héritage backoffice studio. Redirige vers /defaults.
"use client";
import { useEffect } from "react";

export default function ObsoletePage() {
  useEffect(() => {
    if (typeof window !== "undefined") window.location.replace("/defaults");
  }, []);
  return <div className="empty">Redirection vers /defaults…</div>;
}
