// Composant d'upload du PDF programme d'une formation.
// Affiche l'état actuel (PDF présent ou non) + permet d'uploader/remplacer/supprimer.
// Le fichier est sauvegardé sous img/programmes/{id}.pdf côté lagriotheque.
"use client";
import { useEffect, useState, useRef } from "react";

export default function ProgrammePdfInput({ formationId }) {
  const [status, setStatus] = useState({ exists: false, loading: true });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const inputRef = useRef(null);

  async function refresh() {
    if (!formationId) {
      setStatus({ exists: false, loading: false });
      return;
    }
    setStatus((s) => ({ ...s, loading: true }));
    try {
      const r = await fetch(`/api/upload-programme/${encodeURIComponent(formationId)}`);
      const j = await r.json();
      setStatus({ ...j, loading: false });
    } catch (err) {
      setStatus({ exists: false, loading: false, error: err.message });
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formationId]);

  async function onPick(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setMsg("✗ Le fichier doit être un PDF");
      e.target.value = "";
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/upload-programme/${encodeURIComponent(formationId)}`, {
        method: "POST",
        body: fd,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Upload échoué");
      setMsg(`✓ PDF uploadé (${formatBytes(j.bytes)})`);
      await refresh();
    } catch (err) {
      setMsg("✗ " + err.message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function onDelete() {
    if (!confirm("Supprimer le PDF programme actuel ?")) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch(`/api/upload-programme/${encodeURIComponent(formationId)}`, {
        method: "DELETE",
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Suppression échouée");
      setMsg("✓ PDF supprimé");
      await refresh();
    } catch (err) {
      setMsg("✗ " + err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!formationId) {
    return (
      <p style={{ fontSize: 12, color: "#888" }}>
        Sauvegarde d'abord la formation pour générer son id, puis tu pourras
        uploader le programme PDF ici.
      </p>
    );
  }

  return (
    <div className="programme-pdf">
      <p style={{ fontSize: 12, color: "#666", marginTop: 0, marginBottom: 12 }}>
        Le PDF sera enregistré sous{" "}
        <code style={{ background: "#f0f0f0", padding: "2px 6px", borderRadius: 3 }}>
          img/programmes/{formationId}.pdf
        </code>{" "}
        — le nom est généré automatiquement à partir de l'id de la formation.
      </p>

      {status.loading ? (
        <p style={{ fontSize: 13, color: "#888" }}>Chargement…</p>
      ) : status.exists ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 12,
            background: "#f5f5f5",
            border: "1px solid #ddd",
            borderRadius: 4,
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 20 }}>📄</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{formationId}.pdf</div>
            <div style={{ fontSize: 11, color: "#888" }}>
              {formatBytes(status.bytes)} · modifié le{" "}
              {new Date(status.modifiedAt).toLocaleString("fr-FR")}
            </div>
          </div>
          <a
            href={`/api/upload-programme/${encodeURIComponent(formationId)}?file=1`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12,
              color: "#0066cc",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            voir
          </a>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            style={{
              fontSize: 12,
              border: "1px solid #cc3333",
              background: "transparent",
              color: "#cc3333",
              padding: "6px 12px",
              borderRadius: 3,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            supprimer
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "#999", fontStyle: "italic", marginBottom: 12 }}>
          Aucun PDF programme pour cette formation pour l'instant.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={onPick}
        disabled={busy}
        style={{ display: "none" }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        style={{
          fontSize: 13,
          padding: "8px 16px",
          border: "1px solid #000",
          background: status.exists ? "transparent" : "#000",
          color: status.exists ? "#000" : "#fff",
          cursor: busy ? "wait" : "pointer",
          borderRadius: 3,
        }}
      >
        {busy
          ? "Upload en cours…"
          : status.exists
            ? "Remplacer le PDF"
            : "↑ Choisir un PDF"}
      </button>

      {msg && (
        <p
          style={{
            fontSize: 12,
            marginTop: 10,
            color: msg.startsWith("✓") ? "#0a7a2f" : "#cc3333",
          }}
        >
          {msg}
        </p>
      )}
    </div>
  );
}

function formatBytes(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} ko`;
  return `${(n / 1024 / 1024).toFixed(2)} Mo`;
}
