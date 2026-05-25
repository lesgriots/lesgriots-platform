// Liste des leads capturés via le lead-gate des ressources.
// Affiche email, nom, ressource demandée, date, consentement RGPD.
// Bouton export CSV pour transférer dans Brevo/Mailchimp/etc.
"use client";
import { useEffect, useState } from "react";
import Type from "../components/Type";

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    const [l, r] = await Promise.all([
      fetch("/api/leads").then((r) => r.json()),
      fetch("/api/resources").then((r) => r.json()),
    ]);
    setLeads(Array.isArray(l) ? l : []);
    setResources(Array.isArray(r) ? r : []);
    setLoading(false);
  }

  useEffect(() => { reload(); }, []);

  const resourcesById = Object.fromEntries(resources.map((r) => [r.id, r]));

  async function del(id) {
    if (!confirm("Supprimer ce lead ?")) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    reload();
  }

  function exportCsv() {
    const rows = [
      ["email", "name", "resource_id", "resource_title", "consent", "date"],
      ...leads.map((l) => [
        l.email,
        l.name || "",
        l.resource_id || "",
        resourcesById[l.resource_id]?.title || "",
        l.consent ? "oui" : "non",
        l.created_at,
      ]),
    ];
    const csv = rows.map((r) =>
      r.map((cell) => {
        const v = String(cell ?? "");
        return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(",")
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-griotheque-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1><Type text={`leads — ${leads.length}`} speed={28} cursor="always" /></h1>
        <div className="actions" style={{ margin: 0 }}>
          <a className="btn btn--ghost" href="/">← Accueil</a>
          <button className="btn" onClick={exportCsv} disabled={leads.length === 0}>↓ Export CSV</button>
        </div>
      </div>

      <p className="note" style={{ marginTop: 12, marginBottom: 18 }}>
        Liste des emails capturés via le formulaire "Télécharger" sur la page Ressources du site.
        Export CSV pour les transférer dans ton outil d'emailing (Brevo, Mailchimp, etc.).
      </p>

      {loading ? (
        <div className="empty">Chargement…</div>
      ) : leads.length === 0 ? (
        <div className="empty">
          Aucun lead pour le moment. Les emails arriveront ici dès qu'un visiteur
          téléchargera une ressource depuis le site lagriotheque.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Nom</th>
              <th>Ressource</th>
              <th style={{ width: 100 }}>RGPD</th>
              <th style={{ width: 160 }}>Date</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td>{l.email}</td>
                <td>{l.name || "—"}</td>
                <td>
                  {l.resource_id ? (resourcesById[l.resource_id]?.title || l.resource_id) : "—"}
                </td>
                <td>
                  <span className="pill">{l.consent ? "✓ consenti" : "✗ pas consenti"}</span>
                </td>
                <td style={{ fontSize: 11, color: "var(--ink-dim)" }}>
                  {l.created_at ? new Date(l.created_at).toLocaleString("fr-FR") : "—"}
                </td>
                <td>
                  <button
                    className="btn btn--danger"
                    style={{ padding: "4px 10px", fontSize: 11 }}
                    onClick={() => del(l.id)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
