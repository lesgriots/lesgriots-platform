// Page neutralisée — héritée du backoffice studio, n'est plus utilisée.
"use client";
import { useEffect } from "react";

export default function ObsoletePage({ params }) {
  useEffect(() => {
    if (typeof window !== "undefined") window.location.replace("/formations");
  }, []);
  return <div className="empty">Redirection vers /formations…</div>;
}
