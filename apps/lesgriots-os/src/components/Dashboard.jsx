'use client';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import {
  PILLAR_MAP, EXPENSE_CATEGORIES, PIPELINE_STAGES, STAGE_MAP, EXPENSE_STATUS,
  IP_REVENUE_SOURCES, TVA_RATES, TVA_MAP, PROVIDER_CATEGORIES, PROJECT_TEMPLATES,
  PRODUCTION_TASK_TEMPLATES, PPM_PHASE_KEYS, TASK_TYPES, TASK_TITLE_TO_PHASE, TASK_PHASE_GROUPS,
  generateProjectCode, generateBDCNumber,
} from '@/lib/constants';
import { useConfirm } from '@/components/ui';

// Applique une transparence a une couleur (hex ou var(--token))
const alpha = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

const INITIAL_STATE = { projects: [], providers: [], team: [], nextIndices: { STUDIO: 1, PROD: 1, GRIOTHEQUE: 1 }, griothequeStats: { caConfirmed: 0, caPending: 0, sessionsCount: 0, apprenantsCount: 0, monthlyCA: {} } };

const TASK_STATUSES = [
  { key: "todo", label: "À faire", color: "var(--text-3)" },
  { key: "in_progress", label: "En cours", color: "var(--info)" },
  { key: "review", label: "Review", color: "var(--gold)" },
  { key: "done", label: "Fait", color: "var(--success)" },
];


// ── UI COMPONENTS ──
function Pagination({ total, page, perPage, onChange }) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  const btnBase = { background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontFamily: "'Geist Sans', 'DM Sans', sans-serif", cursor: "pointer" };
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: "16px 0" }}>
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}
        style={{ ...btnBase, color: page === 1 ? "var(--text-3)" : "var(--text-3)", cursor: page === 1 ? "default" : "pointer" }}>← Préc</button>
      <span style={{ color: "var(--text-3)", fontSize: 12, fontFamily: "'Geist Sans', 'DM Sans', sans-serif" }}>{page} / {pages} ({total})</span>
      <button onClick={() => onChange(Math.min(pages, page + 1))} disabled={page === pages}
        style={{ ...btnBase, color: page === pages ? "var(--text-3)" : "var(--text-3)", cursor: page === pages ? "default" : "pointer" }}>Suiv →</button>
    </div>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 32, width: "90%", maxWidth: 580, maxHeight: "85vh", overflowY: "auto", fontFamily: "'Geist Sans', 'DM Sans', sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ margin: 0, color: "var(--gold)", fontSize: 18, fontWeight: 600 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-3)", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, options, required }) {
  const base = { width: "100%", padding: "10px 14px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 14, fontFamily: "'Geist Sans', 'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" };
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", color: "var(--text-3)", fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label} {required && <span style={{ color: "var(--gold)" }}>*</span>}
      </label>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)} style={{ ...base, cursor: "pointer" }}>
          <option value="">— Sélectionner —</option>
          {options.map(o => <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>{typeof o === "string" ? o : o.label}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...base, minHeight: 70, resize: "vertical" }} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={base} />
      )}
    </div>
  );
}

function Badge({ label, color }) {
  return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: color + "22", color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>;
}

function StarRating({ value = 0, onChange, size = 18 }) {
  return (
    <div style={{ display: "flex", gap: 2, cursor: onChange ? "pointer" : "default" }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} onClick={() => onChange && onChange(i === value ? 0 : i)}
          style={{ fontSize: size, color: i <= value ? "var(--gold)" : "var(--text-3)", transition: "color 0.15s", userSelect: "none" }}>
          ★
        </span>
      ))}
    </div>
  );
}

function MultiCategorySelect({ selected = [], onChange, options, onAddCustom }) {
  const [newCat, setNewCat] = useState("");
  const [showInput, setShowInput] = useState(false);
  const allOptions = options; // options already includes custom ones passed from parent
  const toggle = (cat) => {
    if (selected.includes(cat)) onChange(selected.filter(c => c !== cat));
    else onChange([...selected, cat]);
  };
  const handleAdd = () => {
    const cat = newCat.trim();
    if (!cat) return;
    if (onAddCustom) onAddCustom(cat);
    onChange([...selected.filter(c => c !== cat), cat]);
    setNewCat("");
    setShowInput(false);
  };
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", color: "var(--text-3)", fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Compétences / Types de prestation
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {allOptions.map(cat => (
          <button key={cat} onClick={() => toggle(cat)} type="button" style={{
            padding: "5px 12px", borderRadius: 20, fontSize: 12, fontFamily: "inherit", cursor: "pointer",
            background: selected.includes(cat) ? "var(--gold-soft)" : "var(--bg)",
            border: `1px solid ${selected.includes(cat) ? "var(--gold)" : "var(--border)"}`,
            color: selected.includes(cat) ? "var(--gold)" : "var(--text-3)",
            transition: "all 0.15s",
          }}>{cat}</button>
        ))}
        {/* Catégorie custom inline */}
        {showInput ? (
          <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
            <input autoFocus value={newCat} onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setShowInput(false); }}
              placeholder="Ex: Scénariste…"
              style={{ padding: "4px 10px", borderRadius: 20, fontSize: 12, fontFamily: "inherit", background: "var(--bg)", border: "1px solid var(--gold)", color: "var(--text)", outline: "none", width: 130 }} />
            <button onClick={handleAdd} type="button" style={{ padding: "4px 10px", borderRadius: 20, fontSize: 12, fontFamily: "inherit", cursor: "pointer", background: "var(--gold-soft)", border: "1px solid var(--gold)", color: "var(--gold)" }}>✓</button>
            <button onClick={() => setShowInput(false)} type="button" style={{ padding: "4px 8px", borderRadius: 20, fontSize: 12, fontFamily: "inherit", cursor: "pointer", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-3)" }}>✕</button>
          </span>
        ) : (
          <button onClick={() => setShowInput(true)} type="button" style={{ padding: "5px 10px", borderRadius: 20, fontSize: 12, fontFamily: "inherit", cursor: "pointer", background: "var(--bg)", border: "1px dashed var(--border-2)", color: "var(--text-3)" }}>+ Nouvelle</button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 22px", flex: "1 1 170px", minWidth: 160 }}>
      <div style={{ color: "var(--text-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
      <div style={{ color: accent || "var(--gold)", fontSize: 26, fontWeight: 700, fontFamily: "'Space Mono', monospace" }}>{value}</div>
      {sub && <div style={{ color: "var(--text-3)", fontSize: 12, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Copy button ──
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  const handle = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <span onClick={handle} title="Copier" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", marginLeft: 5, opacity: 0.4, transition: "opacity 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.opacity = 1}
      onMouseLeave={e => e.currentTarget.style.opacity = copied ? 1 : 0.4}>
      {copied
        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      }
    </span>
  );
}

// ── Casse des noms ──
// Prénom : Title Case  ("jean-pierre" → "Jean-Pierre")
function fmtPrenom(s) {
  if (!s) return '';
  return s.trim().split(/[\s-]/).map((w, i, arr) => {
    const sep = i < arr.length - 1 ? (s.includes('-') && s.split(/\s/)[0]?.includes('-') ? '-' : ' ') : '';
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() + (s.trim().split(' ').length > 1 ? ' ' : sep);
  }).join('').trim();
}
// Version simple fiable
const fmtP = (s) => s ? s.trim().replace(/\b\w/g, c => c.toUpperCase()).replace(/\B\w/g, c => c.toLowerCase()) : '';
// NOM : MAJUSCULES
const fmtN = (s) => s ? s.trim().toUpperCase() : '';
// Nom complet formaté
const fmtFullName = (firstName, lastName) => [fmtP(firstName), fmtN(lastName)].filter(Boolean).join(' ');

// Helper: compute TTC from HT + tvaRate key (e.g. '20', '10', '0')
function computeTTC(ht, tvaRateKey) {
  const rate = { '20': 0.20, '10': 0.10, '5.5': 0.055, '2.1': 0.021, '0': 0 }[String(tvaRateKey)] ?? 0.20;
  return ht * (1 + rate);
}

// Display helper: "1 000€ HT · 1 200€ TTC"
function HtTtc({ ht, tvaRateKey, size = 13, color = "var(--text)" }) {
  if (!ht || ht <= 0) return <span style={{ fontSize: size, color }}>0€</span>;
  const ttc = computeTTC(ht, tvaRateKey);
  const rate = tvaRateKey || '20';
  return (
    <span>
      <span style={{ fontSize: size, fontWeight: 700, color }}>{ht.toLocaleString('fr-FR')}€ HT</span>
      {rate !== '0' && (
        <span style={{ fontSize: size - 2, color: "var(--text-3)", marginLeft: 4 }}>· {ttc.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€ TTC</span>
      )}
    </span>
  );
}

function MarginBar({ revenue, spent }) {
  if (!revenue || revenue <= 0) return null;
  const margin = ((revenue - spent) / revenue * 100);
  const pct = Math.max(0, Math.min(100, (spent / revenue) * 100));
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>
        <span>Coûts: {spent.toFixed(0)}€</span>
        <span style={{ color: margin >= 50 ? "var(--success)" : margin >= 30 ? "var(--gold)" : "var(--danger)", fontWeight: 600 }}>
          Marge: {margin.toFixed(0)}%
        </span></div>
      <div style={{ background: "var(--bg)", height: 6, borderRadius: 3, overflow: "hidden", border: "1px solid var(--border)" }}>
        <div style={{ background: margin >= 50 ? "var(--success)" : margin >= 30 ? "var(--gold)" : "var(--danger)", height: "100%", width: pct + "%" }} />
      </div>
    </div>
  );
}

function BriefField({ brief, saveBrief, fieldKey, label, placeholder, hint, large }) {
  const [local, setLocal] = useState(brief[fieldKey] || '');
  const [focused, setFocused] = useState(false);
  const hasContent = !!brief[fieldKey];
  // Sync local when brief changes externally (e.g. after save)
  useEffect(() => { if (!focused) setLocal(brief[fieldKey] || ''); }, [brief[fieldKey]]);
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ width: 3, height: 14, borderRadius: 2, background: hasContent ? "var(--gold)" : "var(--surface-3)" }} />
        <div style={{ fontSize: 11, fontWeight: 700, color: hasContent ? "var(--gold)" : "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
        {!hasContent && <span style={{ fontSize: 10, color: "var(--text-3)", background: "var(--surface)", border: "1px solid var(--border)", padding: "1px 6px", borderRadius: 4 }}>À compléter</span>}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6, paddingLeft: 11 }}>{hint}</div>
      <textarea
        value={focused ? local : (brief[fieldKey] || '')}
        onChange={e => setLocal(e.target.value)}
        onFocus={() => { setLocal(brief[fieldKey] || ''); setFocused(true); }}
        onBlur={() => { setFocused(false); if (local !== (brief[fieldKey] || '')) saveBrief(fieldKey, local); }}
        placeholder={placeholder}
        style={{
          width: "100%", minHeight: large ? 100 : 60, background: "var(--bg)", border: `1px solid ${focused ? "var(--gold)" : "var(--border)"}`,
          borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "var(--text-2)",
          fontFamily: "'Geist Sans', 'DM Sans', sans-serif", lineHeight: 1.6, resize: "vertical", boxSizing: "border-box", outline: "none",
          transition: "border-color 0.15s",
        }}
      />
    </div>
  );
}

// ── CSV EXPORT UTILITY ──
function exportToCSV(filename, rows, headers) {
  const BOM = "\uFEFF";
  const csvContent = [
    headers.join(";"),
    ...rows.map(row => row.map(cell => `"${String(cell || "").replace(/"/g, '""')}"`).join(";")),
  ].join("\n");
  
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

// ── COMMAND PALETTE (⌘K) ──
function CommandPalette({ open, onClose, projects = [], clients = [], providers = [], onNavigate }) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) { setQuery(""); setSelectedIdx(0); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) {
      // Show recent / popular items when no query
      const recentProjects = projects.filter(p => ["active","signed","negotiation","quoted"].includes(p.stage)).slice(0, 5)
        .map(p => ({ type: "project", id: p.id, label: `${p.code} — ${p.name}`, sub: STAGE_MAP?.[p.stage]?.label || p.stage, icon: "▣", color: "var(--gold)", data: p }));
      const topClients = clients.slice(0, 3)
        .map(c => ({ type: "client", id: c.id, label: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.company, sub: c.company || '', icon: "◑", color: "var(--info)", data: c }));
      return [...recentProjects, ...topClients];
    }
    const q = query.toLowerCase();
    const matchedProjects = projects.filter(p =>
      (p.name || '').toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q) ||
      (p.client_name || '').toLowerCase().includes(q)
    ).slice(0, 6).map(p => ({
      type: "project", id: p.id, label: `${p.code} — ${p.name}`, sub: `${PILLAR_MAP?.[p.pillar] || p.pillar} · ${STAGE_MAP?.[p.stage]?.label || p.stage}`,
      icon: "▣", color: "var(--gold)", data: p,
    }));
    const matchedClients = clients.filter(c =>
      (c.first_name || '').toLowerCase().includes(q) || (c.last_name || '').toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)
    ).slice(0, 4).map(c => ({
      type: "client", id: c.id, label: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.company,
      sub: c.company || c.email || '', icon: "◑", color: "var(--info)", data: c,
    }));
    const matchedProviders = providers.filter(p => {
      const catStr = Array.isArray(p.categories) ? p.categories.join(' ') : String(p.categories || '');
      return (p.first_name || '').toLowerCase().includes(q) || (p.last_name || '').toLowerCase().includes(q) ||
        (p.name || '').toLowerCase().includes(q) || catStr.toLowerCase().includes(q);
    }).slice(0, 4).map(p => ({
      type: "provider", id: p.id, label: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.name,
      sub: Array.isArray(p.categories) ? p.categories.join(', ') : String(p.categories || ''),
      icon: "◉", color: "var(--success)", data: p,
    }));
    return [...matchedProjects, ...matchedClients, ...matchedProviders];
  }, [query, projects, clients, providers]);

  useEffect(() => { setSelectedIdx(0); }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current.children[selectedIdx];
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIdx]);

  const handleKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && results[selectedIdx]) { onNavigate(results[selectedIdx]); onClose(); }
    else if (e.key === "Escape") onClose();
  };

  if (!open) return null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--overlay)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 2000, backdropFilter: "blur(6px)", paddingTop: "15vh" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, width: "90%", maxWidth: 520, overflow: "hidden", boxShadow: "var(--shadow-lg)", fontFamily: "'Geist Sans', 'DM Sans', sans-serif" }}>
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border)", gap: 10 }}>
          <span style={{ color: "var(--text-3)", fontSize: 16 }}>⌕</span>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKey}
            placeholder="Rechercher un projet, client, prestataire…"
            style={{ flex: 1, background: "transparent", border: "none", color: "var(--text)", fontSize: 15, fontFamily: "inherit", outline: "none" }} />
          <kbd style={{ padding: "2px 8px", borderRadius: 4, background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text-3)", fontSize: 11, fontFamily: "'Space Mono', monospace" }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 340, overflowY: "auto", padding: "6px 0" }}>
          {results.length === 0 && query.trim() && (
            <div style={{ padding: "24px 18px", color: "var(--text-3)", fontSize: 13, textAlign: "center" }}>
              Aucun résultat pour « {query} »
            </div>
          )}
          {!query.trim() && results.length > 0 && (
            <div style={{ padding: "6px 18px 4px", fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Projets actifs & clients récents</div>
          )}
          {results.map((r, i) => (
            <div key={`${r.type}-${r.id}`}
              onClick={() => { onNavigate(r); onClose(); }}
              onMouseEnter={() => setSelectedIdx(i)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", cursor: "pointer",
                background: i === selectedIdx ? "var(--surface-3)" : "transparent",
                transition: "background 0.1s",
              }}>
              <span style={{ fontSize: 14, color: r.color, opacity: 0.6, width: 20, textAlign: "center" }}>{r.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: i === selectedIdx ? "var(--text)" : "var(--text-2)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</div>
                {r.sub && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>{r.sub}</div>}
              </div>
              <span style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {r.type === "project" ? "Projet" : r.type === "client" ? "Client" : "Presta"}
              </span>
              {i === selectedIdx && <span style={{ fontSize: 11, color: "var(--text-3)" }}>↵</span>}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: "8px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: 16, fontSize: 11, color: "var(--text-3)" }}>
          <span>↑↓ naviguer</span>
          <span>↵ ouvrir</span>
          <span>esc fermer</span>
        </div>
      </div>
    </div>
  );
}

// ── BREADCRUMBS ──
function Breadcrumbs({ items }) {
  if (!items || items.length <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-3)", padding: "0", fontFamily: "'Geist Sans', 'DM Sans', sans-serif" }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {i > 0 && <span style={{ color: "var(--text-3)" }}>›</span>}
          {item.onClick ? (
            <span onClick={item.onClick} style={{ cursor: "pointer", color: "var(--text-3)", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--gold)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
              {item.label}
            </span>
          ) : (
            <span style={{ color: "var(--text-3)", fontWeight: 500 }}>{item.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

// ── PINNED PROJECTS BAR ──
function PinnedBar({ pinnedIds, projects, onSelect, onUnpin }) {
  const pinned = pinnedIds.map(id => projects.find(p => p.id === id)).filter(Boolean);
  if (pinned.length === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", overflowX: "auto" }}>
      <span style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap", marginRight: 4 }}>★ Épinglés</span>
      {pinned.map(p => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", whiteSpace: "nowrap", transition: "border-color 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
          <span onClick={() => onSelect(p)} style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 500 }}>{p.code}</span>
          <span onClick={(e) => { e.stopPropagation(); onUnpin(p.id); }} style={{ fontSize: 11, color: "var(--text-3)", cursor: "pointer", marginLeft: 2, lineHeight: 1 }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>✕</span>
        </div>
      ))}
    </div>
  );
}

// ── Grid Block Wrapper (stable component, outside render loop) ──
function GridBlockWrapper({ blockKey, gridColumn, isDragging, isOverDrop, dragHandlers, onResize, onHide, children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      {...dragHandlers}
      style={{
        gridColumn: gridColumn,
        position: "relative",
        opacity: isDragging ? 0.4 : 1,
        transition: "opacity 0.15s, transform 0.15s",
        transform: isOverDrop ? "translateY(4px)" : "none",
        borderTop: isOverDrop ? "2px solid var(--gold)" : "2px solid transparent",
        paddingTop: 2,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hover toolbar */}
      <div style={{
        position: "absolute", top: 8, right: 8, display: "flex", gap: 6,
        zIndex: 2, opacity: hovered ? 1 : 0, transition: "opacity 0.2s", pointerEvents: hovered ? "auto" : "none",
      }}>
        <div style={{ color: "var(--text-3)", fontSize: 14, cursor: "grab", padding: "2px 6px", borderRadius: 4, background: "var(--bg)", opacity: 0.6 }} title="Glisser pour réorganiser">⠿</div>
        <button onClick={(e) => { e.stopPropagation(); onResize(); }} style={{ fontSize: 11, padding: "2px 6px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--gold)", cursor: "pointer", fontFamily: "inherit", opacity: 0.6 }} title="Basculer full/half">↔</button>
        <button onClick={(e) => { e.stopPropagation(); onHide(); }} style={{ fontSize: 11, padding: "2px 6px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--gold)", cursor: "pointer", fontFamily: "inherit", opacity: 0.6 }} title="Masquer ce bloc">✕</button>
      </div>
      {children}
    </div>
  );
}

// ── MAIN COMPONENT ──
export default function LesGriotsOS() {
  const [data, setData] = useState(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile sidebar toggle
  const [dashCalYear, setDashCalYear] = useState(new Date().getFullYear());
  const [dashCalMonth, setDashCalMonth] = useState(new Date().getMonth());
  const [dashCalPopover, setDashCalPopover] = useState(null);
  // ── Grid Layout System (Notion-like) ──
  const ALL_GRID_BLOCKS = [
    { key: "keylines", label: "Résumé pipeline", icon: "💰" },
    { key: "alerts", label: "Alertes", icon: "🚨" },
    { key: "projets_en_cours", label: "Projets en cours", icon: "⚡" },
    { key: "taches", label: "Tâches", icon: "📋" },
    { key: "indicateurs", label: "Indicateurs financiers", icon: "📊" },
    { key: "quick_stats", label: "Statistiques", icon: "📈" },
    { key: "forecast", label: "Forecast pipeline", icon: "🔮" },
    { key: "charts", label: "Graphiques", icon: "📉" },
    { key: "sw_next_move", label: "Prochain move", icon: "🎯" },
    { key: "sw_pipeline", label: "Pipeline", icon: "💰" },
    { key: "sw_tasks", label: "Tâches actives", icon: "🔄" },
    { key: "sw_calendar", label: "Cette semaine", icon: "📅" },
    { key: "sw_relances", label: "À relancer", icon: "🔔" },
    { key: "sw_finances", label: "Santé financière", icon: "💶" },
    { key: "sw_pillars", label: "Piliers", icon: "🏛" },
  ];
  const GRID_DEFAULT = [
    { key: "keylines", size: "full", visible: true },
    { key: "alerts", size: "full", visible: true },
    { key: "projets_en_cours", size: "full", visible: true },
    { key: "taches", size: "half", visible: true },
    { key: "sw_next_move", size: "half", visible: true },
    { key: "indicateurs", size: "full", visible: true },
    { key: "quick_stats", size: "half", visible: true },
    { key: "sw_pipeline", size: "half", visible: true },
    { key: "forecast", size: "half", visible: true },
    { key: "sw_finances", size: "half", visible: true },
    { key: "charts", size: "full", visible: true },
    { key: "sw_tasks", size: "half", visible: true },
    { key: "sw_calendar", size: "half", visible: true },
    { key: "sw_relances", size: "half", visible: true },
    { key: "sw_pillars", size: "half", visible: true },
  ];
  const [gridLayout, setGridLayout] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' && window.localStorage?.getItem('grid_layout');
      if (saved) return JSON.parse(saved);
      // Migration: check for old keys and build gridLayout
      const oldOverview = typeof window !== 'undefined' && window.localStorage?.getItem('overview_block_order');
      const oldSidebar = typeof window !== 'undefined' && window.localStorage?.getItem('sidebar_widgets');
      if (oldOverview || oldSidebar) {
        const ovr = oldOverview ? JSON.parse(oldOverview) : GRID_DEFAULT.filter(b => ["keylines","alerts","projets_en_cours","taches","indicateurs","quick_stats","forecast","charts"].includes(b.key)).map(b => b.key);
        const sbr = oldSidebar ? JSON.parse(oldSidebar) : GRID_DEFAULT.filter(b => b.key.startsWith("sw_")).map(b => b.key);
        const migrated = GRID_DEFAULT.map(b => ({ ...b, visible: ovr.includes(b.key) || sbr.includes(b.key) }));
        try { window.localStorage?.setItem('grid_layout', JSON.stringify(migrated)); window.localStorage?.removeItem('overview_block_order'); window.localStorage?.removeItem('sidebar_widgets'); window.localStorage?.removeItem('sidebar_open'); } catch {}
        return migrated;
      }
      return GRID_DEFAULT;
    } catch {
      return GRID_DEFAULT;
    }
  });
  const [draggingGridBlock, setDraggingGridBlock] = useState(null);
  const [dragOverGridBlock, setDragOverGridBlock] = useState(null);
  const [showDashConfig, setShowDashConfig] = useState(false);
  // Toggle block visibility
  const toggleGridBlock = (key) => {
    setGridLayout(prev => {
      const next = prev.map(b => b.key === key ? { ...b, visible: !b.visible } : b);
      try { window.localStorage?.setItem('grid_layout', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  // Resize block (cycle: full → half → full)
  const resizeGridBlock = (key) => {
    setGridLayout(prev => {
      const next = prev.map(b => b.key === key ? { ...b, size: b.size === "full" ? "half" : "full" } : b);
      try { window.localStorage?.setItem('grid_layout', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  // Reorder blocks on drop
  const moveGridBlock = (fromKey, toKey) => {
    setGridLayout(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(b => b.key === fromKey);
      const toIdx = arr.findIndex(b => b.key === toKey);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [movedItem] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, movedItem);
      try { window.localStorage?.setItem('grid_layout', JSON.stringify(arr)); } catch {}
      return arr;
    });
  };
  // Reset to default layout
  const resetGridLayout = () => {
    setGridLayout(GRID_DEFAULT);
    try { window.localStorage?.setItem('grid_layout', JSON.stringify(GRID_DEFAULT)); } catch {}
  };
  const [settings, setSettings] = useState({});
  const [settingsForm, setSettingsForm] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState("identity");
  const [modal, setModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, code, name } or null
  const [pdfPreview, setPdfPreview] = useState(null); // { url, title } or null
  const [selProject, setSelProject] = useState(null);
  const [pf, setPf] = useState({});
  const [ef, setEf] = useState({});
  const [ir, setIr] = useState({});
  const [provForm, setProvForm] = useState({});

  // ── NEW STATE FOR SEARCH & FILTERS ──
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPillar, setFilterPillar] = useState("All");
  const [filterStage, setFilterStage] = useState("All");
  const [filterClient, setFilterClient] = useState("All");
  const [filterDateRange, setFilterDateRange] = useState("all");
  const [provSort, setProvSort] = useState("name"); // name, rating, tarif
  // ── TASKS VIEW STATE ──
  const [tasksViewMode, setTasksViewMode] = useState("kanban"); // kanban | list
  const [tasksFilterAssignee, setTasksFilterAssignee] = useState("all");
  const [tasksFilterProject, setTasksFilterProject] = useState("all");
  const [tasksGroupBy, setTasksGroupBy] = useState("status"); // status | assignee | project
  const [provViewMode, setProvViewMode] = useState("grid"); // grid | list
  const [provFilterCat, setProvFilterCat] = useState("All");
  const [provSearch, setProvSearch] = useState("");
  const [editingDates, setEditingDates] = useState(null); // project id being date-edited
  const [taskForm, setTaskForm] = useState({});
  const [teamForm, setTeamForm] = useState({});
  const [projectTab, setProjectTab] = useState("detail"); // detail, tasks, timeline, team
  const [phaseForm, setPhaseForm] = useState({});
  const [editingPhase, setEditingPhase] = useState(null);
  const [postingForm, setPostingForm] = useState({ note: '', postedAt: new Date().toISOString().slice(0, 10) });
  const [openPostingPhase, setOpenPostingPhase] = useState(null);
  const [editingTask, setEditingTask] = useState(null); // task id being inline-edited
  const [hoveredTask, setHoveredTask] = useState(null); // task id for hover reveal
  const [quickAssignTask, setQuickAssignTask] = useState(null); // task id for quick-assign dropdown
  const [addingInPhase, setAddingInPhase] = useState(null);
  const [newTaskInPhase, setNewTaskInPhase] = useState('');
  const [selectedTasks, setSelectedTasks] = useState(new Set()); // bulk selection
  const [applyingTemplate, setApplyingTemplate] = useState(null);
  const [draggingTask, setDraggingTask] = useState(null);
  const [dragOverPhase, setDragOverPhase] = useState(null);
  const [draggingProjectId, setDraggingProjectId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [openPPMPhase, setOpenPPMPhase] = useState(null); // { projectId, phaseKey }
  const [ppmLogForm, setPpmLogForm] = useState({ note: '', loggedAt: new Date().toISOString().slice(0, 10) });
  const [welcomeEmailModal, setWelcomeEmailModal] = useState(null); // null | 'welcome' | 'followup'
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false); // anti double-submit sur les saves modaux
  const [offline, setOffline] = useState(false); // auto-refresh en échec
  const [loadError, setLoadError] = useState(false); // échec du chargement initial
  const [formDirty, setFormDirty] = useState(false); // modifications non enregistrées dans un modal
  const confirm = useConfirm();
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [selClient, setSelClient] = useState(null); // for clients view
  const [selProvider, setSelProvider] = useState(null); // for providers view
  const [clientForm, setClientForm] = useState({}); // form state for create/edit client
  const [editingClient, setEditingClient] = useState(null); // client id being edited, or 'new'
  const [contactForm, setContactForm] = useState({}); // form for add/edit contact
  const [editingContact, setEditingContact] = useState(null); // contact id or 'new:{clientId}'
  const [chartYear, setChartYear] = useState(new Date().getFullYear());
  const [journalForm, setJournalForm] = useState({ type: "call", content: "", loggedAt: new Date().toISOString().slice(0, 10) });
  // ── Custom provider categories (merged with PROVIDER_CATEGORIES) ──
  const [customProvCats, setCustomProvCats] = useState([]);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [pinnedProjects, setPinnedProjects] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return JSON.parse(localStorage.getItem('lesgriots_pinned') || '[]'); } catch { return []; }
    }
    return [];
  });
  // Merge base + custom, deduplicated
  const allProvCats = [...PROVIDER_CATEGORIES, ...customProvCats.filter(c => !PROVIDER_CATEGORIES.includes(c))];
  // ── Couleurs par catégorie de prestataire ──
  const CAT_COLORS = {
    "Monteur": { bg: "#1a3a2a", border: "#2d6a4a", text: "#4ade80" },
    "Étalonneur / Coloriste": { bg: "#1a2a3a", border: "#2d4a6a", text: "#60a5fa" },
    "Réal": { bg: "#3a1a2a", border: "#6a2d4a", text: "#f472b6" },
    "Motion designer": { bg: "#2a1a3a", border: "#4a2d6a", text: "#a78bfa" },
    "Sound designer / Mixeur": { bg: "#3a2a1a", border: "#6a4a2d", text: "#fb923c" },
    "Cadreur / Chef op": { bg: "#3a3a1a", border: "#6a6a2d", text: "#facc15" },
    "Photographe": { bg: "#1a3a3a", border: "#2d6a6a", text: "#34d399" },
    "Graphiste / DA": { bg: "#3a1a1a", border: "#6a2d2d", text: "#f87171" },
    "Maquilleur / Styliste": { bg: "#2a3a1a", border: "#4a6a2d", text: "#a3e635" },
    "Régisseur": { bg: "#1a2a2a", border: "#2d5a5a", text: "#67e8f9" },
    "Danseur": { bg: "#2a1a2a", border: "#5a2d5a", text: "#e879f9" },
    "Chorégraphe": { bg: "#3a2a3a", border: "#6a4a6a", text: "#d946ef" },
    "Location matériel": { bg: "#2a2a1a", border: "#5a5a2d", text: "var(--gold)" },
    "Location salle": { bg: "#1a2a1a", border: "#2d5a2d", text: "#86efac" },
    "Autre": { bg: "var(--surface-3)", border: "var(--border-2)", text: "var(--text-3)" },
  };
  const getCatColor = (cat) => CAT_COLORS[cat] || { bg: "#1a1a2a", border: "#2d2d5a", text: "#818cf8" };
  const addCustomProvCat = async (cat) => {
    if (customProvCats.includes(cat) || PROVIDER_CATEGORIES.includes(cat)) return;
    const next = [...customProvCats, cat];
    setCustomProvCats(next);
    await fetch('/api/settings', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ customProviderCategories: next }) });
  };

  // ── Sort / view mode for projects ──
  const [projSort, setProjSort] = useState("date_desc"); // date_desc | date_asc | revenue_desc | revenue_asc | name_asc | stage
  const [projViewMode, setProjViewMode] = useState("kanban"); // kanban | list | grid
  // ── Filter / sort / view mode for clients ──
  const [clientSearch, setClientSearch] = useState("");
  const [clientSort, setClientSort] = useState("revenue_desc"); // revenue_desc | alpha | recent
  const [clientViewMode, setClientViewMode] = useState("grid"); // grid | list
  const [clientPillarFilter, setClientPillarFilter] = useState("All"); // All | STUDIO | PROD | GRIOTHEQUE

  const loadInitialData = useCallback(() => {
    setLoadError(false);
    fetch('/api/data')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); setOffline(false); })
      .catch((e) => { console.warn('[Dashboard] Chargement /api/data échoué :', e); setLoadError(true); setLoading(false); });
    fetch('/api/settings').then(r => r.json()).then(s => { setSettings(s); if (s.customProviderCategories) setCustomProvCats(s.customProviderCategories); })
      .catch((e) => console.warn('[Dashboard] Chargement /api/settings échoué :', e));
  }, []);

  useEffect(() => {
    loadInitialData();
    // Auto-refresh toutes les 10 secondes — en cas d'échec, on garde l'état existant
    const interval = setInterval(() => {
      fetch('/api/data')
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(d => { setData(d); setOffline(false); })
        .catch(() => setOffline(true));
    }, 10000);
    return () => clearInterval(interval);
  }, [loadInitialData]);

  const refreshData = useCallback(() => {
    fetch('/api/data').then(r => r.json()).then(setData);
  }, []);

  const notify = useCallback((message, type = 'success') => {
    setToast({ id: Date.now(), message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Extrait le message d'erreur d'une réponse API en échec
  const readApiError = async (res) => {
    const j = await res.json().catch(() => ({}));
    return j.error || `Erreur ${res.status}`;
  };

  // Fermeture de modal avec garde "modifications non enregistrées"
  const guardedCloseModal = useCallback(async () => {
    if (formDirty) {
      const ok = await confirm({
        title: 'Modifications non enregistrées',
        message: 'Fermer quand même ? Les changements seront perdus.',
        confirmLabel: 'Fermer sans enregistrer',
      });
      if (!ok) return;
    }
    setFormDirty(false);
    setModal(null);
  }, [formDirty, confirm]);

  // Reset du flag dirty à chaque ouverture/fermeture de modal ou de formulaire client
  useEffect(() => { setFormDirty(false); }, [modal, editingClient, editingContact]);

  // Garde beforeunload légère quand un formulaire modal est dirty
  useEffect(() => {
    if (!formDirty) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [formDirty]);

  // ── Pin/Unpin helpers ──
  const togglePin = useCallback((projectId) => {
    setPinnedProjects(prev => {
      const next = prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId];
      if (typeof window !== 'undefined') localStorage.setItem('lesgriots_pinned', JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Keyboard shortcut: Cmd+K for command palette ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Command palette navigation handler ──
  const handleCmdNavigate = useCallback((result) => {
    if (result.type === "project") { setView("projects"); setSelProject(result.data); }
    else if (result.type === "client") { setView("clients"); setSelClient(result.data); }
    else if (result.type === "provider") { setView("providers"); setSelProvider(result.data); }
  }, []);

  const upf = (k, v) => { setFormDirty(true); setPf(p => ({ ...p, [k]: v })); };
  const uef = (k, v) => { setFormDirty(true); setEf(p => ({ ...p, [k]: v })); };
  const uir = (k, v) => { setFormDirty(true); setIr(p => ({ ...p, [k]: v })); };
  const uprov = (k, v) => { setFormDirty(true); setProvForm(p => ({ ...p, [k]: v })); };
  const upcf = (k, v) => { setFormDirty(true); setClientForm(p => ({ ...p, [k]: v })); };
  const upcct = (k, v) => { setFormDirty(true); setContactForm(p => ({ ...p, [k]: v })); };

  // ── CLIENT HELPERS ──
  const saveClient = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const isNew = editingClient === 'new';
      const url = isNew ? '/api/clients' : `/api/clients/${editingClient}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clientForm) });
      if (!res.ok) { notify(await readApiError(res), 'error'); return; }
      // If new client AND a contact principal was filled, create it automatically
      if (isNew && (clientForm.firstName || clientForm.lastName)) {
        const newClient = await res.json();
        if (newClient.id) {
          await fetch(`/api/clients/${newClient.id}/contacts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName: clientForm.firstName || '', lastName: clientForm.lastName || '', role: clientForm.contactRole || '', email: clientForm.email || '', phone: clientForm.phone || '' }),
          });
        }
      }
      await refreshData();
      setEditingClient(null);
      setClientForm({});
      setFormDirty(false);
      notify(isNew ? 'Client créé' : 'Client mis à jour');
    } catch {
      notify('Erreur réseau — client non enregistré', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveContact = async (clientId) => {
    if (saving) return;
    setSaving(true);
    try {
      const isNew = editingContact?.startsWith('new:');
      const url = isNew ? `/api/clients/${clientId}/contacts` : `/api/clients/${clientId}/contacts/${editingContact}`;
      const method = isNew ? 'POST' : 'PUT';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contactForm) });
      if (!res.ok) { notify(await readApiError(res), 'error'); return; }
      await refreshData();
      setEditingContact(null);
      setContactForm({});
      setFormDirty(false);
      notify('Contact enregistré');
    } catch {
      notify('Erreur réseau — contact non enregistré', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteContact = async (clientId, contactId) => {
    if (!(await confirm({ title: 'Supprimer ce contact ?', confirmLabel: 'Supprimer' }))) return;
    const res = await fetch(`/api/clients/${clientId}/contacts/${contactId}`, { method: 'DELETE' }).catch(() => null);
    if (!res || !res.ok) { notify(res ? await readApiError(res) : 'Erreur réseau', 'error'); return; }
    await refreshData();
    notify('Contact supprimé');
  };

  const deleteClient = async (id) => {
    if (!(await confirm({ title: 'Supprimer ce client ?', message: 'Ses projets ne seront pas supprimés.', confirmLabel: 'Supprimer' }))) return;
    const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' }).catch(() => null);
    if (!res || !res.ok) { notify(res ? await readApiError(res) : 'Erreur réseau', 'error'); return; }
    await refreshData();
    setSelClient(null);
    setEditingClient(null);
    notify('Client supprimé');
  };

  // Helper: get display name for a client object
  const clientDisplayName = (c) => {
    if (!c) return '—';
    const fullName = [fmtP(c.firstName), fmtN(c.lastName)].filter(Boolean).join(' ');
    if (fullName && c.company) return `${c.company} · ${fullName}`;
    return c.company || fullName || '—';
  };

  // Helper: get client entity linked to a project
  const projectClient = (proj) => {
    if (!proj || !data?.clients) return null;
    return data.clients.find(c => c.id === proj.clientId) || null;
  };

  const addProject = async (template) => {
    const year = new Date().getFullYear();
    const idx = (data.nextIndices[template.pillar] || 1);
    const code = generateProjectCode(template.pillar, year, idx);
    const proj = {
      id: `p_${Date.now()}`,
      code,
      pillar: template.pillar,
      name: "",
      client: "",
      clientFirstName: "",
      clientLastName: "",
      clientContact: "",
      clientEmail: "",
      clientPhone: "",
      clientAddress: "",
      stage: "lead",
      revenue: template.defaultBudget || 0,
      budget: template.defaultBudget || 0,
      notes: template.notes || "",
      expenses: template.defaultLines ? template.defaultLines.map(l => ({
        id: `e_${Date.now()}_${Math.random()}`,
        label: l.label,
        category: l.category,
        amountHT: 0,
        tvaRate: "20",
        date: new Date().toISOString().split("T")[0],
        status: "pending",
      })) : [],
      ipRevenues: [],
      bdcIndex: 0,
      createdDate: new Date().toISOString().split("T")[0],
    };
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/projects', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(proj) });
      if (!res.ok) { notify(await readApiError(res), 'error'); return; }

      // Auto-create production tasks from template
      const fresh1 = await fetch('/api/data').then(r => r.json());
      const freshProj = fresh1.projects.find(p => p.code === code);
      if (freshProj && PRODUCTION_TASK_TEMPLATES[template.key]) {
        const taskPromises = PRODUCTION_TASK_TEMPLATES[template.key].map((title, i) =>
          fetch('/api/tasks', { method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ projectId: freshProj.id, title, status: 'todo', sortOrder: i }) })
        );
        await Promise.all(taskPromises);
      }

      const fresh = await fetch('/api/data').then(r => r.json());
      const finalProj = fresh.projects.find(p => p.code === code);
      setData(fresh);
      setSelProject(finalProj || proj);
      setModal(`editProject:${finalProj?.id || proj.id}`);
      notify('Projet créé : ' + code);
    } catch {
      notify('Erreur réseau — projet non créé', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveEditProject = async (pid) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${pid}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(pf) });
      if (!res.ok) { notify(await readApiError(res), 'error'); return; }
      await refreshData();
      setFormDirty(false);
      setModal(null);
      notify('Projet mis à jour');
      setPf({});
    } catch {
      notify('Erreur réseau — projet non enregistré', 'error');
    } finally {
      setSaving(false);
    }
  };

  const savePPMPhase = async (pid, phaseKey, checked) => {
    const proj = data.projects.find(p => p.id === pid);
    const current = proj?.ppmPhases || {};
    const updated = { ...current, [phaseKey]: checked };
    await fetch(`/api/projects/${pid}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ppmPhases: updated }) });
    const fresh = await fetch('/api/data').then(r => r.json());
    setData(fresh);
    if (selProject?.id === pid) setSelProject(fresh.projects.find(p => p.id === pid));
  };

  const addPPMLog = async (pid, phaseKey) => {
    if (!ppmLogForm.loggedAt) return;
    await fetch('/api/ppm-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: pid, phaseKey, note: ppmLogForm.note, loggedAt: ppmLogForm.loggedAt }),
    });
    // Auto-mark phase as done when first log added
    const proj = data.projects.find(p => p.id === pid);
    if (!(proj?.ppmPhases || {})[phaseKey]) {
      await savePPMPhase(pid, phaseKey, true);
    }
    const fresh = await fetch('/api/data').then(r => r.json());
    setData(fresh);
    if (selProject?.id === pid) setSelProject(fresh.projects.find(p => p.id === pid));
    setPpmLogForm({ note: '', loggedAt: new Date().toISOString().slice(0, 10) });
  };

  const deletePPMLog = async (logId, pid) => {
    await fetch(`/api/ppm-logs/${logId}`, { method: 'DELETE' });
    const fresh = await fetch('/api/data').then(r => r.json());
    setData(fresh);
    if (selProject?.id === pid) setSelProject(fresh.projects.find(p => p.id === pid));
  };

  const saveInlineDate = async (pid, field, value) => {
    await fetch(`/api/projects/${pid}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ [field]: value }) });
    const updated = await fetch('/api/data').then(r => r.json());
    setData(updated);
    if (selProject && selProject.id === pid) {
      const p = updated.projects.find(x => x.id === pid);
      if (p) setSelProject(p);
    }
  };

  const deleteProject = async (pid) => {
    if (!(await confirm({ title: 'Supprimer ce projet ?', message: "C'est irréversible.", confirmLabel: 'Supprimer' }))) return;
    const res = await fetch(`/api/projects/${pid}`, { method: 'DELETE' }).catch(() => null);
    if (!res || !res.ok) { notify(res ? await readApiError(res) : 'Erreur réseau', 'error'); return; }
    await refreshData();
    setSelProject(null);
    notify('Projet supprimé');
  };

  const openEditProject = (p) => {
    // If project has a linked client, merge client data into form fields
    const linked = (data.clients || []).find(c => c.id === p.clientId);
    if (linked) {
      setPf({
        ...p,
        clientFirstName: p.clientFirstName || linked.firstName || '',
        clientLastName: p.clientLastName || linked.lastName || '',
        client: p.client || linked.company || '',
        clientEmail: p.clientEmail || linked.email || '',
        clientPhone: p.clientPhone || linked.phone || '',
        clientAddress: p.clientAddress || [linked.address, linked.postalCode, linked.city].filter(Boolean).join(', ') || '',
      });
    } else {
      setPf(p);
    }
    setModal(`editProject:${p.id}`);
  };

  const addExpense = async (pid) => {
    const proj = data.projects.find(p => p.id === pid);
    const bdcCount = proj.bdcCount || proj.bdc_count || 0;
    const BDC = ef.generateBDC ? generateBDCNumber(proj.code, bdcCount + 1) : "";
    const ht = parseFloat(ef.amountHT || 0);
    const rate = TVA_MAP[ef.tvaRate]?.rate || 0;
    const tvaAmount = ht * rate;
    const ttc = ht + tvaAmount;
    const exp = { id: `e_${Date.now()}`, projectId: pid, label: ef.label, amountHT: ht, tvaRate: ef.tvaRate || '20', tvaAmount, amount: ttc, category: ef.category || '', provider: ef.provider || '', providerId: ef.providerId || '', status: ef.status || 'pending', date: ef.date || new Date().toISOString().split('T')[0], notes: ef.notes || '', bdcNumber: BDC };
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/expenses', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(exp) });
      if (!res.ok) { notify(await readApiError(res), 'error'); return; }
      await refreshData();
      setEf({});
      setFormDirty(false);
      setModal(null);
      notify('Dépense ajoutée');
    } catch {
      notify('Erreur réseau — dépense non enregistrée', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteExpense = async (pid, eid) => {
    if (!(await confirm({ title: 'Supprimer cette dépense ?', confirmLabel: 'Supprimer' }))) return;
    const res = await fetch(`/api/expenses/${eid}`, { method: 'DELETE' }).catch(() => null);
    if (!res || !res.ok) { notify(res ? await readApiError(res) : 'Erreur réseau', 'error'); return; }
    await refreshData();
    notify('Dépense supprimée');
  };

  const addIpRevenue = async (pid) => {
    if (saving) return;
    setSaving(true);
    try {
      const rev = { id: `ip_${Date.now()}`, projectId: pid, source: ir.source || '', label: ir.label, amount: parseFloat(ir.amount || 0), date: ir.date || '', notes: ir.notes || '' };
      const res = await fetch('/api/ip-revenues', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(rev) });
      if (!res.ok) { notify(await readApiError(res), 'error'); return; }
      await refreshData();
      setIr({});
      setFormDirty(false);
      setModal(null);
      notify('Revenu IP ajouté');
    } catch {
      notify('Erreur réseau — revenu non enregistré', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteIpRevenue = async (pid, iid) => {
    if (!(await confirm({ title: 'Supprimer ce revenu IP ?', confirmLabel: 'Supprimer' }))) return;
    const res = await fetch(`/api/ip-revenues/${iid}`, { method: 'DELETE' }).catch(() => null);
    if (!res || !res.ok) { notify(res ? await readApiError(res) : 'Erreur réseau', 'error'); return; }
    await refreshData();
    notify('Revenu IP supprimé');
  };

  const selectProviderForExpense = (pid) => { uef("providerId", pid); uef("provider", data.providers.find(p => p.id === pid)?.name || ""); };

  const addProvider = async () => {
    const cats = provForm.categories || [];
    const prov = { id: `prov_${Date.now()}`, firstName: provForm.firstName || provForm.name || '', lastName: provForm.lastName || '', name: [provForm.firstName || provForm.name, provForm.lastName].filter(Boolean).join(' '), company: provForm.company || '', category: cats[0] || '', categories: cats, rating: provForm.rating || 0, tarifJour: parseFloat(provForm.tarifMin || provForm.tarifJour || 0), tarifMin: parseFloat(provForm.tarifMin || 0), tarifMax: parseFloat(provForm.tarifMax || 0), tvaRate: provForm.tvaRate || '20', siret: provForm.siret || '', email: provForm.email || '', phone: provForm.phone || '' };
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/providers', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(prov) });
      if (!res.ok) { notify(await readApiError(res), 'error'); return; }
      await refreshData();
      setProvForm({});
      setFormDirty(false);
      setModal(null);
      notify('Prestataire ajouté');
    } catch {
      notify('Erreur réseau — prestataire non enregistré', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteProvider = async (id) => {
    if (!(await confirm({ title: 'Supprimer ce prestataire ?', confirmLabel: 'Supprimer' }))) return;
    const res = await fetch(`/api/providers/${id}`, { method: 'DELETE' }).catch(() => null);
    if (!res || !res.ok) { notify(res ? await readApiError(res) : 'Erreur réseau', 'error'); return; }
    await refreshData();
    setSelProvider(null);
    notify('Prestataire supprimé');
  };

  const saveEditProvider = async (id) => {
    if (saving) return;
    setSaving(true);
    try {
      const displayName = [provForm.firstName, provForm.lastName].filter(Boolean).join(' ') || provForm.name || '';
      const payload = { ...provForm, name: displayName, category: (provForm.categories || [])[0] || '',
        tarifMin: parseFloat(provForm.tarifMin || 0), tarifMax: parseFloat(provForm.tarifMax || 0),
        tarifJour: parseFloat(provForm.tarifMin || provForm.tarifJour || 0) };
      const res = await fetch(`/api/providers/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
      if (!res.ok) { notify(await readApiError(res), 'error'); return; }
      await refreshData();
      setFormDirty(false);
      setModal(null);
      setProvForm({});
      notify('Prestataire mis à jour');
    } catch {
      notify('Erreur réseau — prestataire non enregistré', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── TASK CRUD ──
  const addTask = async (pid) => {
    if (!taskForm.title) return;
    await fetch('/api/tasks', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ projectId: pid, ...taskForm }) });
    const updated = await fetch('/api/data').then(r => r.json());
    setData(updated);
    const p = updated.projects.find(x => x.id === pid);
    if (p) setSelProject(p);
    setTaskForm({});
  };

  const addTaskInPhase = async (pid, phaseLabel, color) => {
    const title = newTaskInPhase.trim();
    if (!title) return;
    const existing = (data.projects.find(p => p.id === pid)?.tasks || []).length;
    await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: pid, title, status: 'todo', phaseGroup: phaseLabel, sortOrder: existing }) });
    const updated = await fetch('/api/data').then(r => r.json());
    setData(updated);
    const p = updated.projects.find(x => x.id === pid);
    if (p) setSelProject(p);
    setNewTaskInPhase('');
    setAddingInPhase(null);
  };

  const applyTemplate = async (pid, templateKey) => {
    const templateTasks = PRODUCTION_TASK_TEMPLATES[templateKey];
    if (!templateTasks) return;
    const currentProject = data.projects.find(p => p.id === pid);
    const existingCount = (currentProject?.tasks || []).length;
    if (existingCount > 0) {
      const ok = await confirm({
        title: 'Appliquer le template ?',
        message: `Ce projet a déjà ${existingCount} tâche(s). Ajouter quand même les tâches du template "${templateKey}" ?`,
        confirmLabel: 'Ajouter',
      });
      if (!ok) return;
    }
    setApplyingTemplate(templateKey);
    try {
      const templateGroups = TASK_PHASE_GROUPS[templateKey] || [];
      const phaseGroupMap = {};
      templateGroups.forEach(group => {
        group.tasks.forEach(t => { phaseGroupMap[t] = group.label; });
      });

      // Create production phases from template if they don't already exist
      const existingPhases = (currentProject?.phases || []);
      const existingPhaseNames = new Set(existingPhases.map(p => p.name));
      const existingSortMax = existingPhases.reduce((max, p) => Math.max(max, p.sortOrder || 0), -1);
      for (let i = 0; i < templateGroups.length; i++) {
        const group = templateGroups[i];
        if (!existingPhaseNames.has(group.label)) {
          const res = await fetch('/api/phases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: pid, name: group.label, color: group.color, sortOrder: existingSortMax + 1 + i })
          });
          if (!res.ok) throw new Error(`Erreur création phase "${group.label}"`);
        }
      }

      // Create tasks one by one (sequential) to avoid SQLite locking issues
      for (let i = 0; i < templateTasks.length; i++) {
        const title = templateTasks[i];
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: pid, title, status: 'todo', sortOrder: existingCount + i, phaseGroup: phaseGroupMap[title] || '' })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} pour "${title}"`);
      }
      const updated = await fetch('/api/data').then(r => r.json());
      setData(updated);
      const p = updated.projects.find(x => x.id === pid);
      if (p) setSelProject(p);
    } catch(e) {
      console.error('applyTemplate error:', e);
      alert(`Erreur : ${e.message}`);
    } finally {
      setApplyingTemplate(null);
    }
  };

  // ── PHASES CRUD ──
  const refreshProject = async (pid) => {
    const updated = await fetch('/api/data').then(r => r.json());
    setData(updated);
    if (pid) { const p = updated.projects.find(x => x.id === pid); if (p) setSelProject(p); }
  };

  const addPhase = async (pid) => {
    if (!phaseForm.name) return;
    const existing = (data.projects.find(p => p.id === pid)?.phases || []).length;
    await fetch('/api/phases', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: pid, ...phaseForm, sortOrder: existing }) });
    setPhaseForm({});
    await refreshProject(pid);
  };

  const updatePhase = async (phaseId, updates, pid) => {
    await fetch(`/api/phases/${phaseId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates) });
    await refreshProject(pid);
  };

  const deletePhase = async (phaseId, pid) => {
    await fetch(`/api/phases/${phaseId}`, { method: 'DELETE' });
    await refreshProject(pid);
  };

  const addPosting = async (pid, phaseId) => {
    await fetch('/api/postings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: pid, phaseId, ...postingForm }) });
    setPostingForm({ note: '', postedAt: new Date().toISOString().slice(0, 10) });
    setOpenPostingPhase(null);
    await refreshProject(pid);
  };

  const deletePosting = async (postingId, pid) => {
    await fetch(`/api/postings/${postingId}`, { method: 'DELETE' });
    await refreshProject(pid);
  };

  const updateTask = async (tid, updates, pid) => {
    await fetch(`/api/tasks/${tid}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(updates) });
    const updated = await fetch('/api/data').then(r => r.json());
    setData(updated);
    if (pid) { const p = updated.projects.find(x => x.id === pid); if (p) setSelProject(p); }
  };

  const deleteTask = async (tid, pid) => {
    await fetch(`/api/tasks/${tid}`, { method: 'DELETE' });
    const updated = await fetch('/api/data').then(r => r.json());
    setData(updated);
    if (pid) { const p = updated.projects.find(x => x.id === pid); if (p) setSelProject(p); }
  };

  const bulkUpdateTasks = async (ids, updates, pid) => {
    await Promise.all([...ids].map(id =>
      fetch(`/api/tasks/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(updates) })
    ));
    const updated = await fetch('/api/data').then(r => r.json());
    setData(updated);
    if (pid) { const p = updated.projects.find(x => x.id === pid); if (p) setSelProject(p); }
    setSelectedTasks(new Set());
  };

  const bulkDeleteTasks = async (ids, pid) => {
    await Promise.all([...ids].map(id => fetch(`/api/tasks/${id}`, { method: 'DELETE' })));
    const updated = await fetch('/api/data').then(r => r.json());
    setData(updated);
    if (pid) { const p = updated.projects.find(x => x.id === pid); if (p) setSelProject(p); }
    setSelectedTasks(new Set());
  };

  const moveTaskToPhase = async (taskId, newPhaseLabel) => {
    await fetch(`/api/tasks/${taskId}`, { method: 'PUT', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ phaseGroup: newPhaseLabel }) });
    const updated = await fetch('/api/data').then(r => r.json());
    setData(updated);
    const p = updated.projects.find(x => x.id === selProject?.id);
    if (p) setSelProject(p);
  };

  const togglePhaseValidation = async (pid, phaseLabel) => {
    const current = selProject.taskPhaseValidations || {};
    const updated = { ...current, [phaseLabel]: !current[phaseLabel] };
    await fetch(`/api/projects/${pid}`, { method: 'PUT', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ taskPhaseValidations: updated }) });
    const freshData = await fetch('/api/data').then(r => r.json());
    setData(freshData);
    const p = freshData.projects.find(x => x.id === pid);
    if (p) setSelProject(p);
  };

  // ── TEAM CRUD ──
  const addTeamMember = async () => {
    if (!teamForm.name) return;
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/team', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(teamForm) });
      if (!res.ok) { notify(await readApiError(res), 'error'); return; }
      await refreshData();
      setTeamForm({});
      setFormDirty(false);
      setModal(null);
      notify('Membre ajouté');
    } catch {
      notify('Erreur réseau — membre non enregistré', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateTeamMember = async (id, updates) => {
    if (saving) return false;
    setSaving(true);
    try {
      const res = await fetch(`/api/team/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(updates) });
      if (!res.ok) { notify(await readApiError(res), 'error'); return false; }
      await refreshData();
      notify('Membre mis à jour');
      return true;
    } catch {
      notify('Erreur réseau — membre non enregistré', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteTeamMember = async (id) => {
    if (!(await confirm({ title: 'Retirer ce membre ?', confirmLabel: 'Retirer' }))) return;
    const res = await fetch(`/api/team/${id}`, { method: 'DELETE' }).catch(() => null);
    if (!res || !res.ok) { notify(res ? await readApiError(res) : 'Erreur réseau', 'error'); return; }
    await refreshData();
    notify('Membre retiré');
  };

  // ── DATE RANGE FILTER HELPER ──
  const getDateRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    switch (filterDateRange) {
      case "thisMonth":
        return { start: new Date(year, month, 1), end: new Date(year, month + 1, 0) };
      case "last3Months":
        return { start: new Date(year, month - 2, 1), end: new Date(year, month + 1, 0) };
      case "thisYear":
        return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
      default:
        return { start: null, end: null };
    }
  };

  // ── FILTERED DATA ──
  const filteredProjects = (() => {
    const STAGE_ORDER = ["lead","need","qualify","quoted","negotiation","signed","active","delivered","paid","lost"];
    let list = data.projects.filter(p => {
      const matchSearch = searchQuery === "" ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.client || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchPillar = filterPillar === "All" || p.pillar === filterPillar;
      const matchStage = filterStage === "All" || p.stage === filterStage;
      const matchClient = filterClient === "All" || (p.client || "").toLowerCase().includes(filterClient.toLowerCase()) || p.clientId === filterClient;
      return matchSearch && matchPillar && matchStage && matchClient;
    });
    switch (projSort) {
      case "revenue_desc": list = [...list].sort((a, b) => (b.revenue || 0) - (a.revenue || 0)); break;
      case "revenue_asc":  list = [...list].sort((a, b) => (a.revenue || 0) - (b.revenue || 0)); break;
      case "name_asc":     list = [...list].sort((a, b) => (a.name || "").localeCompare(b.name || "")); break;
      case "stage":        list = [...list].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage)); break;
      case "date_asc":     list = [...list].sort((a, b) => (a.createdAt || "") < (b.createdAt || "") ? -1 : 1); break;
      case "date_desc":
      default:             list = [...list].sort((a, b) => (b.createdAt || "") < (a.createdAt || "") ? -1 : 1); break;
    }
    return list;
  })();

  const filteredExpenses = data.projects.flatMap(p => 
    (p.expenses || []).filter(e => {
      const matchSearch = searchQuery === "" ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.label || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchPillar = filterPillar === "All" || p.pillar === filterPillar;
      
      return matchSearch && matchPillar;
    }).map(e => ({ ...e, projectCode: p.code, projectName: p.name, projectId: p.id }))
  );

  // ── CALCULATIONS ──
  const pipelineByStage = Object.fromEntries(
    PIPELINE_STAGES.map(s => [
      s.key,
      data.projects.filter(p => p.stage === s.key).reduce((sum, p) => sum + (p.revenue || 0), 0),
    ])
  );

  const pipelineTotal = Object.values(pipelineByStage).reduce((a, b) => a + b, 0);
  const confirmedRevenue = (pipelineByStage.signed || 0) + (pipelineByStage.active || 0) + (pipelineByStage.delivered || 0) + (pipelineByStage.paid || 0);
  const potentialRevenue = (pipelineByStage.lead || 0) + (pipelineByStage.need || 0) + (pipelineByStage.qualify || 0) + (pipelineByStage.quoted || 0) + (pipelineByStage.negotiation || 0);
  const totalExpenses = data.projects.reduce((sum, p) => sum + (p.expenses || []).reduce((s, e) => s + (e.amount || 0), 0), 0);
  const totalMargin = confirmedRevenue > 0 ? ((confirmedRevenue - totalExpenses) / confirmedRevenue * 100) : 0;

  const quotedOrLater = data.projects.filter(p => ["quoted", "negotiation", "signed", "active", "delivered", "paid"].includes(p.stage));
  const wonProjects = data.projects.filter(p => ["signed", "active", "delivered", "paid"].includes(p.stage));
  const lostProjects = data.projects.filter(p => p.stage === "lost");
  const conversionRate = quotedOrLater.length > 0 ? (wonProjects.length / quotedOrLater.length * 100) : 0;

  // Relances : Proposal sans réponse ou Qualify/Negotiation sans activité depuis 7j
  const now_ = new Date();
  const toFollowUp = data.projects.filter(p => {
    if (!["quoted", "negotiation", "qualify"].includes(p.stage)) return false;
    const journal = Array.isArray(p.projectJournal) ? p.projectJournal : [];
    if (journal.length === 0) return true; // pas de journal → à relancer
    const lastDate = journal.reduce((best, e) => {
      const d = new Date(e.date || e.loggedAt || e.createdAt || 0);
      return d > best ? d : best;
    }, new Date(0));
    const daysSince = Math.ceil((now_ - lastDate) / 86400000);
    return daysSince >= 7; // relancer seulement si inactif depuis 7j+
  }).map(p => {
    const journal = Array.isArray(p.projectJournal) ? p.projectJournal : [];
    const lastDate = journal.length > 0 ? journal.reduce((best, e) => {
      const d = new Date(e.date || e.loggedAt || e.createdAt || 0);
      return d > best ? d : best;
    }, new Date(0)) : null;
    const daysSince = lastDate ? Math.ceil((now_ - lastDate) / 86400000) : null;
    return {
      ...p,
      reason: p.stage === "quoted" ? `Proposal envoyée${daysSince ? ` · ${daysSince}j sans réponse` : ""}`
            : p.stage === "qualify" ? `À qualifier${daysSince ? ` · ${daysSince}j` : ""}`
            : `En négociation${daysSince ? ` · ${daysSince}j sans news` : ""}`,
    };
  });

  const overdueExpenses = data.projects.flatMap(p => (p.expenses || []).filter(e => e.status === "overdue")).length;

  let nextMove = null;
  if (data.projects.length === 0) {
    nextMove = { action: "Créer ton premier projet", project: null, color: "var(--gold)" };
  } else if (data.projects.filter(p => p.stage === "delivered").length > 0) {
    // Paiement en attente — priorité absolue
    const p = data.projects.filter(p => p.stage === "delivered")[0];
    nextMove = { action: "Relancer le paiement", project: p, color: "var(--danger)" };
  } else if (toFollowUp.length > 0) {
    // Devis ou négo en cours — relancer le client
    nextMove = { action: "Relancer", project: toFollowUp[0], color: "var(--gold)" };
  } else if (data.projects.filter(p => p.stage === "active").length > 0) {
    // Projet en cours — livrer
    const p = data.projects.filter(p => p.stage === "active")[0];
    nextMove = { action: "Livrer", project: p, color: "var(--success)" };
  } else if (data.projects.filter(p => p.stage === "signed").length > 0) {
    // Projet signé — démarrer
    const p = data.projects.filter(p => p.stage === "signed")[0];
    nextMove = { action: "Démarrer", project: p, color: "var(--success)" };
  } else if (data.projects.filter(p => p.stage === "qualify").length > 0) {
    const p = data.projects.filter(p => p.stage === "qualify")[0];
    nextMove = { action: "Envoyer la Proposal", project: p, color: "var(--warning)" };
  } else if (data.projects.filter(p => p.stage === "need").length > 0) {
    const p = data.projects.filter(p => p.stage === "need")[0];
    nextMove = { action: "Qualifier", project: p, color: "var(--warning)" };
  } else if (data.projects.filter(p => p.stage === "lead").length > 0) {
    const p = data.projects.filter(p => p.stage === "lead")[0];
    nextMove = { action: "Establish Need", project: p, color: "var(--gold)" };
  } else {
    // Rien en cours — aller chercher de nouveaux projets
    nextMove = { action: "Prospecter", project: null, color: "var(--text-3)" };
  }

  // ── ALERTS ──
  const alerts = [];
  const now = new Date();
  data.projects.forEach(p => {
    if (p.stage === "negotiation") {
      const daysSince = Math.floor((now - new Date(p.createdDate)) / (1000 * 60 * 60 * 24));
      if (daysSince > 21) {
        alerts.push({ type: "warning", icon: "🤝", title: `Négociation depuis ${daysSince}j — ${p.code}`, desc: `${p.name} — ${p.client || "—"} — relance importante`, projectId: p.id });
      }
    }
    if (p.stage === "quoted") {
      const daysSince = Math.floor((now - new Date(p.createdDate)) / (1000 * 60 * 60 * 24));
      if (daysSince > 7) {
        alerts.push({ type: "warning", icon: "04", title: `Proposal sans réponse depuis ${daysSince}j — ${p.code}`, desc: `${p.name} — ${p.client || "—"} — relancer le client`, projectId: p.id });
      }
    }
    if (p.stage === "qualify") {
      const daysSince = Math.floor((now - new Date(p.createdDate)) / (1000 * 60 * 60 * 24));
      if (daysSince > 14) {
        alerts.push({ type: "info", icon: "03", title: `Qualification en attente depuis ${daysSince}j — ${p.code}`, desc: `${p.name} — confirmer budget, timing et besoin avant d'envoyer la Proposal`, projectId: p.id });
      }
    }

    (p.expenses || []).forEach(e => {
      if (e.status === "pending" && e.date) {
        const daysSince = Math.floor((now - new Date(e.date)) / (1000 * 60 * 60 * 24));
        if (daysSince > 30) {
          alerts.push({ type: "warning", icon: "🕐", title: `En attente depuis ${daysSince}j — ${e.bdcNumber || e.label}`, desc: `${p.code} · ${e.provider || ""} · ${e.amount.toFixed(0)}€ · devrait passer en retard ?`, projectId: p.id });
        }
      }
    });

    // Projet signé sans revenu renseigné
    if (["signed", "active", "delivered"].includes(p.stage) && (!p.revenue || p.revenue === 0)) {
      alerts.push({ type: "info", icon: "💡", title: `Revenu non renseigné — ${p.code}`, desc: `${p.name} est "${STAGE_MAP[p.stage]?.label}" mais pas de revenu facturé`, projectId: p.id });
    }

    // Projet livré mais pas payé
    if (p.stage === "delivered") {
      // Extraire le délai de paiement en jours depuis les conditions du projet ou celles par défaut
      const terms = p.paymentTerms || settings?.paymentTerms || "";
      const termDays = (() => {
        if (!terms || terms === "") return 30; // défaut 30j
        if (/comptant/i.test(terms)) return 0;
        if (/30.*commande|50.*commande/i.test(terms)) return 0; // acompte → solde à la livraison
        const match = terms.match(/(\d+)\s*jours?/i);
        return match ? parseInt(match[1]) : 30;
      })();
      const deliveredDays = p.endDate ? Math.floor((now - new Date(p.endDate)) / (1000 * 60 * 60 * 24)) : null;
      const daysOverdue = deliveredDays !== null ? deliveredDays - termDays : null;
      // Pas encore à échéance → pas d'alerte
      if (daysOverdue !== null && daysOverdue < 0) {
        const daysLeft = Math.abs(daysOverdue);
        alerts.push({ type: "info", icon: "📦", title: `Paiement attendu dans ${daysLeft}j — ${p.code}`, desc: `${p.name} · ${(p.revenue || 0).toLocaleString()}€ · Échéance : ${termDays}j (${terms || "défaut"})`, projectId: p.id });
      } else if (daysOverdue !== null) {
        // Échéance dépassée
        const urgency = daysOverdue > 14 ? "danger" : daysOverdue > 0 ? "warning" : "warning";
        const overdueStr = daysOverdue > 0 ? ` — ${daysOverdue}j de retard` : " — échéance aujourd'hui";
        alerts.push({ type: urgency, icon: "📦", title: `Paiement en retard${overdueStr} — ${p.code}`, desc: `${p.name} · ${(p.revenue || 0).toLocaleString()}€ · Délai ${termDays}j dépassé. Relance client urgente.`, projectId: p.id });
      } else {
        // Pas de date de livraison connue
        alerts.push({ type: "info", icon: "📦", title: `Paiement en attente — ${p.code}`, desc: `${p.name} · ${(p.revenue || 0).toLocaleString()}€ · Renseigne la date de fin pour suivre l'échéance.`, projectId: p.id });
      }
    }
  });

  // ── ALERTES PRÉ-DEADLINE ──
  data.projects.forEach(p => {
    if (!p.endDate || !["signed", "active"].includes(p.stage)) return;
    const end = new Date(p.endDate);
    const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    const fmt = p.endDate; // already YYYY-MM-DD
    if (daysLeft < 0) {
      alerts.push({ type: "danger", icon: "🔥", title: `Deadline dépassée de ${Math.abs(daysLeft)}j — ${p.code}`, desc: `${p.name} — prévu le ${fmt}. Livraison urgente ou recadrage client.`, projectId: p.id });
    } else if (daysLeft <= 3) {
      alerts.push({ type: "danger", icon: "⏰", title: `J-${daysLeft} — ${p.code}`, desc: `${p.name} — livraison dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}. Tout est prêt ?`, projectId: p.id });
    } else if (daysLeft <= 7) {
      alerts.push({ type: "warning", icon: "📅", title: `J-${daysLeft} — ${p.code}`, desc: `${p.name} — dans ${daysLeft} jours. Anticiper la validation client.`, projectId: p.id });
    } else if (daysLeft <= 14) {
      alerts.push({ type: "info", icon: "📅", title: `J-${daysLeft} — ${p.code}`, desc: `${p.name} — deadline dans 2 semaines (${fmt}).`, projectId: p.id });
    }
  });

  // Conversion rate alert
  if (wonProjects.length + lostProjects.length >= 5 && conversionRate > 80) {
    alerts.push({ type: "info", icon: "💰", title: "Taux de conversion très élevé", desc: `${conversionRate.toFixed(0)}% — tes prix sont peut-être trop bas. Challenge ta fourchette.` });
  }

  // ── SCALING UP ALERTS (Chris Do Module 07) ──
  const avgTJM = (data.providers || []).filter(p => p.tarifJour > 0).reduce((s, p, _, a) => s + p.tarifJour / a.length, 0);

  data.projects.forEach(p => {
    if (p.hoursSpent > 0 && p.revenue > 0) {
      const ehr = p.revenue / p.hoursSpent;
      // EHR < TJM moyen des prestataires = tu subsidises le client
      if (avgTJM > 0 && ehr < avgTJM) {
        alerts.push({ type: "danger", icon: "🔥", title: `EHR trop bas — ${p.code}`, desc: `${ehr.toFixed(0)}€/h < TJM moyen prestas (${avgTJM.toFixed(0)}€/j÷8 = ${(avgTJM/8).toFixed(0)}€/h). Tu subsidises le client. (Chris Do: "Price the transformation")`, projectId: p.id });
      }
    }
    // Marge < 40% sur projet signé/actif/livré
    if (["signed", "active", "delivered"].includes(p.stage) && p.revenue > 0) {
      const cogs = (p.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
      const margin = (p.revenue - cogs) / p.revenue;
      if (cogs > 0 && margin < 0.4) {
        alerts.push({ type: "warning", icon: "📉", title: `Marge faible — ${p.code}`, desc: `${(margin * 100).toFixed(0)}% de marge. Vise > 50%. (Scaling Up: Profit brut = Revenu - COGS)`, projectId: p.id });
      }
    }
  });

  const dangerAlerts = alerts.filter(a => a.type === "danger");
  const warningAlerts = alerts.filter(a => a.type === "warning");
  const infoAlerts = alerts.filter(a => a.type === "info");
  const sortedAlerts = [...dangerAlerts, ...warningAlerts, ...infoAlerts];

  const ALERT_STYLES = {
    danger: { bg: "var(--danger-soft)", border: "var(--danger-soft)", color: "var(--danger)" },
    warning: { bg: "var(--gold-soft)", border: "var(--gold-hover)", color: "var(--gold)" },
    info: { bg: "var(--success-soft)", border: "var(--success-soft)", color: "var(--success)" },
  };

  // ── DATA FOR CHARTS (Overview page) ──
  const pipelineFunnelData = PIPELINE_STAGES.map(s => ({
    name: s.label,
    value: pipelineByStage[s.key] || 0,
    color: s.color,
  }));

  // ── Monthly revenue by pillar (attribution sur endDate, fallback startDate) ──
  const WON_STAGES_REV = ["signed","active","delivered","paid"];
  const grioStats = data.griothequeStats || { caConfirmed: 0, caPending: 0, sessionsCount: 0, apprenantsCount: 0, monthlyCA: {} };
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const monthStr = new Date(chartYear, i, 1).toLocaleDateString("fr-FR", { month: "short" });
    const monthKey = `${chartYear}-${String(i + 1).padStart(2, '0')}`;
    const monthProjects = data.projects.filter(p => {
      const dateStr = p.endDate || p.startDate;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getFullYear() === chartYear && d.getMonth() === i && WON_STAGES_REV.includes(p.stage);
    });
    const STU = monthProjects.filter(p => p.pillar === "STUDIO").reduce((s, p) => s + (p.revenue || 0), 0);
    const PRD = monthProjects.filter(p => p.pillar === "PROD").reduce((s, p) => s + (p.revenue || 0), 0);
    // FOR = projets GRIOTHEQUE classiques + CA inscriptions formations (ce mois)
    const FORprojects = monthProjects.filter(p => p.pillar === "GRIOTHEQUE").reduce((s, p) => s + (p.revenue || 0), 0);
    const FORformations = grioStats.monthlyCA?.[monthKey] || 0;
    const FOR = FORprojects + FORformations;
    const dépenses = data.projects.flatMap(p => p.expenses || [])
      .filter(e => { if (!e.date) return false; const d = new Date(e.date); return d.getFullYear() === chartYear && d.getMonth() === i; })
      .reduce((s, e) => s + (e.amount || 0), 0);
    return { month: monthStr, STU: Math.round(STU), PRD: Math.round(PRD), FOR: Math.round(FOR), Dépenses: Math.round(dépenses), total: Math.round(STU + PRD + FOR) };
  });

  // ── Pipeline forecast — CA pondéré par probabilité de closing ──
  const STAGE_PROBA = { lead: 0.05, need: 0.10, qualify: 0.25, quoted: 0.50, negotiation: 0.75, signed: 1, active: 1, delivered: 1 };
  const now30 = new Date(); now30.setDate(now30.getDate() + 30);
  const now60 = new Date(); now60.setDate(now60.getDate() + 60);
  const now90 = new Date(); now90.setDate(now90.getDate() + 90);
  const forecastProjects = data.projects.filter(p => STAGE_PROBA[p.stage] !== undefined && p.stage !== "paid" && p.stage !== "lost" && (p.revenue || 0) > 0);
  const weightedTotal = forecastProjects.reduce((s, p) => s + (p.revenue || 0) * (STAGE_PROBA[p.stage] || 0), 0);
  const closing30 = forecastProjects.filter(p => p.endDate && new Date(p.endDate) <= now30 && !["delivered","paid"].includes(p.stage));
  const closing60 = forecastProjects.filter(p => p.endDate && new Date(p.endDate) > now30 && new Date(p.endDate) <= now60);
  const revenueThisYear = monthlyData.reduce((s, m) => s + m.total, 0);
  const availableYears = [...new Set(data.projects.map(p => p.endDate || p.startDate).filter(Boolean).map(d => new Date(d).getFullYear()))].sort((a,b) => b-a);

  const expenseCategoryData = Object.entries(
    data.projects.flatMap(p => p.expenses || []).reduce((acc, e) => {
      acc[e.category || "Autre"] = (acc[e.category || "Autre"] || 0) + (e.amount || 0);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value: Math.round(value) }));

  const revenueByPillarData = Object.entries(
    data.projects.reduce((acc, p) => {
      const pillarLabel = PILLAR_MAP[p.pillar]?.label || p.pillar;
      acc[pillarLabel] = (acc[pillarLabel] || 0) + (p.revenue || 0);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value: Math.round(value) }));

  const COLORS = ["var(--gold)", "var(--success)", "var(--danger)", "var(--warning)", "var(--pillar-prod)", "var(--info)", "var(--text-3)", "var(--text-2)"];

  // ── RENDER ──
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "'Geist Sans', 'DM Sans', sans-serif", display: "flex" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      {/* Mobile hamburger */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)} className="sidebar-toggle" style={{
        display: "none", position: "fixed", top: 12, left: 12, zIndex: 200,
        background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8,
        color: "var(--gold)", padding: "8px 10px", cursor: "pointer", fontSize: 18, lineHeight: 1,
      }}>☰</button>

      {/* Sidebar backdrop (mobile) */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} style={{
        display: "none", position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 99,
      }} />}

      <style dangerouslySetInnerHTML={{ __html: `
        /* ── Tablet (≤1024px) ── */
        @media (max-width: 1024px) {
          .os-main > div[style*="padding: 28px 32px"] { padding: 20px 16px !important; }
          .os-main > div > div[style*="padding: 10px 32px"] { padding: 10px 16px !important; }
        }

        /* ── Mobile (≤768px) ── */
        @media (max-width: 768px) {
          .sidebar-toggle { display: flex !important; }
          .sidebar-backdrop { display: block !important; }
          .os-sidebar { position: fixed !important; z-index: 100 !important; transform: translateX(${sidebarOpen ? '0' : '-100%'}) !important; transition: transform 0.25s ease !important; }
          .os-main { margin-left: 0 !important; }

          /* Padding global */
          .os-main > div[style*="padding: 28px 32px"] { padding: 14px 12px !important; }
          .os-main > div > div[style*="padding: 10px 32px"] { padding: 8px 12px !important; }

          /* Grids → single column */
          .os-main div[style*="gridTemplateColumns: \\"1fr 1fr 1fr\\""],
          .os-main div[style*="gridTemplateColumns: \\"1fr 1fr\\""] {
            grid-template-columns: 1fr !important;
          }
          .os-main div[style*="grid-template-columns: 1fr 1fr 1fr"],
          .os-main div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }

          /* Stat cards → wrap */
          .os-main div[style*="flex: \\"1 1 170px\\""] { min-width: 100% !important; }

          /* Pipeline columns → horizontal scroll hint */
          .os-main div[style*="overflowX: \\"auto\\""] { -webkit-overflow-scrolling: touch; }

          /* Tables → scroll horizontally */
          .os-main table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }

          /* Flex rows → wrap on mobile */
          .os-main div[style*="display: \\"flex\\","][style*="gap:"] { flex-wrap: wrap !important; }

          /* Modal → full width */
          .os-main div[style*="maxWidth: 580"] { max-width: 95vw !important; width: 95vw !important; }
        }

        /* ── Small phone (≤480px) ── */
        @media (max-width: 480px) {
          .os-main div[style*="padding: \\"18px 22px\\""] { padding: 12px 14px !important; }
          .os-main div[style*="fontSize: 26"] { font-size: 20px !important; }
          .os-main div[style*="fontSize: 22"] { font-size: 18px !important; }
        }
      `}} />

      {/* SIDEBAR */}
      <aside className="os-sidebar" style={{
        width: 220, minWidth: 220, height: "100vh", background: "var(--bg)",
        borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column",
        position: "sticky", top: 0, overflow: "hidden", flexShrink: 0,
      }}>
        {/* Logo */}
        <div onClick={() => { setView("overview"); setSelProject(null); }} style={{
          cursor: "pointer", padding: "16px 18px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 10, userSelect: "none",
        }}>
          <img src="/logo.png" alt="LES GRIOTS" style={{ height: 32, borderRadius: 4, objectFit: "contain" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)", letterSpacing: "0.06em", fontFamily: "'Space Mono', monospace" }}>OS</span>
        </div>

        {/* Cmd+K search trigger */}
        <div style={{ padding: "10px 12px 6px" }}>
          <button onClick={() => setCmdPaletteOpen(true)} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 6,
            border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-3)", fontSize: 12, fontFamily: "inherit", cursor: "pointer",
            transition: "border-color 0.15s, color 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-3)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-3)'; }}>
            <span style={{ fontSize: 12 }}>⌕</span>
            <span>Rechercher…</span>
            <kbd style={{ marginLeft: "auto", padding: "1px 5px", borderRadius: 3, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 9, fontFamily: "'Space Mono', monospace", color: "var(--text-3)" }}>⌘K</kbd>
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: "8px 8px", display: "flex", flexDirection: "column", gap: 1, overflowY: "auto" }}>
          {[
            { k: "overview",  l: "Vue d'ensemble", icon: "◈" },
            { type: "divider", label: "AGENCE" },
            { k: "pipeline",  l: "Pipeline",        icon: "⟶" },
            { k: "clients",   l: "Clients",         icon: "◑" },
            { k: "providers", l: "Prestataires",    icon: "◉" },
            { type: "divider", label: "PRODUCTION" },
            { k: "projects",  l: "Projets",         icon: "▣" },
            { k: "expenses",  l: "Dépenses",        icon: "◎" },
            { k: "team",      l: "Team",            icon: "◐" },
            { k: "tasks",     l: "Tâches",          icon: "☑" },
            { k: "calendar",  l: "Calendrier",     icon: "📅" },
            { type: "divider", label: "GRIOTHÈQUE" },
            { k: "griotheque", l: "Formations",     icon: "📚", href: "/formations" },
            { k: "griotheque-sessions", l: "Sessions", icon: "📅", href: "/formations?tab=sessions" },
            { k: "griotheque-apprenants", l: "Apprenants", icon: "🎓", href: "/formations?tab=apprenants" },
          ].map((t, i) => {
            if (t.type === "divider") {
              return <div key={i} style={{
                fontSize: 10, fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.1em",
                padding: "14px 10px 5px", userSelect: "none",
              }}>{t.label}</div>;
            }
            if (t.href) {
              return <a key={t.k} href={t.href} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                borderRadius: 6, color: "var(--gold)", textDecoration: "none",
                fontSize: 13, fontWeight: 500, transition: "background 0.15s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ fontSize: 12, opacity: 0.8, width: 18, textAlign: "center" }}>{t.icon}</span>
                {t.l}
              </a>;
            }
            const isActive = view === t.k;
            return (
              <button key={t.k} onClick={() => { setView(t.k); setSelProject(null); setSidebarOpen(false); }} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                borderRadius: 6, border: "none", width: "100%", textAlign: "left",
                background: isActive ? "var(--gold-soft)" : "transparent",
                color: isActive ? "var(--gold)" : "var(--text-3)",
                fontSize: 13, fontWeight: isActive ? 600 : 400, cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.15s", position: "relative",
              }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-3)'; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)'; } }}>
                {isActive && <div style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 3, borderRadius: 2, background: "var(--gold)" }} />}
                <span style={{ fontSize: 12, opacity: 0.7, width: 18, textAlign: "center" }}>{t.icon}</span>
                {t.l}
                {t.k === "overview" && dangerAlerts.length > 0 && (
                  <span style={{
                    width: 16, height: 16, borderRadius: "50%", background: "var(--danger)",
                    color: "var(--on-solid)", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "auto",
                  }}>{dangerAlerts.length}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Settings at bottom */}
        <div style={{ padding: "8px 8px", borderTop: "1px solid var(--border)" }}>
          <button onClick={() => { setView("settings"); setSelProject(null); setSidebarOpen(false); }} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", width: "100%",
            borderRadius: 6, border: "none", textAlign: "left",
            background: view === "settings" ? "var(--gold-soft)" : "transparent",
            color: view === "settings" ? "var(--gold)" : "var(--text-3)",
            fontSize: 13, fontWeight: view === "settings" ? 600 : 400, cursor: "pointer", fontFamily: "inherit",
            transition: "all 0.15s",
          }}
            onMouseEnter={e => { if (view !== "settings") { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-3)'; } }}
            onMouseLeave={e => { if (view !== "settings") { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)'; } }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>⚙</span>
            Paramètres
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="os-main" style={{ flex: 1, minWidth: 0, overflowY: "auto", height: "100vh" }}>

      {/* SEARCH & FILTER BAR — visible seulement sur les vues pertinentes */}
      {["overview", "pipeline", "projects", "clients", "expenses", "providers"].includes(view) && (
        <div style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)", padding: "10px 32px" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", fontSize: 13, pointerEvents: "none" }}>⌕</span>
              <input data-search-global type="text" placeholder="Rechercher partout… (⌘K)" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                style={{ width: "100%", padding: "7px 12px 7px 28px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
            </div>
            {["overview","pipeline","projects","expenses"].includes(view) && (
              <select value={filterPillar} onChange={e => setFilterPillar(e.target.value)}
                style={{ padding: "7px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: filterPillar !== "All" ? "var(--gold)" : "var(--text-3)", fontSize: 12, fontFamily: "inherit", cursor: "pointer", outline: "none" }}>
                <option value="All">Pilier: Tous</option>
                <option value="STUDIO">STU — Studio</option>
                <option value="PROD">PRD — Production</option>
                <option value="GRIOTHEQUE">FOR — Griothèque</option>
              </select>
            )}
            {["overview","pipeline","projects"].includes(view) && (
              <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
                style={{ padding: "7px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: filterStage !== "All" ? "var(--gold)" : "var(--text-3)", fontSize: 12, fontFamily: "inherit", cursor: "pointer", outline: "none" }}>
                <option value="All">Stage: Tous</option>
                {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            )}
            {view === "projects" && (() => {
              const clientNames = [...new Set((data.projects || []).map(p => p.client).filter(Boolean))].sort();
              return clientNames.length > 0 ? (
                <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
                  style={{ padding: "7px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: filterClient !== "All" ? "var(--gold)" : "var(--text-3)", fontSize: 12, fontFamily: "inherit", cursor: "pointer", outline: "none", maxWidth: 160 }}>
                  <option value="All">Client: Tous</option>
                  {clientNames.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : null;
            })()}
            <select value={filterDateRange} onChange={e => setFilterDateRange(e.target.value)}
              style={{ padding: "7px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: filterDateRange !== "all" ? "var(--gold)" : "var(--text-3)", fontSize: 12, fontFamily: "inherit", cursor: "pointer", outline: "none" }}>
              <option value="all">Période: Toutes</option>
              <option value="thisMonth">Ce mois</option>
              <option value="last3Months">3 derniers mois</option>
              <option value="thisYear">Cette année</option>
            </select>
          </div>
        </div>
      )}

      <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }}>

        {/* ── BREADCRUMBS + PINNED BAR ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Breadcrumbs items={(() => {
            const base = { label: "LES GRIOTS OS", onClick: () => { setView("overview"); setSelProject(null); setSelClient(null); setSelProvider(null); } };
            const viewLabels = { overview: "Vue d'ensemble", pipeline: "Pipeline", projects: "Projets", clients: "Clients", expenses: "Dépenses", providers: "Prestas", team: "Team", settings: "Paramètres" };
            const crumbs = [base];
            if (view !== "overview") crumbs.push(
              selProject || selClient || selProvider
                ? { label: viewLabels[view] || view, onClick: () => { setSelProject(null); setSelClient(null); setSelProvider(null); } }
                : { label: viewLabels[view] || view }
            );
            if (selProject) crumbs.push({ label: `${selProject.code || ''} — ${selProject.name || 'Projet'}` });
            if (selClient) crumbs.push({ label: [selClient.first_name, selClient.last_name].filter(Boolean).join(' ') || selClient.company || 'Client' });
            if (selProvider) crumbs.push({ label: [selProvider.first_name, selProvider.last_name].filter(Boolean).join(' ') || selProvider.name || 'Presta' });
            return crumbs;
          })()} />
          {selProject && (
            <button onClick={() => togglePin(selProject.id)} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6,
              border: `1px solid ${pinnedProjects.includes(selProject.id) ? 'var(--gold)' : 'var(--border)'}`,
              background: pinnedProjects.includes(selProject.id) ? 'var(--gold-soft)' : 'transparent',
              color: pinnedProjects.includes(selProject.id) ? 'var(--gold)' : 'var(--text-3)',
              fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 13 }}>{pinnedProjects.includes(selProject.id) ? '★' : '☆'}</span>
              {pinnedProjects.includes(selProject.id) ? 'Épinglé' : 'Épingler'}
            </button>
          )}
        </div>

        {/* Pinned projects bar */}
        <PinnedBar
          pinnedIds={pinnedProjects}
          projects={data.projects || []}
          onSelect={(p) => { setView("projects"); setSelProject(p); }}
          onUnpin={(id) => togglePin(id)}
        />

        {/* ═══ OVERVIEW VIEW ═══ */}
        {view === "overview" && (
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            {/* ── Main content (scrollable) ── */}
            <div style={{ flex: 1, minWidth: 0 }}>
            {/* Greeting + Configurateur */}
            <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                  {new Date().getHours() < 12 ? "Bonjour" : new Date().getHours() < 18 ? "Bon après-midi" : "Bonsoir"}, Moos.
                </h2>
                <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", position: "relative" }}>
                <button onClick={() => setShowDashConfig(!showDashConfig)} style={{
                  padding: "5px 14px", background: showDashConfig ? "var(--gold-soft)" : "transparent",
                  border: `1px solid ${showDashConfig ? "var(--gold)" : "var(--border)"}`, borderRadius: 6,
                  color: showDashConfig ? "var(--gold)" : "var(--text-3)", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 5,
                }}>⚙ Personnaliser</button>

                {/* ── Panneau de configuration grille ── */}
                {showDashConfig && (
                  <div onClick={e => e.stopPropagation()} style={{
                    position: "absolute", top: "100%", right: 0, marginTop: 8, background: "var(--surface)",
                    border: "1px solid var(--border)", borderRadius: 12, padding: "20px", zIndex: 200, width: 420,
                    boxShadow: "var(--shadow-lg)", maxHeight: "70vh", overflowY: "auto",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Personnaliser la grille</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={resetGridLayout} style={{ fontSize: 10, color: "var(--text-3)", background: "none", border: "1px solid var(--border)", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>↩ Réinitialiser</button>
                        <button onClick={() => setShowDashConfig(false)} style={{ fontSize: 12, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>✕</button>
                      </div>
                    </div>

                    {/* All blocks in unified list */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Tous les blocs</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {ALL_GRID_BLOCKS.map(b => {
                          const item = gridLayout.find(g => g.key === b.key);
                          const visible = item?.visible || false;
                          const size = item?.size || "half";
                          return (
                            <div key={b.key} style={{
                              display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                              background: visible ? "var(--surface)" : "var(--bg)", border: `1px solid ${visible ? "var(--border)" : "var(--border)"}`,
                              borderRadius: 8, transition: "all 0.15s",
                            }}
                              onMouseEnter={e => e.currentTarget.style.borderColor = visible ? "var(--gold-hover)" : "var(--border)"}
                              onMouseLeave={e => e.currentTarget.style.borderColor = visible ? "var(--border)" : "var(--border)"}
                            >
                              <div onClick={() => toggleGridBlock(b.key)} style={{
                                width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${visible ? "var(--gold)" : "var(--border-2)"}`,
                                background: visible ? "var(--gold)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0, transition: "all 0.15s", cursor: "pointer",
                              }}>
                                {visible && <span style={{ color: "var(--gold-ink)", fontSize: 11, fontWeight: 700 }}>✓</span>}
                              </div>
                              <span style={{ fontSize: 16, flexShrink: 0 }}>{b.icon}</span>
                              <span style={{ fontSize: 12, color: visible ? "var(--text)" : "var(--text-3)", flex: 1 }}>{b.label}</span>
                              {visible && (
                                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                  <button onClick={() => resizeGridBlock(b.key)} style={{ fontSize: 9, padding: "2px 6px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--gold)", cursor: "pointer", fontFamily: "inherit" }}>{size === "full" ? "full" : "1/2"}</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 10, color: "var(--text-3)", lineHeight: 1.5 }}>
                      Glisse les blocs pour les réorganiser. Coche/décoche pour afficher ou masquer. Clique sur le size pill pour basculer entre full et 1/2 colonne.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Notion-like Grid Layout ── */}
            {(() => {
              const gridDragHandlers = (blockKey) => ({
                draggable: true,
                onDragStart: (e) => { e.dataTransfer.setData('gridBlock', blockKey); e.dataTransfer.effectAllowed = 'move'; setDraggingGridBlock(blockKey); },
                onDragEnd: () => { setDraggingGridBlock(null); setDragOverGridBlock(null); },
                onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverGridBlock(blockKey); },
                onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverGridBlock(null); },
                onDrop: (e) => {
                  e.preventDefault();
                  const fromKey = e.dataTransfer.getData('gridBlock');
                  if (!fromKey || fromKey === blockKey) { setDraggingGridBlock(null); setDragOverGridBlock(null); return; }
                  moveGridBlock(fromKey, blockKey);
                  setDraggingGridBlock(null);
                  setDragOverGridBlock(null);
                },
              });

              const wrapBlock = (blockKey, content) => {
                if (!content) return null;
                const item = gridLayout.find(g => g.key === blockKey);
                return (
                  <GridBlockWrapper
                    key={blockKey}
                    blockKey={blockKey}
                    gridColumn={item?.size === "full" ? "1 / -1" : "span 1"}
                    isDragging={draggingGridBlock === blockKey}
                    isOverDrop={dragOverGridBlock === blockKey && draggingGridBlock !== blockKey}
                    dragHandlers={gridDragHandlers(blockKey)}
                    onResize={() => resizeGridBlock(blockKey)}
                    onHide={() => toggleGridBlock(blockKey)}
                  >
                    {content}
                  </GridBlockWrapper>
                );
              };

              const renderGridBlock = (blockKey) => {
                switch (blockKey) {
                  case "keylines": return (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
              {/* Pipeline total */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "22px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontSize: 28 }}>💰</span>
                  <div>
                    <div style={{ fontSize: 13, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Pipeline total</div>
                    <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: pipelineTotal > 0 ? "var(--gold)" : "var(--text-3)" }}>
                      {pipelineTotal > 0 ? `${(pipelineTotal / 1000).toFixed(1)}k€` : "0€"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {["lead", "need", "qualify", "quoted", "negotiation", "signed", "active", "delivered"].map(stg => {
                    const count = data.projects.filter(p => p.stage === stg).length;
                    if (count === 0) return null;
                    const s = STAGE_MAP[stg];
                    return <span key={stg} style={{ fontSize: 12, color: s.color }}>{s.icon} {count} {s.label.toLowerCase()}</span>;
                  })}
                </div>
                {pipelineTotal === 0 && <div style={{ fontSize: 13, color: "var(--danger)", fontWeight: 600 }}>Aucun revenu en jeu — va chercher du business.</div>}
              </div>

              {/* Griothèque CA */}
              <a href="/formations" style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: 24 }}>📚</span>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>La Griothèque — Formations</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
                        <span style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: grioStats.caConfirmed > 0 ? "var(--pillar-griotheque)" : "var(--text-3)" }}>
                          {grioStats.caConfirmed > 0 ? `${grioStats.caConfirmed.toLocaleString('fr-FR')}€` : "0€"}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-3)" }}>CA confirmé HT</span>
                        {grioStats.caPending > grioStats.caConfirmed && (
                          <span style={{ fontSize: 12, color: "var(--pillar-griotheque)", opacity: 0.6 }}>· {grioStats.caPending.toLocaleString('fr-FR')}€ en cours</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 20 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{grioStats.sessionsCount || 0}</div>
                      <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Sessions actives</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{grioStats.apprenantsCount || 0}</div>
                      <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Apprenants</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "var(--pillar-griotheque)", fontWeight: 600, letterSpacing: "0.04em" }}>Voir →</span>
                    </div>
                  </div>
                </div>
              </a>

              {/* À relancer */}
              <div style={{ background: "var(--surface)", border: `1px solid ${toFollowUp.length > 0 || overdueExpenses.length > 0 ? "var(--gold-hover)" : "var(--border)"}`, borderRadius: 12, padding: "22px 28px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: toFollowUp.length > 0 || overdueExpenses.length > 0 ? 14 : 0 }}>
                  <span style={{ fontSize: 28 }}>📞</span>
                  <div>
                    <div style={{ fontSize: 13, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>À relancer aujourd'hui</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: toFollowUp.length > 0 ? "var(--gold)" : "var(--success)" }}>
                      {toFollowUp.length > 0 ? `${toFollowUp.length} relance${toFollowUp.length > 1 ? "s" : ""}` : "Rien à relancer"}
                      {overdueExpenses.length > 0 && <span style={{ color: "var(--danger)", marginLeft: 12 }}>+ {overdueExpenses.length} paiement{overdueExpenses.length > 1 ? "s" : ""} en retard</span>}
                    </div>
                  </div>
                </div>
                {toFollowUp.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {toFollowUp.map(p => (
                      <div key={p.id} onClick={() => { setView("projects"); setSelProject(p); }} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px",
                        background: "var(--bg)", borderRadius: 8, cursor: "pointer", flexWrap: "wrap", gap: 8,
                      }}>
                        <div>
                          <span style={{ fontFamily: "'Space Mono', monospace", color: "var(--gold)", fontSize: 13, fontWeight: 700, marginRight: 8 }}>{p.code}</span>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                          {p.client && <span style={{ fontSize: 12, color: "var(--text-3)", marginLeft: 8 }}>· {p.client}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--gold)" }}>{p.reason}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Prochain move */}
              <div style={{ background: "var(--surface)", border: `1px solid ${nextMove ? "var(--success-soft)" : "var(--border)"}`, borderRadius: 12, padding: "22px 28px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontSize: 28 }}>🎯</span>
                  <div>
                    <div style={{ fontSize: 13, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Prochain move</div>
                    {nextMove ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                        <span style={{ fontSize: 18, fontWeight: 700, color: nextMove.color || "var(--success)" }}>{nextMove.action}</span>
                        {nextMove.project && (<>
                          <span style={{ fontSize: 13, color: "var(--text-3)" }}>→</span>
                          <span onClick={() => { setView("projects"); setSelProject(nextMove.project); }} style={{
                            fontFamily: "'Space Mono', monospace", color: "var(--gold)", fontSize: 14, fontWeight: 700,
                            cursor: "pointer", textDecoration: "underline", textDecorationColor: "var(--gold-hover)",
                          }}>{nextMove.project.code}</span>
                          <span style={{ fontSize: 14, color: "var(--text-3)" }}>{nextMove.project.name}</span>
                        </>)}
                      </div>
                    ) : (
                      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--danger)", marginTop: 4 }}>Crée ton premier projet.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
                  ); // end keylines

                  case "alerts": return (
            sortedAlerts.length > 0 ? (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ color: "var(--text-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Alertes ({sortedAlerts.length})
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {dangerAlerts.length > 0 && <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 600 }}>{dangerAlerts.length} urgent{dangerAlerts.length > 1 ? "s" : ""}</span>}
                    {warningAlerts.length > 0 && <span style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600 }}>{warningAlerts.length} attention</span>}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sortedAlerts.slice(0, 5).map((a, i) => {
                    const st = ALERT_STYLES[a.type];
                    return (
                      <div key={i} onClick={() => { if (a.projectId) { setView("projects"); setSelProject(data.projects.find(p => p.id === a.projectId)); } }}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px",
                          background: st.bg, border: `1px solid ${st.border}`, borderRadius: 8,
                          cursor: a.projectId ? "pointer" : "default",
                        }}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>{a.icon}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: st.color }}>{a.title}</div>
                          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{a.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                  {sortedAlerts.length > 5 && <div style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: 4 }}>+{sortedAlerts.length - 5} autres alertes</div>}
                </div>
              </div>
            ) : null
                  ); // end alerts

                  case "projets_en_cours": return (
            (() => {
              const activeProjects = data.projects.filter(p => ["signed", "active", "delivered"].includes(p.stage));
              if (activeProjects.length === 0) return null;
              const JOURNAL_ICONS = { email: '✉️', call: '📞', meeting: '🤝', note: '📝', milestone: '🎯', decision: '✅', feedback: '💬' };
              const getEntryDate = e => e.date || e.loggedAt || e.createdAt || '';
              // Calcul avancement moyen global
              const projsWithTasks = activeProjects.filter(p => (p.tasks || []).length > 0);
              const globalPct = projsWithTasks.length > 0
                ? Math.round(projsWithTasks.reduce((s, p) => { const t = p.tasks; return s + (t.filter(x => x.status === "done").length / t.length * 100); }, 0) / projsWithTasks.length)
                : null;
              return (
                <div style={{ background: "var(--surface)", border: "1px solid var(--success-soft)", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      ⚡ En production · {activeProjects.length} projet{activeProjects.length > 1 ? "s" : ""}
                    </div>
                    {globalPct !== null && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 10, color: "var(--text-3)" }}>Avancement moyen</span>
                        <div style={{ width: 80, height: 5, background: "var(--surface-3)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${globalPct}%`, height: "100%", background: globalPct >= 75 ? "var(--success)" : globalPct >= 40 ? "var(--gold)" : "var(--info)", borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: globalPct >= 75 ? "var(--success)" : globalPct >= 40 ? "var(--gold)" : "var(--info)" }}>{globalPct}%</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {activeProjects.map(p => {
                      const journal = Array.isArray(p.projectJournal) ? p.projectJournal : [];
                      const lastEntry = journal.length > 0 ? journal.reduce((a, b) => new Date(getEntryDate(a)) >= new Date(getEntryDate(b)) ? a : b) : null;
                      const linked = data.clients?.find(c => c.id === p.clientId);
                      const clientName = linked ? (linked.company || [linked.firstName, linked.lastName].filter(Boolean).join(' ')) : (p.client || '');
                      const tasks = p.tasks || [];
                      const totalT = tasks.length;
                      const doneT = tasks.filter(t => t.status === "done").length;
                      const inProgT = tasks.filter(t => t.status === "in_progress").length;
                      const reviewT = tasks.filter(t => t.status === "review").length;
                      const pct = totalT > 0 ? Math.round(doneT / totalT * 100) : 0;
                      const isOverdue = p.endDate && new Date(p.endDate) < new Date() && pct < 100;
                      return (
                        <div key={p.id} onClick={() => { setView("projects"); setSelProject(p); }} style={{
                          padding: "12px 14px", background: "var(--bg)", borderRadius: 8, cursor: "pointer",
                          border: `1px solid ${isOverdue ? "var(--danger-soft)" : "var(--border)"}`,
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ fontFamily: "'Space Mono', monospace", color: "var(--gold)", fontSize: 12, fontWeight: 700 }}>{p.code}</span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{p.name}</span>
                              {clientName && <span style={{ fontSize: 11, color: "var(--text-3)" }}>· {clientName}</span>}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              {p.endDate && <span style={{ fontSize: 11, color: isOverdue ? "var(--danger)" : "var(--text-3)" }}>{isOverdue ? "🔴" : "📅"} {new Date(p.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>}
                              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--success)" }}>{(p.revenue || 0).toLocaleString()}€</span>
                              <Badge label={STAGE_MAP[p.stage]?.label} color={STAGE_MAP[p.stage]?.color} />
                            </div>
                          </div>
                          {/* Progress bar */}
                          {totalT > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                                <span style={{ fontSize: 10, color: "var(--text-3)" }}>{doneT}/{totalT} tâches · {inProgT} en cours · {reviewT} review</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: pct === 100 ? "var(--success)" : pct > 50 ? "var(--gold)" : "var(--text-3)" }}>{pct}%</span>
                              </div>
                              <div style={{ height: 5, background: "var(--surface-3)", borderRadius: 3, overflow: "hidden", display: "flex" }}>
                                <div style={{ width: `${doneT / totalT * 100}%`, background: "var(--success)", transition: "width 0.3s" }} />
                                <div style={{ width: `${reviewT / totalT * 100}%`, background: "var(--gold)", transition: "width 0.3s" }} />
                                <div style={{ width: `${inProgT / totalT * 100}%`, background: "var(--info)", transition: "width 0.3s" }} />
                              </div>
                            </div>
                          )}
                          {totalT === 0 && <div style={{ marginTop: 6, fontSize: 10, color: "var(--danger)", fontStyle: "italic" }}>⚠ Aucune tâche créée</div>}
                          {lastEntry && (
                            <div style={{ marginTop: 7, display: "flex", alignItems: "flex-start", gap: 6 }}>
                              <span style={{ fontSize: 11, flexShrink: 0 }}>{JOURNAL_ICONS[lastEntry.type] || '📝'}</span>
                              <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>{new Date(getEntryDate(lastEntry)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} —</span>
                              <span style={{ fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 480 }}>{lastEntry.content}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()
                  ); // end projets_en_cours

                  case "taches": return (
            (() => {
              const allTasks = data.projects.flatMap(p => (p.tasks || []).map(t => ({ ...t, projectCode: p.code, projectName: p.name, projectId: p.id, projectStage: p.stage, projectPillar: p.pillar })));
              const inProgress = allTasks.filter(t => t.status === "in_progress");
              const inReview = allTasks.filter(t => t.status === "review");
              const todoTasks = allTasks.filter(t => t.status === "todo");
              const recentDone = allTasks.filter(t => t.status === "done").slice(0, 3);
              const urgentTasks = [...inProgress, ...inReview];
              if (urgentTasks.length === 0 && todoTasks.length === 0) return null;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                  {/* En cours + review */}
                  <div style={{ background: "var(--surface)", border: "1px solid var(--info-soft)", borderRadius: 12, padding: "18px 22px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--info)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                        🔄 Tâches en cours ({inProgress.length + inReview.length})
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {inProgress.length > 0 && <span style={{ fontSize: 10, color: "var(--info)", background: "var(--info-soft)", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>{inProgress.length} en cours</span>}
                        {inReview.length > 0 && <span style={{ fontSize: 10, color: "var(--gold)", background: "var(--gold-soft)", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>{inReview.length} review</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                      {urgentTasks.slice(0, 8).map(t => (
                        <div key={t.id} onClick={() => { const proj = data.projects.find(p => p.id === t.projectId); if (proj) { setSelProject(proj); setView("projects"); setProjectTab("tasks"); } }}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--bg)", borderRadius: 6, cursor: "pointer", border: "1px solid var(--border)" }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = "var(--info-soft)"}
                          onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                        >
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.status === "in_progress" ? "var(--info)" : "var(--gold)", flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                            <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 1 }}>
                              <span style={{ color: PILLAR_MAP[t.projectPillar]?.color || "var(--text-3)", fontWeight: 600 }}>{t.projectCode}</span>
                              <span style={{ marginLeft: 6 }}>{t.projectName}</span>
                            </div>
                          </div>
                          <span style={{ fontSize: 9, color: t.status === "in_progress" ? "var(--info)" : "var(--gold)", background: t.status === "in_progress" ? "var(--info-soft)" : "var(--gold-soft)", padding: "2px 6px", borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>
                            {t.status === "in_progress" ? "en cours" : "review"}
                          </span>
                        </div>
                      ))}
                      {urgentTasks.length === 0 && <div style={{ fontSize: 11, color: "var(--text-3)", fontStyle: "italic", padding: 8 }}>Aucune tâche en cours</div>}
                    </div>
                  </div>
                  {/* À faire */}
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 22px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                        📋 À faire ({todoTasks.length})
                      </div>
                      {recentDone.length > 0 && <span style={{ fontSize: 10, color: "var(--success)", fontWeight: 600 }}>✓ {allTasks.filter(t => t.status === "done").length} terminées</span>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                      {todoTasks.slice(0, 8).map(t => (
                        <div key={t.id} onClick={() => { const proj = data.projects.find(p => p.id === t.projectId); if (proj) { setSelProject(proj); setView("projects"); setProjectTab("tasks"); } }}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--bg)", borderRadius: 6, cursor: "pointer", border: "1px solid var(--border)" }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border)"}
                          onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                        >
                          <div style={{ width: 14, height: 14, borderRadius: 4, border: "1px solid var(--border)", flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                            <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 1 }}>
                              <span style={{ color: PILLAR_MAP[t.projectPillar]?.color || "var(--text-3)", fontWeight: 600 }}>{t.projectCode}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {todoTasks.length > 8 && <div style={{ fontSize: 10, color: "var(--text-3)", textAlign: "center", padding: 4 }}>+{todoTasks.length - 8} autres tâches</div>}
                      {todoTasks.length === 0 && <div style={{ fontSize: 11, color: "var(--text-3)", fontStyle: "italic", padding: 8 }}>Aucune tâche à faire</div>}
                    </div>
                  </div>
                </div>
              );
            })()
                  ); // end taches

                  case "indicateurs": return (
            (() => {
              const now = new Date();
              const currentMonth = now.getMonth();
              const currentYear = now.getFullYear();
              // CA facturé (paid) vs CA confirmé (signed+active+delivered+paid)
              const paidProjs = data.projects.filter(p => p.stage === "paid");
              const caFacture = paidProjs.reduce((s, p) => s + (p.revenue || 0), 0);
              const caFactureThisYear = paidProjs.filter(p => p.startDate && new Date(p.startDate).getFullYear() === currentYear).reduce((s, p) => s + (p.revenue || 0), 0);
              // Devis émis (quoted+negotiation)
              const devisEmis = data.projects.filter(p => ["quoted", "negotiation"].includes(p.stage));
              const devisEmisCA = devisEmis.reduce((s, p) => s + (p.revenue || 0), 0);
              // Devis acceptés (signed ce mois)
              const devisAcceptes = data.projects.filter(p => p.stage === "signed");
              // Factures en attente (delivered = livré, pas encore payé)
              const facturesAttente = data.projects.filter(p => p.stage === "delivered");
              const caAttente = facturesAttente.reduce((s, p) => s + (p.revenue || 0), 0);
              // Factures en retard (delivered + endDate passée)
              const facturesRetard = facturesAttente.filter(p => p.endDate && new Date(p.endDate) < now);
              const caRetard = facturesRetard.reduce((s, p) => s + (p.revenue || 0), 0);
              // CA prévisionnel (tout sauf lost et paid)
              const caPrev = data.projects.filter(p => !["lost", "paid"].includes(p.stage)).reduce((s, p) => s + (p.revenue || 0), 0);

              return (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
                    📊 Indicateurs financiers
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                    {/* CA Facturé */}
                    <div style={{ background: "var(--bg)", borderRadius: 8, padding: "14px 16px", borderLeft: "3px solid var(--success)" }}>
                      <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 6 }}>CA Facturé</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--success)" }}>{caFacture.toLocaleString('fr-FR')}€</div>
                      <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 3 }}>{paidProjs.length} projet{paidProjs.length > 1 ? "s" : ""} payé{paidProjs.length > 1 ? "s" : ""}</div>
                    </div>
                    {/* CA Prévisionnel */}
                    <div style={{ background: "var(--bg)", borderRadius: 8, padding: "14px 16px", borderLeft: "3px solid var(--pillar-prod)" }}>
                      <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 6 }}>CA Prévisionnel</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--pillar-prod)" }}>{caPrev.toLocaleString('fr-FR')}€</div>
                      <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 3 }}>pipeline actif</div>
                    </div>
                    {/* Devis émis */}
                    <div style={{ background: "var(--bg)", borderRadius: 8, padding: "14px 16px", borderLeft: "3px solid var(--gold)" }}>
                      <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 6 }}>Devis émis</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)" }}>{devisEmis.length}</div>
                      <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 3 }}>{devisEmisCA.toLocaleString('fr-FR')}€ en jeu</div>
                    </div>
                    {/* Devis acceptés */}
                    <div style={{ background: "var(--bg)", borderRadius: 8, padding: "14px 16px", borderLeft: "3px solid var(--info)" }}>
                      <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 6 }}>Devis acceptés</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--info)" }}>{devisAcceptes.length}</div>
                      <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 3 }}>{devisAcceptes.reduce((s, p) => s + (p.revenue || 0), 0).toLocaleString('fr-FR')}€</div>
                    </div>
                    {/* Factures en attente */}
                    <div style={{ background: "var(--bg)", borderRadius: 8, padding: "14px 16px", borderLeft: `3px solid ${caAttente > 0 ? "var(--warning)" : "var(--border)"}` }}>
                      <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 6 }}>Factures en attente</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: caAttente > 0 ? "var(--warning)" : "var(--text-3)" }}>{facturesAttente.length}</div>
                      <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 3 }}>{caAttente.toLocaleString('fr-FR')}€</div>
                    </div>
                    {/* Factures en retard */}
                    <div style={{ background: caRetard > 0 ? "var(--danger-soft)" : "var(--bg)", borderRadius: 8, padding: "14px 16px", borderLeft: `3px solid ${caRetard > 0 ? "var(--danger)" : "var(--border)"}` }}>
                      <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 6 }}>Factures à échéance</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: caRetard > 0 ? "var(--danger)" : "var(--text-3)" }}>{facturesRetard.length}</div>
                      <div style={{ fontSize: 10, color: caRetard > 0 ? "var(--danger)" : "var(--text-3)", marginTop: 3 }}>{caRetard.toLocaleString('fr-FR')}€</div>
                    </div>
                  </div>
                </div>
              );
            })()
                  ); // end indicateurs

                  case "quick_stats": return (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
              <Stat label="Revenu confirmé" value={`${(confirmedRevenue/1000).toFixed(1)}k€`} accent="var(--success)" sub={`Signé + en cours + livré + payé`} />
              <Stat label="Revenu potentiel" value={`${(potentialRevenue/1000).toFixed(1)}k€`} accent="var(--gold)" sub={`Inquiry → Proposal → Négo`} />
              <Stat label="Marge globale" value={confirmedRevenue > 0 ? `${totalMargin.toFixed(0)}%` : "—"} accent={totalMargin >= 50 ? "var(--success)" : totalMargin >= 30 ? "var(--gold)" : "var(--danger)"} />
              <Stat label="Conversion" value={quotedOrLater.length > 0 ? `${conversionRate.toFixed(0)}%` : "—"} accent={conversionRate >= 50 ? "var(--success)" : "var(--gold)"} sub={`${wonProjects.length} gagnés · ${lostProjects.length} perdus`} />
            </div>
                  ); // end quick_stats

                  case "forecast": return (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 22px", marginBottom: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Forecast Pipeline</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>CA pondéré par probabilité de closing · probabilités : Inquiry 5% · Qualify 25% · Proposal 50% · Négo 75% · Contract 100%</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "var(--gold)" }}>{(weightedTotal/1000).toFixed(1)}k€</div>
                  <div style={{ fontSize: 10, color: "var(--text-3)" }}>pipeline pondéré total</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {/* Closing dans 30j */}
                <div style={{ flex: 1, minWidth: 180, background: closing30.length > 0 ? "var(--danger-soft)" : "var(--bg)", border: `1px solid ${closing30.length > 0 ? "var(--danger-soft)" : "var(--border)"}`, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: closing30.length > 0 ? "var(--danger)" : "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>⚡ Closing J-30</div>
                  {closing30.length > 0 ? closing30.map(p => (
                    <div key={p.id} onClick={() => { setView("projects"); setSelProject(p); }} style={{ cursor: "pointer", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 600 }}>{p.code}</span>
                      <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 6 }}>{(p.revenue||0).toLocaleString()}€</span>
                    </div>
                  )) : <div style={{ fontSize: 11, color: "var(--text-3)" }}>Aucun projet à clore dans 30j</div>}
                </div>
                {/* Closing 30-60j */}
                <div style={{ flex: 1, minWidth: 180, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: "var(--gold)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>📅 Horizon 30–60j</div>
                  {closing60.length > 0 ? closing60.map(p => (
                    <div key={p.id} onClick={() => { setView("projects"); setSelProject(p); }} style={{ cursor: "pointer", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 600 }}>{p.code}</span>
                      <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 6 }}>{(p.revenue||0).toLocaleString()}€</span>
                    </div>
                  )) : <div style={{ fontSize: 11, color: "var(--text-3)" }}>Aucun projet dans cette fenêtre</div>}
                </div>
                {/* Par stade */}
                <div style={{ flex: 2, minWidth: 240, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Répartition par stade</div>
                  {Object.entries(STAGE_PROBA).filter(([k]) => !["paid","lost"].includes(k)).map(([stageKey, proba]) => {
                    const stageProjects = forecastProjects.filter(p => p.stage === stageKey);
                    if (stageProjects.length === 0) return null;
                    const raw = stageProjects.reduce((s,p) => s + (p.revenue||0), 0);
                    const weighted = raw * proba;
                    const stageInfo = STAGE_MAP[stageKey];
                    return (
                      <div key={stageKey} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: stageInfo?.color || "var(--text-3)", flexShrink: 0 }} />
                        <div style={{ flex: 1, fontSize: 11, color: "var(--text-3)" }}>{stageInfo?.label || stageKey}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{(raw/1000).toFixed(0)}k€</div>
                        <div style={{ fontSize: 10, color: "var(--text-3)" }}>×{Math.round(proba*100)}%</div>
                        <div style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600, minWidth: 48, textAlign: "right" }}>{(weighted/1000).toFixed(0)}k€</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
                  ); // end forecast

                  case "charts": return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
              {/* Pipeline Funnel */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px", gridColumn: "1 / -1" }}>
                <h3 style={{ margin: "0 0 16px 0", color: "var(--gold)", fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Pipeline par stage</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={pipelineFunnelData} layout="vertical">
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fill: "var(--text-3)", fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)" }} />
                    <Bar dataKey="value" fill="var(--gold)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Monthly Revenue by Pillar */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, color: "var(--gold)", fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>CA mensuel par pilier</h3>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>
                      Total {chartYear} : <span style={{ color: "var(--text)", fontWeight: 700 }}>{(revenueThisYear / 1000).toFixed(1)}k€</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[...availableYears, new Date().getFullYear()].filter((y, i, a) => a.indexOf(y) === i).sort((a,b) => b-a).slice(0,4).map(y => (
                      <button key={y} onClick={() => setChartYear(y)} style={{
                        padding: "4px 10px", borderRadius: 6, border: `1px solid ${chartYear === y ? "var(--gold)" : "var(--border)"}`,
                        background: chartYear === y ? "var(--gold-soft)" : "transparent", color: chartYear === y ? "var(--gold)" : "var(--text-3)",
                        fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      }}>{y}</button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyData} barSize={14}>
                    <XAxis dataKey="month" tick={{ fill: "var(--text-3)", fontSize: 11 }} />
                    <YAxis tick={{ fill: "var(--text-3)", fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip contentStyle={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)" }} formatter={(v, name) => [`${(v/1000).toFixed(1)}k€`, name]} />
                    <Legend wrapperStyle={{ color: "var(--text-3)", fontSize: 12 }} />
                    <Bar dataKey="STU" name="Agence" stackId="rev" fill="var(--gold)" />
                    <Bar dataKey="PRD" name="Production" stackId="rev" fill="var(--danger)" />
                    <Bar dataKey="FOR" name="Griothèque" stackId="rev" fill="var(--pillar-griotheque)" radius={[3,3,0,0]} />
                    <Bar dataKey="Dépenses" fill="var(--text-3)" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Expense Breakdown by Category */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px" }}>
                <h3 style={{ margin: "0 0 16px 0", color: "var(--gold)", fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Dépenses par catégorie</h3>
                {expenseCategoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={expenseCategoryData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${(value/1000).toFixed(1)}k€`} outerRadius={80} fill="var(--gold)" dataKey="value">
                        {expenseCategoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)" }} formatter={(value) => `${(value/1000).toFixed(1)}k€`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)" }}>Aucune dépense enregistrée</div>
                )}
              </div>

              {/* Revenue by Pillar */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px" }}>
                <h3 style={{ margin: "0 0 16px 0", color: "var(--gold)", fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Revenu par pilier</h3>
                {revenueByPillarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={revenueByPillarData}>
                      <XAxis dataKey="name" tick={{ fill: "var(--text-3)", fontSize: 12 }} />
                      <YAxis tick={{ fill: "var(--text-3)", fontSize: 12 }} />
                      <Tooltip contentStyle={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)" }} formatter={(value) => `${(value/1000).toFixed(1)}k€`} />
                      <Bar dataKey="value" fill="var(--gold)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)" }}>Aucun revenu enregistré</div>
                )}
              </div>
            </div>
                  ); // end charts

                  // Sidebar widgets
                  case "sw_next_move": return (() => {
                    const nm = (() => {
                      if (data.projects.length === 0) return { action: "Créer ton premier projet", color: "var(--gold)" };
                      const delivered = data.projects.filter(p => p.stage === "delivered");
                      if (delivered.length > 0) return { action: "Relancer paiement", project: delivered[0], color: "var(--danger)" };
                      const toFollow = data.projects.filter(p => ["quoted", "negotiation", "qualify"].includes(p.stage));
                      if (toFollow.length > 0) return { action: "Relancer", project: toFollow[0], color: "var(--gold)" };
                      const active = data.projects.filter(p => p.stage === "active");
                      if (active.length > 0) return { action: "Livrer", project: active[0], color: "var(--success)" };
                      return { action: "Prospecter", color: "var(--info)" };
                    })();
                    return (
                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>🎯 Prochain move</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: nm.color }}>{nm.action}</div>
                          {nm.project && (
                            <div onClick={() => { setView("projects"); setSelProject(nm.project); }} style={{ marginTop: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 11, color: "var(--gold)", fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>{nm.project.code}</span>
                              <span style={{ fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nm.project.name}</span>
                            </div>
                          )}
                        </div>
                    );
                  })();

                  case "sw_pipeline": return (
                      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>💰 Pipeline</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)", marginBottom: 8 }}>{pipelineTotal > 0 ? `${(pipelineTotal / 1000).toFixed(1)}k€` : "0€"}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {PIPELINE_STAGES.filter(s => !["lost"].includes(s.key)).map(s => {
                            const count = data.projects.filter(p => p.stage === s.key).length;
                            if (count === 0) return null;
                            const val = pipelineByStage[s.key] || 0;
                            return (
                              <div key={s.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
                                <span style={{ color: "var(--text-3)" }}>{s.icon} {s.label}</span>
                                <span style={{ color: s.color, fontWeight: 600 }}>{count} · {(val/1000).toFixed(1)}k€</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                  );

                  case "sw_tasks": return (() => {
                    const allT = data.projects.flatMap(p => (p.tasks || []).map(t => ({ ...t, projectCode: p.code, projectId: p.id, projectPillar: p.pillar })));
                    const inProg = allT.filter(t => t.status === "in_progress");
                    const review = allT.filter(t => t.status === "review");
                    const urgent = [...inProg, ...review].slice(0, 5);
                    if (urgent.length === 0) return null;
                    return (
                        <div style={{ background: "var(--surface)", border: "1px solid var(--info-soft)", borderRadius: 10, padding: "14px 16px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>🔄 Tâches actives ({inProg.length + review.length})</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {urgent.map(t => (
                              <div key={t.id} onClick={() => { const proj = data.projects.find(p => p.id === t.projectId); if (proj) { setSelProject(proj); setView("projects"); setProjectTab("tasks"); } }}
                                style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 0" }}>
                                <div style={{ width: 5, height: 5, borderRadius: "50%", background: t.status === "in_progress" ? "var(--info)" : "var(--gold)", flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 11, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                                  <div style={{ fontSize: 9, color: PILLAR_MAP[t.projectPillar]?.color || "var(--text-3)" }}>{t.projectCode}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                    );
                  })();

                  case "sw_calendar": return (() => {
                    const now = new Date();
                    const startOfWeek = new Date(now);
                    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
                    const days = Array.from({ length: 7 }, (_, i) => {
                      const d = new Date(startOfWeek);
                      d.setDate(startOfWeek.getDate() + i);
                      return d;
                    });
                    const dayNames = ["L", "M", "M", "J", "V", "S", "D"];
                    const weekProjects = data.projects.filter(p => {
                      if (!p.endDate) return false;
                      const ed = new Date(p.endDate);
                      return ed >= days[0] && ed <= days[6];
                    });
                    return (
                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>📅 Cette semaine</div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                            {days.map((d, i) => {
                              const isToday = d.toDateString() === now.toDateString();
                              const hasDeadline = data.projects.some(p => p.endDate && new Date(p.endDate).toDateString() === d.toDateString());
                              return (
                                <div key={i} style={{ textAlign: "center", flex: 1 }}>
                                  <div style={{ fontSize: 9, color: "var(--text-3)", marginBottom: 4 }}>{dayNames[i]}</div>
                                  <div style={{
                                    width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto",
                                    background: isToday ? "var(--gold)" : "transparent",
                                    color: isToday ? "var(--gold-ink)" : "var(--text-3)",
                                    fontSize: 12, fontWeight: isToday ? 700 : 400,
                                    border: hasDeadline && !isToday ? "1px solid var(--gold)" : "1px solid transparent",
                                  }}>
                                    {d.getDate()}
                                  </div>
                                  {hasDeadline && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--danger)", margin: "3px auto 0" }} />}
                                </div>
                              );
                            })}
                          </div>
                          {weekProjects.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                              {weekProjects.slice(0, 4).map(p => (
                                <div key={p.id} onClick={() => { setSelProject(p); setView("projects"); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontSize: 11, padding: "2px 0" }}>
                                  <span style={{ color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>{p.code} {p.name}</span>
                                  <span style={{ color: new Date(p.endDate) < now ? "var(--danger)" : "var(--text-3)", fontSize: 10, flexShrink: 0 }}>{new Date(p.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {weekProjects.length === 0 && <div style={{ fontSize: 10, color: "var(--text-3)", fontStyle: "italic" }}>Aucune deadline cette semaine</div>}
                        </div>
                    );
                  })();

                  case "sw_relances": return (() => {
                    const toFollow = data.projects.filter(p => ["quoted", "negotiation", "qualify"].includes(p.stage));
                    if (toFollow.length === 0) return null;
                    return (
                        <div style={{ background: "var(--surface)", border: "1px solid var(--gold-soft)", borderRadius: 10, padding: "14px 16px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>🔔 À relancer ({toFollow.length})</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {toFollow.slice(0, 4).map(p => (
                              <div key={p.id} onClick={() => { setSelProject(p); setView("projects"); }} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <span style={{ fontSize: 10, color: "var(--gold)", fontFamily: "'Space Mono', monospace", fontWeight: 700, marginRight: 6 }}>{p.code}</span>
                                  <span style={{ fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                                </div>
                                <span style={{ fontSize: 10, color: STAGE_MAP[p.stage]?.color || "var(--text-3)", flexShrink: 0, marginLeft: 6 }}>{STAGE_MAP[p.stage]?.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                    );
                  })();

                  case "sw_finances": return (() => {
                    const paid = data.projects.filter(p => p.stage === "paid").reduce((s, p) => s + (p.revenue || 0), 0);
                    const delivered = data.projects.filter(p => p.stage === "delivered");
                    const deliveredCA = delivered.reduce((s, p) => s + (p.revenue || 0), 0);
                    const totalExp = data.projects.reduce((s, p) => s + (p.expenses || []).reduce((x, e) => x + (e.amount || 0), 0), 0);
                    return (
                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>📊 Santé financière</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                              <span style={{ color: "var(--text-3)" }}>CA encaissé</span>
                              <span style={{ color: "var(--success)", fontWeight: 700 }}>{paid.toLocaleString('fr-FR')}€</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                              <span style={{ color: "var(--text-3)" }}>À encaisser</span>
                              <span style={{ color: deliveredCA > 0 ? "var(--warning)" : "var(--text-3)", fontWeight: 600 }}>{deliveredCA.toLocaleString('fr-FR')}€</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                              <span style={{ color: "var(--text-3)" }}>Dépenses</span>
                              <span style={{ color: "var(--danger)", fontWeight: 600 }}>{totalExp.toLocaleString('fr-FR')}€</span>
                            </div>
                            <div style={{ height: 1, background: "var(--surface-3)", margin: "2px 0" }} />
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                              <span style={{ color: "var(--text-3)", fontWeight: 600 }}>Marge nette</span>
                              <span style={{ color: (paid - totalExp) >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>{(paid - totalExp).toLocaleString('fr-FR')}€</span>
                            </div>
                          </div>
                        </div>
                    );
                  })();

                  case "sw_pillars": return (
                      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>🏛 Piliers</div>
                        {Object.entries(PILLAR_MAP).map(([key, p]) => {
                          const projs = data.projects.filter(pr => pr.pillar === key && !["lost", "paid"].includes(pr.stage));
                          const ca = projs.reduce((s, pr) => s + (pr.revenue || 0), 0);
                          return (
                            <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 11 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
                                <span style={{ color: "var(--text-3)" }}>{p.label}</span>
                              </div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <span style={{ color: "var(--text-3)" }}>{projs.length}p</span>
                                <span style={{ color: p.color, fontWeight: 600 }}>{(ca/1000).toFixed(1)}k€</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                  );

                  default: return null;
                } // end switch
              }; // end renderGridBlock

              return (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  alignItems: "start",
                }}>
                  {gridLayout.filter(b => b.visible).map(item => wrapBlock(item.key, renderGridBlock(item.key)))}
                </div>
              );
            })()}
            </div>{/* end grid container */}

          </div>
        )}

        {/* ═══ PIPELINE VIEW ═══ */}
        {view === "pipeline" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: "var(--text)" }}>Pipeline Commercial</h2>

            {/* ── Tunnel de vente — refonte interactive ── */}
            {(() => {
              // Funnel stages: sales funnel only (lead → signed)
              const FUNNEL_STAGES = PIPELINE_STAGES.filter(s => ["lead","need","qualify","quoted","negotiation","signed"].includes(s.key));
              const maxWidth = 100; // % for widest bar (lead)
              const funnelData = FUNNEL_STAGES.map((s, i) => {
                const projs = data.projects.filter(p => p.stage === s.key);
                const ca = projs.reduce((sum, p) => sum + (p.revenue || 0), 0);
                return { ...s, projs, count: projs.length, ca, widthPct: maxWidth - (i * (60 / FUNNEL_STAGES.length)) };
              });
              const totalInFunnel = funnelData.reduce((s, d) => s + d.count, 0);
              const totalCAFunnel = funnelData.reduce((s, d) => s + d.ca, 0);

              // Weighted pipeline: probability × CA
              const STAGE_PROBA = { lead: 0.1, need: 0.2, qualify: 0.35, quoted: 0.5, negotiation: 0.7, signed: 0.9 };
              const weightedCA = funnelData.reduce((s, d) => s + d.ca * (STAGE_PROBA[d.key] || 0), 0);

              // Active projects advancement
              const activeProjs = data.projects.filter(p => ["signed", "active", "delivered"].includes(p.stage));
              const withTasks = activeProjs.filter(p => (p.tasks || []).length > 0);
              const avgPct = withTasks.length > 0
                ? Math.round(withTasks.reduce((s, p) => { const t = p.tasks || []; return s + (t.filter(x => x.status === "done").length / t.length * 100); }, 0) / withTasks.length)
                : null;
              const overdueProjs = activeProjs.filter(p => p.endDate && new Date(p.endDate) < new Date());

              // Average deal value (signed+)
              const closedProjs = data.projects.filter(p => ["signed","active","delivered","paid"].includes(p.stage));
              const avgDeal = closedProjs.length > 0 ? Math.round(closedProjs.reduce((s, p) => s + (p.revenue || 0), 0) / closedProjs.length) : 0;

              // Projects needing action (quoted > 7 days, no journal update)
              const now = new Date();
              const staleProjs = data.projects.filter(p => {
                if (!["quoted","negotiation"].includes(p.stage)) return false;
                const journal = Array.isArray(p.projectJournal) ? p.projectJournal : [];
                if (journal.length === 0) return true;
                const lastDate = journal.reduce((best, e) => {
                  const d = new Date(e.date || e.loggedAt || e.createdAt || 0);
                  return d > best ? d : best;
                }, new Date(0));
                return (now - lastDate) > 7 * 86400000;
              });

              return (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "24px 28px", marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>Tunnel de vente</h3>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ fontSize: 11, color: "var(--text-3)", background: "var(--surface)", padding: "4px 10px", borderRadius: 6 }}>{totalInFunnel} opportunité{totalInFunnel > 1 ? "s" : ""}</span>
                      <span style={{ fontSize: 11, color: "var(--gold)", background: "var(--gold-soft)", padding: "4px 10px", borderRadius: 6, fontWeight: 600 }}>{totalCAFunnel.toLocaleString('fr-FR')}€ en jeu</span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
                    {/* ── Funnel visuel (barres dégradées) ── */}
                    <div style={{ flex: "1 1 340px", minWidth: 280 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {funnelData.map(s => (
                          <div key={s.key}
                            onClick={() => { if (s.projs.length > 0) { setSelProject(s.projs[0]); setView("projects"); } }}
                            style={{ display: "flex", alignItems: "center", gap: 10, cursor: s.count > 0 ? "pointer" : "default", padding: "6px 0" }}
                            onMouseEnter={e => { if (s.count > 0) e.currentTarget.querySelector('.funnel-bar').style.filter = 'brightness(1.3)'; }}
                            onMouseLeave={e => { if (s.count > 0) e.currentTarget.querySelector('.funnel-bar').style.filter = 'none'; }}
                          >
                            <div style={{ width: 90, fontSize: 11, color: "var(--text-3)", textAlign: "right", flexShrink: 0 }}>{s.label}</div>
                            <div style={{ flex: 1, position: "relative" }}>
                              <div className="funnel-bar" style={{
                                width: `${s.widthPct}%`, height: 28, background: alpha(s.color, 27),
                                borderRadius: 4, border: `1px solid ${alpha(s.color, 40)}`,
                                display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px",
                                transition: "filter 0.15s",
                              }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.count}</span>
                                {s.ca > 0 && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{(s.ca / 1000).toFixed(1)}k€</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── KPIs grille ── */}
                    <div style={{ flex: "0 0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px", alignContent: "start" }}>
                      {/* Taux conversion */}
                      <div style={{ background: "var(--surface)", borderRadius: 8, padding: "12px 16px", minWidth: 130 }}>
                        <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 6 }}>Conversion</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)" }}>{conversionRate.toFixed(0)}%</div>
                        <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>{wonProjects.length} signés / {quotedOrLater.length} proposés</div>
                      </div>
                      {/* CA pondéré */}
                      <div style={{ background: "var(--surface)", borderRadius: 8, padding: "12px 16px", minWidth: 130 }}>
                        <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 6 }}>CA pondéré</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--pillar-prod)" }}>{weightedCA.toLocaleString('fr-FR')}€</div>
                        <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>prévision réaliste</div>
                      </div>
                      {/* CA confirmé */}
                      <div style={{ background: "var(--surface)", borderRadius: 8, padding: "12px 16px" }}>
                        <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 6 }}>CA confirmé</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--success)" }}>{confirmedRevenue.toLocaleString('fr-FR')}€</div>
                        <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>{closedProjs.length} projet{closedProjs.length > 1 ? "s" : ""}</div>
                      </div>
                      {/* Panier moyen */}
                      <div style={{ background: "var(--surface)", borderRadius: 8, padding: "12px 16px" }}>
                        <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 6 }}>Panier moyen</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{avgDeal.toLocaleString('fr-FR')}€</div>
                        <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>par projet signé</div>
                      </div>
                    </div>
                  </div>

                  {/* ── Avancement projets en cours + Alertes ── */}
                  {(activeProjs.length > 0 || staleProjs.length > 0) && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", gap: 20, flexWrap: "wrap" }}>
                      {/* Avancement moyen */}
                      {avgPct !== null && (
                        <div style={{ flex: "1 1 200px", background: "var(--surface)", borderRadius: 8, padding: "12px 16px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <span style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase" }}>Avancement moyen — {withTasks.length} projet{withTasks.length > 1 ? "s" : ""} actif{withTasks.length > 1 ? "s" : ""}</span>
                            <span style={{ fontSize: 16, fontWeight: 700, color: avgPct >= 75 ? "var(--success)" : avgPct >= 40 ? "var(--gold)" : "var(--danger)" }}>{avgPct}%</span>
                          </div>
                          <div style={{ height: 6, background: "var(--surface-3)", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                            <div style={{ width: `${avgPct}%`, height: "100%", background: avgPct >= 75 ? "var(--success)" : avgPct >= 40 ? "var(--gold)" : "var(--danger)", borderRadius: 3, transition: "width 0.3s" }} />
                          </div>
                          {/* Mini list of active projects */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {withTasks.slice(0, 4).map(p => {
                              const t = p.tasks || [];
                              const pct = Math.round(t.filter(x => x.status === "done").length / t.length * 100);
                              return (
                                <div key={p.id} onClick={() => { setSelProject(p); setView("projects"); }} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "3px 0" }}>
                                  <span style={{ fontSize: 10, color: "var(--gold)", fontFamily: "'Space Mono', monospace", fontWeight: 700, width: 60, flexShrink: 0 }}>{p.code}</span>
                                  <div style={{ flex: 1, height: 4, background: "var(--surface-3)", borderRadius: 2, overflow: "hidden" }}>
                                    <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "var(--success)" : pct > 50 ? "var(--gold)" : "var(--info)", borderRadius: 2 }} />
                                  </div>
                                  <span style={{ fontSize: 10, color: pct === 100 ? "var(--success)" : "var(--text-3)", fontWeight: 600, width: 30, textAlign: "right" }}>{pct}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {/* Alertes : relances + retards */}
                      {(staleProjs.length > 0 || overdueProjs.length > 0) && (
                        <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: 8 }}>
                          {staleProjs.length > 0 && (
                            <div style={{ background: "var(--gold-soft)", border: "1px solid var(--gold-soft)", borderRadius: 8, padding: "10px 14px" }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", marginBottom: 6 }}>🔔 À relancer ({staleProjs.length})</div>
                              {staleProjs.slice(0, 3).map(p => (
                                <div key={p.id} onClick={() => { setSelProject(p); setView("projects"); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", cursor: "pointer" }}>
                                  <div>
                                    <span style={{ fontSize: 10, color: "var(--gold)", fontFamily: "'Space Mono', monospace", fontWeight: 700, marginRight: 6 }}>{p.code}</span>
                                    <span style={{ fontSize: 11, color: "var(--text-2)" }}>{p.name}</span>
                                  </div>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--gold)" }}>{(p.revenue || 0).toLocaleString('fr-FR')}€</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {overdueProjs.length > 0 && (
                            <div style={{ background: "var(--danger-soft)", border: "1px solid var(--danger-soft)", borderRadius: 8, padding: "10px 14px" }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--danger)", marginBottom: 6 }}>⚠️ En retard ({overdueProjs.length})</div>
                              {overdueProjs.slice(0, 3).map(p => {
                                const daysLate = Math.ceil((now - new Date(p.endDate)) / 86400000);
                                return (
                                  <div key={p.id} onClick={() => { setSelProject(p); setView("projects"); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", cursor: "pointer" }}>
                                    <div>
                                      <span style={{ fontSize: 10, color: "var(--gold)", fontFamily: "'Space Mono', monospace", fontWeight: 700, marginRight: 6 }}>{p.code}</span>
                                      <span style={{ fontSize: 11, color: "var(--text-2)" }}>{p.name}</span>
                                    </div>
                                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--danger)" }}>+{daysLate}j</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Actions Pipeline ── */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <button onClick={() => { setPf({ stage: "lead" }); setModal("newProject"); }} style={{
                padding: "10px 20px", background: "var(--gold)", color: "var(--gold-ink)", border: "none", borderRadius: 8,
                fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 6,
              }}>+ Nouvelle opportunité</button>
            </div>

            {/* ── Kanban Pipeline ── */}
            <div style={{ overflowX: "auto", paddingBottom: 16 }}>
              <div style={{ display: "flex", gap: 10, minWidth: "max-content", alignItems: "flex-start" }}>
                {PIPELINE_STAGES.filter(s => s.key !== "lost" || filteredProjects.some(p => p.stage === "lost")).map(stage => {
                  const stageProjects = filteredProjects.filter(p => p.stage === stage.key);
                  const stageValue = pipelineByStage[stage.key] || 0;
                  const isDragOver = dragOverStage === stage.key;
                  return (
                    <div key={stage.key} style={{ width: 230, flexShrink: 0 }}
                      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverStage(stage.key); }}
                      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }}
                      onDrop={async e => {
                        e.preventDefault();
                        setDragOverStage(null);
                        const projectId = e.dataTransfer.getData('pipelineProjectId');
                        if (!projectId) return;
                        setDraggingProjectId(null);
                        // Optimistic update
                        setData(prev => ({
                          ...prev,
                          projects: prev.projects.map(p => p.id === projectId ? { ...p, stage: stage.key } : p),
                        }));
                        try {
                          await fetch(`/api/projects/${projectId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ stage: stage.key }),
                          });
                          const fresh = await fetch('/api/data').then(r => r.json());
                          setData(fresh);
                        } catch (err) {
                          console.error('Stage change failed:', err);
                          const fresh = await fetch('/api/data').then(r => r.json());
                          setData(fresh);
                        }
                      }}
                    >
                      {/* Entête colonne */}
                      <div style={{
                        background: isDragOver ? alpha(stage.color, 9) : "var(--surface)",
                        borderTop: `1px solid ${isDragOver ? alpha(stage.color, 40) : alpha(stage.color, 20)}`,
                        borderLeft: `1px solid ${isDragOver ? alpha(stage.color, 40) : alpha(stage.color, 20)}`,
                        borderRight: `1px solid ${isDragOver ? alpha(stage.color, 40) : alpha(stage.color, 20)}`,
                        borderBottom: `2px solid ${stage.color}`,
                        borderRadius: "10px 10px 0 0", padding: "10px 12px",
                        transition: "background 0.15s, border-color 0.15s",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: stage.color }}>{stage.icon} {stage.label}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, background: alpha(stage.color, 13), color: stage.color, padding: "1px 6px", borderRadius: 10 }}>{stageProjects.length}</span>
                        </div>
                        {stageValue > 0 && <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 3 }}>{(stageValue / 1000).toFixed(1)}k€</div>}
                      </div>
                      {/* Cartes */}
                      <div style={{
                        background: isDragOver ? alpha(stage.color, 3) : "var(--bg)",
                        borderLeft: `1px solid ${isDragOver ? alpha(stage.color, 27) : alpha(stage.color, 13)}`,
                        borderRight: `1px solid ${isDragOver ? alpha(stage.color, 27) : alpha(stage.color, 13)}`,
                        borderBottom: `1px solid ${isDragOver ? alpha(stage.color, 27) : alpha(stage.color, 13)}`,
                        borderTop: "none", borderRadius: "0 0 10px 10px", padding: 6,
                        display: "flex", flexDirection: "column", gap: 6, minHeight: 80,
                        transition: "background 0.15s, border-color 0.15s",
                      }}>
                        {stageProjects.map(p => {
                          const journal = Array.isArray(p.projectJournal) ? p.projectJournal : [];
                          const getEntryDate = e => e.date || e.loggedAt || e.createdAt || '';
                          const lastEntry = journal.length > 0 ? journal.reduce((a, b) => new Date(getEntryDate(a)) >= new Date(getEntryDate(b)) ? a : b) : null;
                          const JOURNAL_ICONS = { email: '✉️', call: '📞', meeting: '🤝', note: '📝', milestone: '🎯', decision: '✅', feedback: '💬' };
                          const isDragging = draggingProjectId === p.id;
                          const cogs = (p.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
                          const marge = p.revenue > 0 ? Math.round((p.revenue - cogs) / p.revenue * 100) : null;
                          // Advancement: tasks
                          const tasks = p.tasks || [];
                          const totalTasks = tasks.length;
                          const doneTasks = tasks.filter(t => t.status === "done").length;
                          const inProgressTasks = tasks.filter(t => t.status === "in_progress").length;
                          const reviewTasks = tasks.filter(t => t.status === "review").length;
                          const taskPct = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0;
                          // PPM phases advancement
                          const ppmPhases = p.ppmPhases || {};
                          const ppmTotal = 8; // PPM_PHASE_KEYS.length
                          const ppmDone = Object.values(ppmPhases).filter(Boolean).length;
                          // Deadline proximity
                          const now = new Date();
                          const endD = p.endDate ? new Date(p.endDate) : null;
                          const daysLeft = endD ? Math.ceil((endD - now) / 86400000) : null;
                          const isOverdue = daysLeft !== null && daysLeft < 0;
                          const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
                          return (
                            <div key={p.id}
                              draggable
                              onDragStart={e => { e.dataTransfer.setData('pipelineProjectId', p.id); setDraggingProjectId(p.id); e.dataTransfer.effectAllowed = 'move'; }}
                              onDragEnd={() => { setDraggingProjectId(null); setDragOverStage(null); }}
                              onClick={() => { setView("projects"); setSelProject(p); }}
                              style={{
                                background: "var(--surface)", border: `1px solid ${isOverdue ? "var(--danger-soft)" : "var(--border)"}`, borderRadius: 8, padding: "10px 12px",
                                cursor: "grab", opacity: isDragging ? 0.4 : 1, transition: "opacity 0.15s, border-color 0.15s",
                              }}
                              onMouseEnter={e => { if (!isDragging) e.currentTarget.style.borderColor = alpha(stage.color, 53); }}
                              onMouseLeave={e => e.currentTarget.style.borderColor = isOverdue ? "var(--danger-soft)" : "var(--border)"}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                                <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "var(--gold)", fontWeight: 700 }}>{p.code}</span>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <span style={{ fontSize: 9, color: "var(--text-3)", background: "var(--surface-3)", padding: "1px 5px", borderRadius: 4 }}>{PILLAR_MAP[p.pillar]?.label || p.pillar}</span>
                                  <button
                                    title="Supprimer ce projet"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirm({ id: p.id, code: p.code, name: p.name });
                                    }}
                                    style={{
                                      background: "transparent", border: "none", cursor: "pointer", padding: "2px 4px",
                                      fontSize: 12, color: "var(--text-3)", borderRadius: 4, lineHeight: 1,
                                      transition: "color 0.15s, background 0.15s",
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.color = "var(--danger)"; e.currentTarget.style.background = "var(--danger-soft)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.background = "transparent"; }}
                                  >🗑</button>
                                </div>
                              </div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 4, lineHeight: 1.3 }}>{p.name}</div>
                              {p.client && <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.client}</div>}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{p.revenue ? `${(p.revenue/1000).toFixed(1)}k€` : "—"}</span>
                                {marge !== null && <span style={{ fontSize: 10, fontWeight: 600, color: marge >= 50 ? "var(--success)" : marge >= 30 ? "var(--gold)" : "var(--danger)" }}>{marge}%</span>}
                              </div>
                              {/* Progress bar — tasks */}
                              {totalTasks > 0 && (
                                <div style={{ marginTop: 6 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                                    <span style={{ fontSize: 9, color: "var(--text-3)" }}>Tâches {doneTasks}/{totalTasks}</span>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: taskPct === 100 ? "var(--success)" : taskPct > 50 ? "var(--gold)" : "var(--text-3)" }}>{taskPct}%</span>
                                  </div>
                                  <div style={{ height: 4, background: "var(--surface-3)", borderRadius: 2, overflow: "hidden", display: "flex" }}>
                                    <div style={{ width: `${doneTasks / totalTasks * 100}%`, background: "var(--success)", transition: "width 0.3s" }} />
                                    <div style={{ width: `${reviewTasks / totalTasks * 100}%`, background: "var(--gold)", transition: "width 0.3s" }} />
                                    <div style={{ width: `${inProgressTasks / totalTasks * 100}%`, background: "var(--info)", transition: "width 0.3s" }} />
                                  </div>
                                </div>
                              )}
                              {/* PPM phases indicator */}
                              {ppmDone > 0 && (
                                <div style={{ marginTop: 4, display: "flex", gap: 2 }}>
                                  {Array.from({ length: ppmTotal }, (_, i) => (
                                    <div key={i} style={{ width: `${100/ppmTotal}%`, height: 3, borderRadius: 1, background: i < ppmDone ? "var(--pillar-prod)" : "var(--surface-3)" }} />
                                  ))}
                                </div>
                              )}
                              {/* Deadline indicator */}
                              {endD && (
                                <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                  <span style={{ fontSize: 9, color: isOverdue ? "var(--danger)" : isUrgent ? "var(--warning)" : "var(--text-3)" }}>
                                    ⏱ {endD.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                    {isOverdue && ` (${Math.abs(daysLeft)}j en retard)`}
                                    {isUrgent && ` (${daysLeft}j restants)`}
                                  </span>
                                </div>
                              )}
                              {lastEntry && (
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 4, marginTop: 3 }}>
                                  <span style={{ fontSize: 10, flexShrink: 0 }}>{JOURNAL_ICONS[lastEntry.type] || '📝'}</span>
                                  <span style={{ fontSize: 10, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{new Date(getEntryDate(lastEntry)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — {lastEntry.content}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {stageProjects.length === 0 && <div style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center", padding: "16px 0", fontStyle: "italic" }}>vide</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══ PROJECTS VIEW ═══ */}
        {view === "projects" && (
          <div>
            {selProject ? (
              <div>
                {/* Project Detail */}
                <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{selProject.code}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: "var(--gold)", marginBottom: 8 }}>{selProject.name}</div>
                    <div style={{ display: "flex", gap: 12, fontSize: 13, color: "var(--text-3)", flexWrap: "wrap", alignItems: "center" }}>
                      {(() => {
                        const linked = projectClient(selProject);
                        const firstName = linked?.firstName || selProject.clientFirstName || '';
                        const lastName = linked?.lastName || selProject.clientLastName || '';
                        const company = linked?.company || selProject.client || '';
                        const indivName = [firstName, lastName].filter(Boolean).join(' ');
                        if (indivName && company) return <span onClick={() => { if (linked) { setSelClient(linked); setView("clients"); } }} style={{ cursor: linked ? "pointer" : "default" }}>Client : <strong style={{ color: linked ? "var(--gold)" : "var(--text-2)" }}>{fmtP(firstName)} {fmtN(lastName)}</strong> <span style={{ color: "var(--text-3)" }}>({company})</span></span>;
                        if (indivName) return <span onClick={() => { if (linked) { setSelClient(linked); setView("clients"); } }} style={{ cursor: linked ? "pointer" : "default" }}>Client : <strong style={{ color: linked ? "var(--gold)" : "var(--text-2)" }}>{fmtP(firstName)} {fmtN(lastName)}</strong></span>;
                        if (company) return <span>Client : {company}</span>;
                        return null;
                      })()}
                      <span>Pilier: {PILLAR_MAP[selProject.pillar]?.label}</span>
                      <Badge label={STAGE_MAP[selProject.stage]?.label} color={STAGE_MAP[selProject.stage]?.color} />
                      {editingDates === selProject.id ? (
                        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          📅
                          <input type="date" value={selProject.startDate || ""} onChange={e => saveInlineDate(selProject.id, "startDate", e.target.value)}
                            style={{ background: "var(--surface-3)", border: "1px solid var(--border-2)", borderRadius: 6, color: "var(--text)", padding: "4px 8px", fontSize: 12, fontFamily: "inherit" }} />
                          <span style={{ color: "var(--text-3)" }}>→</span>
                          <input type="date" value={selProject.endDate || ""} onChange={e => saveInlineDate(selProject.id, "endDate", e.target.value)}
                            style={{ background: "var(--surface-3)", border: "1px solid var(--border-2)", borderRadius: 6, color: "var(--text)", padding: "4px 8px", fontSize: 12, fontFamily: "inherit" }} />
                          <button onClick={() => setEditingDates(null)} style={{ background: "none", border: "none", color: "var(--gold)", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "2px 6px" }}>✓</button>
                        </span>
                      ) : (
                        <span onClick={() => setEditingDates(selProject.id)} style={{ cursor: "pointer", borderBottom: "1px dashed var(--border-2)", padding: "3px 10px", borderRadius: 6, background: "var(--surface)", display: "inline-flex", alignItems: "center", gap: 6, color: selProject.startDate || selProject.endDate ? "var(--text-3)" : "var(--text-3)" }} title="Cliquer pour modifier les dates">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                          {selProject.startDate || selProject.endDate ? (
                            <>{selProject.startDate ? new Date(selProject.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} → {selProject.endDate ? new Date(selProject.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</>
                          ) : "Ajouter des dates"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => {
                      setPdfPreview({ url: `/api/projects/${selProject.id}/devis`, title: `Devis — ${selProject.code || selProject.name}` });
                    }} style={{
                      padding: "8px 16px", background: "var(--success-soft)", border: "1px solid var(--success)", borderRadius: 6,
                      color: "var(--success)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      display: "flex", alignItems: "center", gap: 6,
                    }}>📄 Devis PDF</button>
                    <button onClick={() => {
                      setPdfPreview({ url: `/api/projects/${selProject.id}/facture`, title: `Facture — ${selProject.code || selProject.name}` });
                    }} style={{
                      padding: "8px 16px", background: "var(--info-soft)", border: "1px solid var(--info)", borderRadius: 6,
                      color: "var(--info)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      display: "flex", alignItems: "center", gap: 6,
                    }}>🧾 Facture PDF</button>
                    <button onClick={() => openEditProject(selProject)} style={{
                      padding: "8px 16px", background: "var(--gold-soft)", border: "1px solid var(--gold)", borderRadius: 6,
                      color: "var(--gold)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    }}>✎ Modifier</button>
                    <button onClick={() => deleteProject(selProject.id)} style={{
                      padding: "8px 16px", background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: 6,
                      color: "var(--danger)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    }}>✕ Supprimer</button>
                    <button onClick={() => setSelProject(null)} style={{
                      padding: "8px 16px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6,
                      color: "var(--text-3)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    }}>Fermer</button>
                  </div>
                </div>

                {/* Project info grid */}
                {(() => {
                  const rev = selProject.revenue || 0;
                  const tvaKey = selProject.tvaRate || '20';
                  const revTTC = computeTTC(rev, tvaKey);
                  const cogs = (selProject.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
                  const profit = rev - cogs;
                  const marge = rev > 0 ? ((profit / rev) * 100).toFixed(0) : null;
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
                      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ fontSize: 9, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 4 }}>Revenu HT</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{rev.toLocaleString('fr-FR')}€</div>
                        {tvaKey !== '0' && <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>{revTTC.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€ TTC</div>}
                      </div>
                      <Stat label="Dépenses TTC (COGS)" value={`${cogs.toLocaleString()}€`} />
                      <Stat label="Profit brut" value={`${profit.toLocaleString()}€`} accent={profit >= 0 ? "var(--success)" : "var(--danger)"} />
                      <Stat label="Marge" value={marge !== null ? `${marge}%` : "—"} />
                      <Stat label="Heures" value={selProject.hoursSpent > 0 ? `${selProject.hoursSpent}h` : "—"} />
                      <Stat label="EHR" value={selProject.hoursSpent > 0 && rev > 0 ? `${(rev / selProject.hoursSpent).toFixed(0)}€/h` : "—"} accent={selProject.hoursSpent > 0 && rev > 0 ? ((rev / selProject.hoursSpent) < 50 ? "var(--danger)" : "var(--success)") : undefined} />
                    </div>
                  );
                })()}

                <MarginBar revenue={selProject.revenue || 0} spent={(selProject.expenses || []).reduce((s, e) => s + (e.amount || 0), 0)} />

                {/* Progress bar based on tasks */}
                {(() => {
                  const tasks = selProject.tasks || [];
                  const total = tasks.length;
                  const done = tasks.filter(t => t.status === "done").length;
                  const inProgress = tasks.filter(t => t.status === "in_progress").length;
                  const review = tasks.filter(t => t.status === "review").length;
                  const pct = total > 0 ? Math.round(done / total * 100) : 0;
                  return total > 0 ? (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Avancement</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? "var(--success)" : "var(--gold)" }}>{pct}%</span>
                      </div>
                      <div style={{ height: 8, background: "var(--surface-3)", borderRadius: 4, overflow: "hidden", display: "flex" }}>
                        <div style={{ width: `${done / total * 100}%`, background: "var(--success)", transition: "width 0.3s" }} />
                        <div style={{ width: `${review / total * 100}%`, background: "var(--gold)", transition: "width 0.3s" }} />
                        <div style={{ width: `${inProgress / total * 100}%`, background: "var(--info)", transition: "width 0.3s" }} />
                      </div>
                      <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: "var(--text-3)" }}>
                        <span>{done} fait{done > 1 ? "s" : ""}</span>
                        <span>{review} review</span>
                        <span>{inProgress} en cours</span>
                        <span>{total - done - review - inProgress} à faire</span>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Project sub-tabs */}
                <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
                  {[{ k: "detail", l: "Finances" }, { k: "tasks", l: `Tâches (${(selProject.tasks || []).length})` }, { k: "timeline", l: "Timeline" }, { k: "journal", l: `Journal (${(selProject.projectJournal || []).length})` }, { k: "brief", l: "Brief" }, { k: "onboarding", l: "Onboarding" }].map(t => (
                    <button key={t.k} onClick={() => setProjectTab(t.k)} style={{
                      padding: "8px 18px", borderRadius: 8, border: "1px solid", borderColor: projectTab === t.k ? "var(--gold)" : "var(--border)",
                      background: projectTab === t.k ? "var(--gold-soft)" : "transparent", color: projectTab === t.k ? "var(--gold)" : "var(--text-3)",
                      fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    }}>{t.l}</button>
                  ))}
                </div>

                {/* TASKS TAB */}
                {projectTab === "tasks" && (
                  <div>

                    {/* ── COUCHE 1 : PPM — LA SALLE (gestion relation client) ── */}
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                          PPM — Gestion client
                        </div>
                        {(() => {
                          const phases = selProject.ppmPhases || {};
                          const doneCount = PPM_PHASE_KEYS.filter(p => phases[p.key]).length;
                          const currentPhase = PPM_PHASE_KEYS.find(p => !phases[p.key]);
                          return doneCount > 0 ? (
                            <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                              {doneCount}/{PPM_PHASE_KEYS.length} — {currentPhase ? currentPhase.label : "✓ Complété"}
                            </div>
                          ) : null;
                        })()}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 10px" }}>
                        {PPM_PHASE_KEYS.map((phase, i) => {
                          const done = (selProject.ppmPhases || {})[phase.key];
                          const logs = (selProject.ppmLogs || []).filter(l => l.phaseKey === phase.key);
                          const isOpen = openPPMPhase?.projectId === selProject.id && openPPMPhase?.phaseKey === phase.key;
                          return (
                            <div key={phase.key} style={{ gridColumn: isOpen ? "1 / -1" : "auto" }}>
                              <button onClick={() => {
                                if (isOpen) { setOpenPPMPhase(null); }
                                else { setOpenPPMPhase({ projectId: selProject.id, phaseKey: phase.key }); setPpmLogForm({ note: '', loggedAt: new Date().toISOString().slice(0, 10) }); }
                              }} style={{
                                display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                                width: "100%", borderRadius: 8,
                                border: `1px solid ${isOpen ? "var(--gold)" : done ? "var(--success-soft)" : "var(--border)"}`,
                                background: isOpen ? "var(--gold-soft)" : done ? "var(--success-soft)" : "var(--bg)",
                                color: isOpen ? "var(--gold)" : done ? "var(--success)" : "var(--text-3)", fontSize: 12, fontWeight: 600,
                                cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", textAlign: "left",
                              }}>
                                <span style={{ fontSize: 10, opacity: 0.4, minWidth: 12 }}>{i + 1}</span>
                                <span style={{ fontSize: 12, marginRight: 2 }}>{done ? "✓" : "○"}</span>
                                <span style={{ flex: 1 }}>{phase.label}</span>
                                {logs.length > 0 && (
                                  <span style={{ fontSize: 10, background: done ? "var(--success-soft)" : "var(--hover)", color: done ? "var(--success)" : "var(--text-3)", borderRadius: 10, padding: "1px 6px" }}>
                                    {logs.length}
                                  </span>
                                )}
                              </button>

                              {/* Log panel — s'ouvre en pleine largeur */}
                              {isOpen && (
                                <div style={{ marginTop: 6, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                                  {logs.length > 0 && (
                                    <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                                      {logs.map(log => (
                                        <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "var(--surface)", borderRadius: 6 }}>
                                          <span style={{ fontSize: 11, color: "var(--gold)", fontWeight: 700, whiteSpace: "nowrap" }}>{log.loggedAt}</span>
                                          <span style={{ fontSize: 12, color: "var(--text-3)", flex: 1 }}>{log.note || <span style={{ color: "var(--text-3)", fontStyle: "italic" }}>—</span>}</span>
                                          <button onClick={() => deletePPMLog(log.id, selProject.id)} style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                                    <input type="date" value={ppmLogForm.loggedAt} onChange={e => setPpmLogForm(f => ({ ...f, loggedAt: e.target.value }))} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-2)", padding: "6px 8px", fontSize: 12, fontFamily: "inherit" }} />
                                    <input type="text" value={ppmLogForm.note} onChange={e => setPpmLogForm(f => ({ ...f, note: e.target.value }))} placeholder="Note (optionnel)" style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "6px 10px", fontSize: 12, fontFamily: "inherit" }} onKeyDown={e => e.key === 'Enter' && addPPMLog(selProject.id, phase.key)} />
                                    <button onClick={() => addPPMLog(selProject.id, phase.key)} style={{ padding: "6px 12px", background: "var(--gold)", color: "var(--gold-ink)", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ Log</button>
                                    {done && <button onClick={() => savePPMPhase(selProject.id, phase.key, false)} style={{ padding: "6px 10px", background: "transparent", color: "var(--text-3)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── COUCHE 2 : PRODUCTION — LA CUISINE (travail concret) ── */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                          Production — Tâches ({(selProject.tasks || []).length})
                        </div>
                        {draggingTask ? (
                          <div style={{ fontSize: 10, color: "var(--gold)", background: "var(--gold-soft)", border: "1px solid var(--gold-hover)", borderRadius: 10, padding: "2px 8px", animation: "pulse 1s infinite" }}>
                            ↕ Déposer sur une phase pour déplacer
                          </div>
                        ) : (
                          <div style={{ fontSize: 10, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                              {[0,1,2].map(i => <div key={i} style={{ display: "flex", gap: 1 }}><div style={{ width: 2, height: 2, borderRadius: "50%", background: "var(--border-2)" }} /><div style={{ width: 2, height: 2, borderRadius: "50%", background: "var(--border-2)" }} /></div>)}
                            </span>
                            Glisser pour changer de phase
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {[
                          { key: "strategy",  label: "Strategy",    color: "var(--warning)" },
                          { key: "da",        label: "DA",          color: "var(--gold)" },
                          { key: "production",label: "Prod vidéo",  color: "var(--danger)" },
                          { key: "movement",  label: "Mouvement",   color: "var(--pillar-prod)" },
                          { key: "ip",        label: "IP / Série",  color: "var(--info)" },
                          { key: "dc",        label: "Dir. Créative", color: "var(--warning)" },
                          { key: "formation", label: "Formation",   color: "var(--pillar-prod)" },
                        ].map(t => {
                          const isLoading = applyingTemplate === t.key;
                          return (
                            <button key={t.key}
                              onClick={() => !applyingTemplate && applyTemplate(selProject.id, t.key)}
                              disabled={!!applyingTemplate}
                              style={{
                                padding: "4px 10px", fontSize: 11, fontWeight: 600,
                                background: isLoading ? `${alpha(t.color, 20)}` : `${alpha(t.color, 8)}`,
                                border: `1px solid ${isLoading ? t.color : `${alpha(t.color, 27)}`}`,
                                color: isLoading ? t.color : t.color,
                                borderRadius: 6, cursor: applyingTemplate ? "wait" : "pointer",
                                fontFamily: "inherit", transition: "all 0.15s",
                                opacity: applyingTemplate && !isLoading ? 0.4 : 1,
                              }}
                              onMouseEnter={e => { if (!applyingTemplate) { e.currentTarget.style.background = `${alpha(t.color, 16)}`; e.currentTarget.style.borderColor = `${alpha(t.color, 53)}`; }}}
                              onMouseLeave={e => { if (!applyingTemplate) { e.currentTarget.style.background = `${alpha(t.color, 8)}`; e.currentTarget.style.borderColor = `${alpha(t.color, 27)}`; }}}
                              title={`Générer les tâches template "${t.label}" (${PRODUCTION_TASK_TEMPLATES[t.key].length} tâches)`}
                            >
                              {isLoading ? "⏳ Génération..." : `+ ${t.label}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Add task form — avec datalist de suggestions */}
                    {(() => {
                      // Collecte toutes les suggestions : templates + tâches existantes dans tous les projets
                      const templateTitles = Object.values(PRODUCTION_TASK_TEMPLATES).flat();
                      const existingTitles = data.projects.flatMap(p => (p.tasks || []).map(t => t.title));
                      const suggestions = [...new Set([...templateTitles, ...existingTitles])].sort();
                      const datalistId = `task-suggestions-${selProject.id}`;
                      return (
                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                          <datalist id={datalistId}>
                            {suggestions.map((s, i) => <option key={i} value={s} />)}
                          </datalist>
                          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                            <div style={{ flex: 2, minWidth: 180 }}>
                              <label style={{ display: "block", fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Tâche de production</label>
                              <input
                                list={datalistId}
                                value={taskForm.title || ""}
                                onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && taskForm.title && addTask(selProject.id)}
                                placeholder="Sélectionner ou taper une tâche..."
                                style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "8px 10px", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}
                              />
                            </div>
                            <div style={{ flex: 1, minWidth: 140 }}>
                              <label style={{ display: "block", fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Assigné à</label>
                              <select value={taskForm.assigneeId || ""} onChange={e => {
                                const member = [...(data.team || []), ...data.providers].find(m => m.id === e.target.value);
                                setTaskForm(f => ({ ...f, assigneeId: e.target.value, assigneeName: member?.name || "" }));
                              }} style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "8px 10px", fontSize: 13, fontFamily: "inherit" }}>
                                <option value="">— Personne</option>
                                {(data.team || []).length > 0 && <optgroup label="Team">{(data.team || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>}
                                {data.providers.length > 0 && <optgroup label="Prestas">{data.providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
                              </select>
                            </div>
                            <button onClick={() => addTask(selProject.id)} disabled={!taskForm.title} style={{
                              padding: "10px 16px", background: taskForm.title ? "var(--gold)" : "var(--surface-3)", color: taskForm.title ? "var(--gold-ink)" : "var(--text-3)",
                              border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: taskForm.title ? "pointer" : "not-allowed", fontFamily: "inherit", whiteSpace: "nowrap",
                            }}>+ Ajouter</button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── Barre de sélection / actions groupées ── */}
                    {(selProject.tasks || []).length > 0 && (() => {
                      const allIds = (selProject.tasks || []).map(t => t.id);
                      const allSelected = allIds.length > 0 && allIds.every(id => selectedTasks.has(id));
                      const someSelected = selectedTasks.size > 0;
                      return (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: someSelected ? "var(--gold-soft)" : "var(--surface)", border: `1px solid ${someSelected ? "var(--gold-hover)" : "var(--border)"}`, borderRadius: 8, marginBottom: 4, transition: "all 0.15s" }}>
                          {/* Select all checkbox */}
                          <div onClick={() => setSelectedTasks(allSelected ? new Set() : new Set(allIds))}
                            style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${allSelected ? "var(--gold)" : someSelected ? "var(--gold)" : "var(--border)"}`, background: allSelected ? "var(--gold)" : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s" }}>
                            {allSelected && <span style={{ color: "var(--gold-ink)", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                            {!allSelected && someSelected && <span style={{ color: "var(--gold)", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>—</span>}
                          </div>
                          {someSelected ? (
                            <>
                              <span style={{ fontSize: 12, color: "var(--gold)", fontWeight: 600 }}>{selectedTasks.size} sélectionnée{selectedTasks.size > 1 ? "s" : ""}</span>
                              <div style={{ flex: 1 }} />
                              <button onClick={() => bulkUpdateTasks(selectedTasks, { status: "done" }, selProject.id)}
                                style={{ padding: "5px 12px", background: "var(--success-soft)", border: "1px solid var(--success)", borderRadius: 6, color: "var(--success)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                ✓ Valider
                              </button>
                              <button onClick={() => bulkUpdateTasks(selectedTasks, { status: "todo" }, selProject.id)}
                                style={{ padding: "5px 12px", background: "var(--info-soft)", border: "1px solid var(--info)", borderRadius: 6, color: "var(--info)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                ↩ Invalider
                              </button>
                              <button onClick={async () => { if (await confirm({ title: `Supprimer ${selectedTasks.size} tâche${selectedTasks.size > 1 ? "s" : ""} ?`, confirmLabel: 'Supprimer' })) bulkDeleteTasks(selectedTasks, selProject.id); }}
                                style={{ padding: "5px 12px", background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: 6, color: "var(--danger)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                ✕ Supprimer
                              </button>
                              <button onClick={() => setSelectedTasks(new Set())}
                                style={{ padding: "5px 8px", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-3)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                                Annuler
                              </button>
                            </>
                          ) : (
                            <span style={{ fontSize: 11, color: "var(--text-3)" }}>Sélectionner tout</span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Task list — vue kanban simple par statut */}
                    {(selProject.tasks || []).length === 0 ? (
                      <div style={{ textAlign: "center", padding: 40, color: "var(--text-3)", fontSize: 13, background: "var(--surface)", borderRadius: 12, border: "1px dashed var(--border)" }}>
                        Les tâches de production seront générées automatiquement à la création du projet depuis un template.<br />
                        <span style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6, display: "block" }}>Ou ajoute une tâche manuellement ci-dessus.</span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {(() => {
                          try {
                          const allTasks = (selProject.tasks || []).slice();
                          // Use production phases (from Timeline) as authoritative phase structure
                          const productionPhases = (selProject.phases || [])
                            .slice()
                            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                          const usedIds = new Set();
                          const grouped = productionPhases.map(phase => {
                            const matched = allTasks
                              .filter(t => t.phaseGroup === phase.name)
                              .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                            matched.forEach(t => usedIds.add(t.id));
                            return { label: phase.name, color: phase.color || 'var(--gold)', tasks: matched };
                          });
                          // Tasks not assigned to any production phase
                          const unmatched = allTasks
                            .filter(t => !usedIds.has(t.id))
                            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                          if (unmatched.length > 0) grouped.push({ label: "Non assignées", color: "var(--text-3)", tasks: unmatched });

                          const elements = [];
                          let prevRenderedGroup = null;
                          const validations = selProject.taskPhaseValidations || {};
                          grouped.forEach(group => {
                            if (group.tasks.length === 0) return;
                            const isAddingHere = addingInPhase === group.label;
                            const isDragOver = dragOverPhase === group.label;
                            const isValidated = !!validations[group.label];
                            const doneCount = group.tasks.filter(t => t.status === "done").length;

                            // Gate de validation — référence le groupe PRÉCÉDEMMENT RENDU
                            if (prevRenderedGroup) {
                              const prevLabel = prevRenderedGroup.label;
                              const prevValidated = !!validations[prevLabel];
                              const prevDone = prevRenderedGroup.tasks.filter(t => t.status === "done").length;
                              const prevTotal = prevRenderedGroup.tasks.length;
                              elements.push(
                                <div key={`gate-${group.label}`} style={{ margin: "8px 0", display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ flex: 1, height: 1, background: "var(--surface-3)" }} />
                                  <button onClick={() => togglePhaseValidation(selProject.id, prevLabel)} style={{
                                    padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                                    background: prevValidated ? "var(--success-soft)" : prevDone === prevTotal && prevTotal > 0 ? "var(--gold-soft)" : "var(--surface)",
                                    border: `1px solid ${prevValidated ? "var(--success)" : prevDone === prevTotal && prevTotal > 0 ? "var(--gold)" : "var(--border)"}`,
                                    color: prevValidated ? "var(--success)" : prevDone === prevTotal && prevTotal > 0 ? "var(--gold)" : "var(--text-3)",
                                  }}>
                                    {prevValidated ? "✓ Client validé" : prevDone === prevTotal && prevTotal > 0 ? "⏳ Soumettre au client" : `${prevDone}/${prevTotal} tâches`}
                                  </button>
                                  <div style={{ flex: 1, height: 1, background: "var(--surface-3)" }} />
                                </div>
                              );
                            }

                            elements.push(
                              <div key={`ph-${group.label}`}
                                onDragOver={e => { e.preventDefault(); setDragOverPhase(group.label); }}
                                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverPhase(null); }}
                                onDrop={e => { e.preventDefault(); const tid = e.dataTransfer.getData('taskId'); if (tid) { moveTaskToPhase(tid, group.label); setDraggingTask(null); setDragOverPhase(null); } }}
                                style={{ marginTop: prevRenderedGroup ? 4 : 2, marginBottom: 2, borderRadius: 10, border: `2px solid ${isDragOver ? group.color : "transparent"}`, background: isDragOver ? `${alpha(group.color, 8)}` : "transparent", padding: isDragOver ? 6 : 4, boxShadow: isDragOver ? `0 0 0 4px ${alpha(group.color, 9)}` : "none", transition: "all 0.12s" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 4px" }}>
                                  <div style={{ width: 3, height: 13, borderRadius: 2, background: isValidated ? "var(--success)" : group.color, flexShrink: 0 }} />
                                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: isValidated ? "var(--success)" : group.color }}>
                                    {isValidated ? "✓ " : ""}{group.label}
                                  </span>
                                  <div style={{ flex: 1, height: 1, background: `${alpha(group.color, 16)}` }} />
                                  <span style={{ fontSize: 10, color: "var(--text-3)" }}>{doneCount}/{group.tasks.length}</span>
                                  <button onClick={() => { setAddingInPhase(isAddingHere ? null : group.label); setNewTaskInPhase(''); }}
                                    style={{ padding: "2px 8px", background: isAddingHere ? `${alpha(group.color, 13)}` : "transparent", border: `1px solid ${isAddingHere ? group.color : "var(--text-3)"}`, borderRadius: 4, color: isAddingHere ? group.color : "var(--text-3)", fontSize: 11, cursor: "pointer", fontFamily: "inherit", lineHeight: 1.4 }}>
                                    {isAddingHere ? "✕" : "+ Tâche"}
                                  </button>
                                </div>
                                {isAddingHere && (
                                  <div style={{ display: "flex", gap: 6, marginTop: 5, marginBottom: 2, padding: "0 4px" }}>
                                    <input autoFocus value={newTaskInPhase} onChange={e => setNewTaskInPhase(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter') addTaskInPhase(selProject.id, group.label, group.color); if (e.key === 'Escape') { setAddingInPhase(null); setNewTaskInPhase(''); } }}
                                      placeholder="Nom de la tâche..."
                                      style={{ flex: 1, background: "var(--surface)", border: `1px solid ${alpha(group.color, 33)}`, borderRadius: 6, color: "var(--text)", padding: "7px 10px", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                                    <button onClick={() => addTaskInPhase(selProject.id, group.label, group.color)} disabled={!newTaskInPhase.trim()}
                                      style={{ padding: "7px 14px", background: newTaskInPhase.trim() ? group.color : "var(--text-3)", color: newTaskInPhase.trim() ? "var(--gold-ink)" : "var(--text-3)", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: newTaskInPhase.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
                                      ↵ Ajouter
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                            prevRenderedGroup = group;
                            group.tasks.forEach(task => {
                          const st = TASK_STATUSES.find(s => s.key === task.status) || TASK_STATUSES[0];
                          const tt = TASK_TYPES.find(t => t.key === task.phase) || null;
                          const isLate = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";
                          const isEditing = editingTask === task.id;
                          const isHovered = hoveredTask === task.id;
                          const isSelected = selectedTasks.has(task.id);
                          const isDragging = draggingTask === task.id;
                          elements.push(
                            <div key={task.id}
                              onMouseEnter={() => setHoveredTask(task.id)}
                              onMouseLeave={() => setHoveredTask(null)}
                              style={{
                                background: isSelected ? "var(--gold-soft)" : isEditing ? "var(--surface-2)" : isHovered ? "var(--surface-2)" : "var(--surface)",
                                border: `1px solid ${isSelected ? "var(--gold)" : isEditing ? "var(--gold-hover)" : isHovered ? "var(--border)" : "var(--border)"}`,
                                borderRadius: 7, borderLeft: `3px solid ${isSelected ? "var(--gold)" : tt ? tt.color : st.color}`,
                                opacity: isDragging ? 0.3 : task.status === "done" ? 0.45 : 1,
                                transition: "all 0.1s", transform: isDragging ? "scale(0.98)" : "scale(1)",
                              }}>
                              {/* Ligne principale */}
                              <div style={{ padding: "7px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                                {/* ── DRAG HANDLE ── toujours visible, curseur grab */}
                                <div
                                  draggable
                                  onDragStart={e => { e.dataTransfer.setData('taskId', task.id); setDraggingTask(task.id); e.dataTransfer.effectAllowed = 'move'; }}
                                  onDragEnd={() => { setDraggingTask(null); setDragOverPhase(null); }}
                                  title="Glisser pour changer de phase"
                                  style={{
                                    display: "flex", flexDirection: "column", gap: 2, padding: "4px 3px", cursor: "grab", flexShrink: 0,
                                    opacity: isHovered ? 0.7 : 0.2, transition: "opacity 0.15s",
                                  }}>
                                  {[0,1,2].map(i => (
                                    <div key={i} style={{ display: "flex", gap: 2 }}>
                                      <div style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--text-3)" }} />
                                      <div style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--text-3)" }} />
                                    </div>
                                  ))}
                                </div>
                                {/* Selection checkbox — visible on hover or when active */}
                                <div onClick={() => setSelectedTasks(prev => { const s = new Set(prev); s.has(task.id) ? s.delete(task.id) : s.add(task.id); return s; })}
                                  style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${isSelected ? "var(--gold)" : "var(--border)"}`, background: isSelected ? "var(--gold)" : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s", opacity: isSelected || isHovered || selectedTasks.size > 0 ? 1 : 0 }}>
                                  {isSelected && <span style={{ color: "var(--gold-ink)", fontSize: 9, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                                </div>
                                {/* Done/todo toggle */}
                                <div onClick={() => updateTask(task.id, { status: task.status === "done" ? "todo" : "done" }, selProject.id)} style={{
                                  width: 20, height: 20, borderRadius: "50%", border: `2px solid ${task.status === "done" ? "var(--success)" : "var(--border-2)"}`,
                                  background: task.status === "done" ? "var(--success)" : "transparent",
                                  cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                                }}>
                                  {task.status === "done" && <span style={{ color: "var(--gold-ink)", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                                </div>
                                {/* Contenu */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    {tt && (
                                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: tt.color, background: `${alpha(tt.color, 9)}`, padding: "2px 7px", borderRadius: 4, border: `1px solid ${alpha(tt.color, 20)}`, whiteSpace: "nowrap" }}>
                                        {tt.label}
                                      </span>
                                    )}
                                    <span style={{ fontSize: 13, fontWeight: 600, color: task.status === "done" ? "var(--text-3)" : "var(--text)", textDecoration: task.status === "done" ? "line-through" : "none" }}>{task.title}</span>
                                  </div>
                                </div>
                                {/* Quick-assign + actions */}
                                <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0, opacity: (isHovered || isEditing || task.assigneeName) ? 1 : 0, transition: "opacity 0.1s" }}>
                                  {/* Quick-assign : dropdown inline */}
                                  <div style={{ position: "relative" }}>
                                    <button onClick={() => setQuickAssignTask(quickAssignTask === task.id ? null : task.id)} style={{
                                      padding: "4px 10px", background: task.assigneeName ? "var(--gold-soft)" : "transparent",
                                      border: `1px solid ${task.assigneeName ? "var(--gold-hover)" : "var(--border)"}`,
                                      borderRadius: 5, color: task.assigneeName ? "var(--gold)" : "var(--text-3)",
                                      fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, whiteSpace: "nowrap",
                                    }}>
                                      {task.assigneeName ? `→ ${task.assigneeName}` : "+ Assigner"}
                                    </button>
                                    {quickAssignTask === task.id && (
                                      <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 50, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, minWidth: 180, boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
                                        <div onClick={() => { updateTask(task.id, { assigneeId: null, assigneeName: "" }, selProject.id); setQuickAssignTask(null); }}
                                          style={{ padding: "8px 14px", fontSize: 12, color: "var(--text-3)", cursor: "pointer", borderBottom: "1px solid var(--border)" }}>
                                          — Non assigné
                                        </div>
                                        {(data.team || []).length > 0 && (
                                          <>
                                            <div style={{ padding: "4px 14px 2px", fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Team</div>
                                            {(data.team || []).map(m => (
                                              <div key={m.id} onClick={() => { updateTask(task.id, { assigneeId: m.id, assigneeName: m.name }, selProject.id); setQuickAssignTask(null); }}
                                                style={{ padding: "8px 14px", fontSize: 12, color: "var(--text)", cursor: "pointer", background: task.assigneeId === m.id ? "var(--gold-soft)" : "transparent" }}>
                                                {m.name}
                                              </div>
                                            ))}
                                          </>
                                        )}
                                        {data.providers.length > 0 && (
                                          <>
                                            <div style={{ padding: "4px 14px 2px", fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", borderTop: (data.team || []).length > 0 ? "1px solid var(--border)" : "none" }}>Prestas</div>
                                            {data.providers.map(p => (
                                              <div key={p.id} onClick={() => { updateTask(task.id, { assigneeId: p.id, assigneeName: p.name }, selProject.id); setQuickAssignTask(null); }}
                                                style={{ padding: "8px 14px", fontSize: 12, color: "var(--text)", cursor: "pointer", background: task.assigneeId === p.id ? "var(--gold-soft)" : "transparent" }}>
                                                {p.name}
                                              </div>
                                            ))}
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {task.dueDate && (
                                    <span style={{ fontSize: 11, color: isLate ? "var(--danger)" : "var(--text-3)", whiteSpace: "nowrap" }}>
                                      {isLate ? "⚠ " : ""}{new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                    </span>
                                  )}
                                  <button onClick={() => { setEditingTask(isEditing ? null : task.id); }} title="Configurer" style={{
                                    padding: "4px 8px", background: isEditing ? "var(--gold-soft)" : "transparent",
                                    border: `1px solid ${isEditing ? "var(--gold)" : "var(--border)"}`, borderRadius: 5,
                                    color: isEditing ? "var(--gold)" : "var(--text-3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", lineHeight: 1,
                                  }}>⚙</button>
                                  <button onClick={() => deleteTask(task.id, selProject.id)} style={{
                                    padding: "4px 8px", background: "transparent", border: "1px solid var(--border)", borderRadius: 5,
                                    color: "var(--danger)", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                                  }}>✕</button>
                                </div>
                              </div>

                              {/* Panneau inline — visible si cliqué */}
                              {isEditing && (
                                <div style={{ padding: "10px 12px 12px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", borderTop: "1px solid var(--border)" }}>
                                  {/* Type de tâche */}
                                  <div style={{ flex: 1, minWidth: 140 }}>
                                    <label style={{ display: "block", fontSize: 11, color: "var(--text-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Type</label>
                                    <select value={task.phase || ""} onChange={e => updateTask(task.id, { phase: e.target.value }, selProject.id)} style={{
                                      width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "7px 10px", fontSize: 13, fontFamily: "inherit", cursor: "pointer",
                                    }}>
                                      <option value="">— Aucun type</option>
                                      {TASK_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                                    </select>
                                  </div>
                                  {/* Assigné à */}
                                  <div style={{ flex: 2, minWidth: 160 }}>
                                    <label style={{ display: "block", fontSize: 11, color: "var(--text-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Assigner à</label>
                                    <select value={task.assigneeId || ""} onChange={e => {
                                      const found = [...(data.team || []), ...data.providers].find(m => m.id === e.target.value);
                                      updateTask(task.id, { assigneeId: e.target.value || null, assigneeName: found?.name || "" }, selProject.id);
                                    }} style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "7px 10px", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>
                                      <option value="">— Non assigné</option>
                                      {(data.team || []).length > 0 && <optgroup label="Team">{(data.team || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>}
                                      {data.providers.length > 0 && <optgroup label="Prestas">{data.providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
                                    </select>
                                  </div>
                                  {/* Deadline */}
                                  <div style={{ flex: 1, minWidth: 120 }}>
                                    <label style={{ display: "block", fontSize: 11, color: "var(--text-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Deadline</label>
                                    <input type="date" value={task.dueDate || ""} onChange={e => updateTask(task.id, { dueDate: e.target.value }, selProject.id)}
                                      style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "7px 10px", fontSize: 13, fontFamily: "inherit" }} />
                                  </div>
                                  <button onClick={() => setEditingTask(null)} style={{
                                    padding: "8px 14px", background: "var(--gold)", color: "var(--gold-ink)", border: "none", borderRadius: 6,
                                    fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                                  }}>✓</button>
                                </div>
                              )}
                            </div>
                          );
                            }); // end group.tasks.forEach
                          }); // end grouped.forEach
                          return elements;
                          } catch(e) {
                            console.error('Task grouping error:', e);
                            return (selProject.tasks || []).map(task => (
                              <div key={task.id} style={{ padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 13, color: "var(--text)" }}>
                                {task.title}
                              </div>
                            ));
                          }
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* ── TIMELINE TAB ── */}
                {projectTab === "timeline" && (() => {
                  const phases = selProject.phases || [];
                  const postings = selProject.postings || [];
                  const projStart = selProject.startDate ? new Date(selProject.startDate) : null;
                  const projEnd = selProject.endDate ? new Date(selProject.endDate) : null;
                  const today = new Date();
                  const PHASE_COLORS = ['#C46B3D','#B07A0E','#2670B4','#8347A1','#1E8449','#C9821C','#B83328','#5C5246']; // palette persistee en base (alignee PhasesPanel) - pas de tokens ici

                  // Calcul position % sur la timeline
                  const pct = (date) => {
                    if (!projStart || !projEnd || !date) return null;
                    const total = projEnd - projStart;
                    if (total <= 0) return null;
                    return Math.max(0, Math.min(100, ((new Date(date) - projStart) / total) * 100));
                  };
                  const todayPct = pct(today);

                  return (
                    <div>
                      {/* Gantt */}
                      {projStart && projEnd ? (
                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
                          <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
                            Timeline du projet — {selProject.startDate} → {selProject.endDate}
                          </div>

                          {/* Barre projet + phases */}
                          <div style={{ position: "relative", marginBottom: 8 }}>
                            {/* Rail */}
                            <div style={{ height: 6, background: "var(--surface-3)", borderRadius: 3, position: "relative", marginBottom: 4 }}>
                              {/* Phases blocs */}
                              {phases.map(ph => {
                                const left = pct(ph.startDate);
                                const right = pct(ph.endDate);
                                if (left === null || right === null) return null;
                                return (
                                  <div key={ph.id} style={{
                                    position: "absolute", top: -3, height: 12, borderRadius: 3,
                                    left: `${left}%`, width: `${right - left}%`,
                                    background: ph.color, opacity: ph.locked ? 0.4 : 0.85,
                                    cursor: "default",
                                  }} title={`${ph.name}${ph.locked ? " (lockée)" : ""}`} />
                                );
                              })}
                              {/* Today marker */}
                              {todayPct !== null && todayPct >= 0 && todayPct <= 100 && (
                                <div style={{ position: "absolute", top: -8, left: `${todayPct}%`, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", zIndex: 10 }}>
                                  <div style={{ width: 2, height: 22, background: "var(--gold)", borderRadius: 1 }} />
                                </div>
                              )}
                            </div>

                            {/* Postings markers ◆ */}
                            <div style={{ position: "relative", height: 24 }}>
                              {postings.map(po => {
                                const p = pct(po.postedAt);
                                if (p === null) return null;
                                const phase = phases.find(ph => ph.id === po.phaseId);
                                return (
                                  <div key={po.id} title={`Posting ${po.postedAt}${po.note ? ` — ${po.note}` : ""}`}
                                    style={{ position: "absolute", left: `${p}%`, transform: "translateX(-50%)", top: 2, fontSize: 12, color: phase?.color || "var(--gold)", cursor: "default" }}>◆</div>
                                );
                              })}
                              {/* Today label */}
                              {todayPct !== null && todayPct >= 0 && todayPct <= 100 && (
                                <div style={{ position: "absolute", left: `${todayPct}%`, transform: "translateX(-50%)", top: 6, fontSize: 9, color: "var(--gold)", fontWeight: 700, whiteSpace: "nowrap" }}>auj.</div>
                              )}
                            </div>

                            {/* Dates extrêmes */}
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
                              <span>{selProject.startDate}</span>
                              <span>{selProject.endDate}</span>
                            </div>
                          </div>

                          {/* Légende phases */}
                          {phases.length > 0 && (
                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                              {phases.map(ph => (
                                <div key={ph.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                  <div style={{ width: 10, height: 10, borderRadius: 2, background: ph.color, opacity: ph.locked ? 0.4 : 1 }} />
                                  <span style={{ fontSize: 11, color: ph.locked ? "var(--text-3)" : "var(--text-3)" }}>{ph.name}{ph.locked ? " 🔒" : ""}</span>
                                </div>
                              ))}
                              {todayPct !== null && <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 2, height: 10, background: "var(--gold)", borderRadius: 1 }} /><span style={{ fontSize: 11, color: "var(--gold)" }}>Aujourd'hui</span></div>}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 12, padding: 20, marginBottom: 20, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                          Ajoute des dates de début et fin au projet pour voir la timeline.
                        </div>
                      )}

                      {/* Phases list + gestion */}
                      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                            Phases de production ({phases.length})
                          </div>
                        </div>

                        {/* Add phase form */}
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
                          <div style={{ flex: 2, minWidth: 140 }}>
                            <label style={{ display: "block", fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Nom de la phase</label>
                            <input value={phaseForm.name || ""} onChange={e => setPhaseForm(f => ({ ...f, name: e.target.value }))} placeholder="Phase 1 : Design..." onKeyDown={e => e.key === 'Enter' && addPhase(selProject.id)}
                              style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "7px 10px", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
                          </div>
                          <div style={{ minWidth: 100 }}>
                            <label style={{ display: "block", fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Début</label>
                            <input type="date" value={phaseForm.startDate || ""} onChange={e => setPhaseForm(f => ({ ...f, startDate: e.target.value }))}
                              style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-2)", padding: "7px 8px", fontSize: 12, fontFamily: "inherit" }} />
                          </div>
                          <div style={{ minWidth: 100 }}>
                            <label style={{ display: "block", fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Fin</label>
                            <input type="date" value={phaseForm.endDate || ""} onChange={e => setPhaseForm(f => ({ ...f, endDate: e.target.value }))}
                              style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-2)", padding: "7px 8px", fontSize: 12, fontFamily: "inherit" }} />
                          </div>
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            {PHASE_COLORS.map((c, ci) => (
                              <div key={ci} onClick={() => setPhaseForm(f => ({ ...f, color: c }))}
                                style={{ width: 18, height: 18, borderRadius: 4, background: c, cursor: "pointer", border: phaseForm.color === c ? "2px solid var(--text)" : "2px solid transparent", transition: "all 0.1s" }} />
                            ))}
                          </div>
                          <button onClick={() => addPhase(selProject.id)} disabled={!phaseForm.name} style={{
                            padding: "8px 14px", background: phaseForm.name ? "var(--gold)" : "var(--surface-3)", color: phaseForm.name ? "var(--gold-ink)" : "var(--text-3)",
                            border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: phaseForm.name ? "pointer" : "not-allowed", fontFamily: "inherit",
                          }}>+ Phase</button>
                        </div>

                        {/* Phase list */}
                        {phases.length === 0 ? (
                          <div style={{ color: "var(--text-3)", fontSize: 12, fontStyle: "italic", textAlign: "center", padding: 12 }}>Aucune phase — crée la première ci-dessus.</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {phases.map((ph, idx) => {
                              const phPostings = postings.filter(po => po.phaseId === ph.id);
                              const isOpenPosting = openPostingPhase === ph.id;
                              const isEditingPhase = editingPhase === ph.id;
                              return (
                                <div key={ph.id} style={{ background: "var(--bg)", border: `1px solid ${ph.locked ? "var(--border)" : "var(--border)"}`, borderRadius: 10, borderLeft: `3px solid ${ph.color}`, overflow: "hidden" }}>
                                  {/* Phase row */}
                                  <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{ width: 12, height: 12, borderRadius: 3, background: ph.color, flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                      {isEditingPhase ? (
                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                                          <input defaultValue={ph.name} onBlur={e => { updatePhase(ph.id, { name: e.target.value }, selProject.id); setEditingPhase(null); }}
                                            autoFocus style={{ background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 5, color: "var(--text)", padding: "4px 8px", fontSize: 13, fontFamily: "inherit" }} />
                                          <input type="date" defaultValue={ph.startDate} onBlur={e => updatePhase(ph.id, { startDate: e.target.value }, selProject.id)}
                                            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 5, color: "var(--text-2)", padding: "4px 6px", fontSize: 12, fontFamily: "inherit" }} />
                                          <span style={{ color: "var(--text-3)", fontSize: 11 }}>→</span>
                                          <input type="date" defaultValue={ph.endDate} onBlur={e => updatePhase(ph.id, { endDate: e.target.value }, selProject.id)}
                                            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 5, color: "var(--text-2)", padding: "4px 6px", fontSize: 12, fontFamily: "inherit" }} />
                                        </div>
                                      ) : (
                                        <div>
                                          <span style={{ fontSize: 13, fontWeight: 600, color: ph.locked ? "var(--text-3)" : "var(--text)" }}>{ph.name}</span>
                                          {(ph.startDate || ph.endDate) && (
                                            <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 8 }}>{ph.startDate || "?"} → {ph.endDate || "?"}</span>
                                          )}
                                          {phPostings.length > 0 && (
                                            <span style={{ fontSize: 10, marginLeft: 8, color: ph.color }}>◆ {phPostings.length} posting{phPostings.length > 1 ? "s" : ""}</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                      <button onClick={() => setOpenPostingPhase(isOpenPosting ? null : ph.id)} style={{
                                        padding: "3px 8px", fontSize: 11, background: isOpenPosting ? "var(--gold-soft)" : "transparent", border: `1px solid ${isOpenPosting ? "var(--gold-hover)" : "var(--border)"}`,
                                        color: isOpenPosting ? "var(--gold)" : "var(--text-3)", borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
                                      }}>◆ Posting</button>
                                      <button onClick={() => updatePhase(ph.id, { locked: !ph.locked }, selProject.id)} style={{
                                        padding: "3px 8px", fontSize: 11, background: ph.locked ? "var(--success-soft)" : "transparent", border: `1px solid ${ph.locked ? "var(--success-soft)" : "var(--border)"}`,
                                        color: ph.locked ? "var(--success)" : "var(--text-3)", borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
                                      }}>{ph.locked ? "🔒 Lockée" : "Locker"}</button>
                                      <button onClick={() => setEditingPhase(isEditingPhase ? null : ph.id)} style={{
                                        padding: "3px 6px", fontSize: 12, background: "transparent", border: "1px solid var(--border)", color: "var(--text-3)", borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
                                      }}>✎</button>
                                      <button onClick={() => deletePhase(ph.id, selProject.id)} style={{
                                        padding: "3px 6px", fontSize: 11, background: "transparent", border: "1px solid var(--border)", color: "var(--danger)", borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
                                      }}>✕</button>
                                    </div>
                                  </div>

                                  {/* Postings panel */}
                                  {isOpenPosting && (
                                    <div style={{ borderTop: "1px solid var(--border)", padding: "10px 14px", background: "var(--bg)" }}>
                                      {phPostings.length > 0 && (
                                        <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                                          {phPostings.map(po => (
                                            <div key={po.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "var(--surface)", borderRadius: 6 }}>
                                              <span style={{ color: ph.color, fontSize: 11 }}>◆</span>
                                              <span style={{ fontSize: 11, color: "var(--gold)", fontWeight: 700, whiteSpace: "nowrap" }}>{po.postedAt}</span>
                                              <span style={{ fontSize: 12, color: "var(--text-3)", flex: 1 }}>{po.note || <span style={{ color: "var(--text-3)", fontStyle: "italic" }}>—</span>}</span>
                                              <button onClick={() => deletePosting(po.id, selProject.id)} style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 13, padding: 0 }}>×</button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                                        <input type="date" value={postingForm.postedAt} onChange={e => setPostingForm(f => ({ ...f, postedAt: e.target.value }))}
                                          style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-2)", padding: "6px 8px", fontSize: 12, fontFamily: "inherit" }} />
                                        <input type="text" value={postingForm.note} onChange={e => setPostingForm(f => ({ ...f, note: e.target.value }))} placeholder="Ce qui a été soumis au client..." onKeyDown={e => e.key === 'Enter' && addPosting(selProject.id, ph.id)}
                                          style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "6px 10px", fontSize: 12, fontFamily: "inherit" }} />
                                        <button onClick={() => addPosting(selProject.id, ph.id)} style={{ padding: "6px 12px", background: "var(--gold)", color: "var(--gold-ink)", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>◆ Log</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* JOURNAL TAB */}
                {projectTab === "journal" && (() => {
                  const LOG_TYPES = [
                    { key: "call",     label: "📞 Appel",           color: "var(--info)" },
                    { key: "email",    label: "✉️ Email",            color: "var(--success)" },
                    { key: "decision", label: "💡 Décision",         color: "var(--gold)" },
                    { key: "scope",    label: "🔄 Changement scope", color: "var(--warning)" },
                    { key: "feedback", label: "💬 Feedback client",  color: "var(--pillar-prod)" },
                    { key: "alert",    label: "⚠️ Problème",         color: "var(--danger)" },
                    { key: "payment",  label: "💰 Paiement",         color: "var(--success)" },
                    { key: "note",     label: "📝 Note interne",     color: "var(--text-3)"    },
                  ];
                  const journal = [...(selProject.projectJournal || [])].sort((a, b) => (b.loggedAt || b.createdAt || '') > (a.loggedAt || a.createdAt || '') ? 1 : -1);

                  const addEntry = async () => {
                    if (!journalForm.content.trim()) return;
                    const entry = {
                      id: `jl_${Date.now()}`,
                      type: journalForm.type,
                      content: journalForm.content.trim(),
                      loggedAt: journalForm.loggedAt,
                      createdAt: new Date().toISOString(),
                    };
                    const updated = [entry, ...(selProject.projectJournal || [])];
                    await fetch(`/api/projects/${selProject.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ projectJournal: updated }) });
                    const fresh = await fetch('/api/data').then(r => r.json());
                    setData(fresh);
                    setSelProject(fresh.projects.find(p => p.id === selProject.id));
                    setJournalForm(f => ({ ...f, content: "", loggedAt: new Date().toISOString().slice(0, 10) }));
                  };

                  const deleteEntry = async (entryId) => {
                    const updated = (selProject.projectJournal || []).filter(e => e.id !== entryId);
                    await fetch(`/api/projects/${selProject.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ projectJournal: updated }) });
                    const fresh = await fetch('/api/data').then(r => r.json());
                    setData(fresh);
                    setSelProject(fresh.projects.find(p => p.id === selProject.id));
                  };

                  const typeInfo = (key) => LOG_TYPES.find(t => t.key === key) || LOG_TYPES[LOG_TYPES.length - 1];

                  return (
                    <div>
                      {/* Quick add */}
                      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Nouvelle entrée</div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                          {LOG_TYPES.map(t => (
                            <button key={t.key} onClick={() => setJournalForm(f => ({ ...f, type: t.key }))} style={{
                              padding: "5px 12px", borderRadius: 20, fontSize: 12, fontFamily: "inherit", cursor: "pointer",
                              background: journalForm.type === t.key ? `${alpha(t.color, 13)}` : "var(--bg)",
                              border: `1px solid ${journalForm.type === t.key ? t.color : "var(--text-3)"}`,
                              color: journalForm.type === t.key ? t.color : "var(--text-3)",
                              transition: "all 0.12s",
                            }}>{t.label}</button>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                          <input type="date" value={journalForm.loggedAt} onChange={e => setJournalForm(f => ({ ...f, loggedAt: e.target.value }))}
                            style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-3)", padding: "8px 10px", fontSize: 12, fontFamily: "inherit", outline: "none", flexShrink: 0 }} />
                          <textarea value={journalForm.content} onChange={e => setJournalForm(f => ({ ...f, content: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addEntry(); }}
                            placeholder="Note rapide, décision, CR d'appel... (⌘↵ pour valider)"
                            style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-2)", padding: "8px 12px", fontSize: 13, fontFamily: "'Geist Sans', 'DM Sans', sans-serif", lineHeight: 1.5, resize: "none", minHeight: 60, outline: "none" }} />
                          <button onClick={addEntry} disabled={!journalForm.content.trim()} style={{
                            padding: "10px 18px", background: journalForm.content.trim() ? "var(--gold)" : "var(--surface-3)",
                            border: "none", borderRadius: 8, color: journalForm.content.trim() ? "var(--gold-ink)" : "var(--text-3)",
                            fontSize: 13, fontWeight: 700, cursor: journalForm.content.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", flexShrink: 0,
                          }}>+ Ajouter</button>
                        </div>
                      </div>

                      {/* Timeline */}
                      {journal.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-3)", fontSize: 13 }}>
                          Aucune entrée — commence par noter le premier call ou décision
                        </div>
                      ) : (
                        <div style={{ position: "relative" }}>
                          {/* Ligne verticale */}
                          <div style={{ position: "absolute", left: 19, top: 0, bottom: 0, width: 2, background: "var(--surface-2)", borderRadius: 1 }} />
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {journal.map((entry, idx) => {
                              const ti = typeInfo(entry.type);
                              const isFirst = idx === 0;
                              return (
                                <div key={entry.id} style={{ display: "flex", gap: 14, alignItems: "flex-start", position: "relative" }}>
                                  {/* Dot */}
                                  <div style={{
                                    width: 16, height: 16, borderRadius: "50%", background: ti.color, flexShrink: 0, marginTop: 14,
                                    boxShadow: isFirst ? `0 0 0 4px ${alpha(ti.color, 20)}` : "none", zIndex: 1, border: "2px solid var(--surface)",
                                  }} />
                                  {/* Card */}
                                  <div style={{
                                    flex: 1, background: isFirst ? "var(--surface)" : "var(--surface)", border: `1px solid ${isFirst ? "var(--border)" : "var(--border)"}`,
                                    borderRadius: 10, padding: "12px 14px", marginBottom: 8,
                                  }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: ti.color, background: `${alpha(ti.color, 9)}`, padding: "2px 8px", borderRadius: 10, border: `1px solid ${alpha(ti.color, 20)}` }}>{ti.label}</span>
                                        <span style={{ fontSize: 11, color: "var(--text-3)" }}>{entry.loggedAt ? new Date(entry.loggedAt + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : "—"}</span>
                                      </div>
                                      <button onClick={() => deleteEntry(entry.id)} style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 13, padding: "2px 6px", borderRadius: 4 }}
                                        onMouseEnter={e => e.target.style.color = "var(--danger)"} onMouseLeave={e => e.target.style.color = "var(--text-3)"}>✕</button>
                                    </div>
                                    <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{entry.content}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* CREATIVE BRIEF TAB */}
                {projectTab === "brief" && (() => {
                  const brief = selProject.creativeBrief || {};
                  const saveBrief = async (field, value) => {
                    const updated = { ...brief, [field]: value };
                    await fetch(`/api/projects/${selProject.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ creativeBrief: updated }) });
                    const fresh = await fetch('/api/data').then(r => r.json());
                    setData(fresh);
                    setSelProject(fresh.projects.find(p => p.id === selProject.id));
                  };

                  const filled = ["goal","audience","parameters","checklists","references","milestones","deliverySpecs","taskAssignments"].filter(k => !!brief[k]).length;
                  const pct = Math.round(filled / 8 * 100);

                  return (
                    <div>
                      {/* Progress */}
                      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", marginBottom: 24 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Brief Créatif — PPM</div>
                            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>{filled}/8 sections complétées · sauvegarde automatique</div>
                          </div>
                          <div style={{ fontSize: 26, fontWeight: 800, color: pct === 100 ? "var(--success)" : "var(--gold)" }}>{pct}%</div>
                        </div>
                        <div style={{ height: 5, background: "var(--surface-3)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "var(--success)" : "var(--gold)", borderRadius: 3, transition: "width 0.4s" }} />
                        </div>
                      </div>

                      {/* Fields — 2 columns top */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 4 }}>
                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
                          <BriefField brief={brief} saveBrief={saveBrief} fieldKey="goal" label="Objectif" placeholder="Une phrase claire décrivant le but du projet..." hint="Court et précis — une seule phrase." />
                        </div>
                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
                          <BriefField brief={brief} saveBrief={saveBrief} fieldKey="audience" label="Audience & Utilisateurs" placeholder="Qui va voir / utiliser ce contenu ? Quels sont leurs défis ?" hint="Démographique cible, motivations, points de friction." />
                        </div>
                      </div>

                      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", marginBottom: 16 }}>
                        <BriefField brief={brief} saveBrief={saveBrief} fieldKey="parameters" label="Paramètres créatifs & considérations" large placeholder="Définissez le cadre créatif — ton, style, références, contraintes..." hint="Le sandbox créatif pour votre équipe. Soyez précis sans être trop restrictif." />
                      </div>

                      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", marginBottom: 16 }}>
                        <BriefField brief={brief} saveBrief={saveBrief} fieldKey="checklists" label="Mandates — Do's & Don'ts" placeholder="Ex: ✓ Sous-titres obligatoires ✓ Format 16:9 ✗ Pas de musique sous droits..." hint="Les règles binaires non-négociables du projet." />
                      </div>

                      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", marginBottom: 16 }}>
                        <BriefField brief={brief} saveBrief={saveBrief} fieldKey="references" label="Références additionnelles" placeholder="Liens, exemples visuels, projets similaires, benchmarks..." hint="Tout ce qui peut nourrir la réflexion créative de l'équipe." />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
                          <BriefField brief={brief} saveBrief={saveBrief} fieldKey="milestones" label="Jalons" placeholder="Dates clés du projet..." hint="Les deadlines importantes." />
                        </div>
                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
                          <BriefField brief={brief} saveBrief={saveBrief} fieldKey="deliverySpecs" label="Specs techniques" placeholder="Format, résolution, codec, plateformes..." hint="Les specs de livraison exactes." />
                        </div>
                        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
                          <BriefField brief={brief} saveBrief={saveBrief} fieldKey="taskAssignments" label="Assignations d'équipe" placeholder="Rôle, responsabilités, délais par membre..." hint="Personnalisé pour chaque membre de l'équipe." />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ONBOARDING TAB */}
                {projectTab === "onboarding" && (() => {
                  const obPhases = selProject.ppmPhases || {};
                  const closingItems = [
                    { key: "ob_c_0", label: "Accord verbal sur le prix / range" },
                    { key: "ob_c_1", label: "Dossier projet créé (Drive / Dropbox)" },
                    { key: "ob_c_2", label: "Devis rédigé & vérifié (ortho, chiffres, nom client)" },
                    { key: "ob_c_3", label: "Devis envoyé au client" },
                    { key: "ob_c_4", label: "Réception du devis confirmée" },
                    { key: "ob_c_5", label: "Client approuve / négocie / refuse le devis" },
                    { key: "ob_c_6", label: "Contrat rédigé & vérifié (ortho, chiffres, nom client)" },
                    { key: "ob_c_7", label: "Contrat envoyé au client" },
                    { key: "ob_c_8", label: "Réception du contrat confirmée" },
                    { key: "ob_c_9", label: "Client signe le contrat" },
                    { key: "ob_c_10", label: "Projet mis à jour dans LES GRIOTS OS (→ Contract)" },
                  ];
                  const kickoffGroups = [
                    {
                      label: "Organisation interne",
                      color: "var(--gold)",
                      items: [
                        { key: "ob_k_0", label: "Annonce interne & célébration 🎉" },
                        { key: "ob_k_1", label: "Équipe interne assignée" },
                        { key: "ob_k_2", label: "Prestataires sourcés / recrutés (si besoin)" },
                        { key: "ob_k_3", label: "Contrat signé uploadé dans le dossier projet" },
                        { key: "ob_k_4", label: "Feuille de suivi des coûts créée" },
                        { key: "ob_k_5", label: "Dossier projet créé avec dossier assets client" },
                        { key: "ob_k_6", label: "Planning de production créé" },
                      ],
                    },
                    {
                      label: "Communication client",
                      color: "var(--info)",
                      items: [
                        { key: "ob_k_7", label: "Email de bienvenue envoyé au client" },
                        { key: "ob_k_8", label: "Réponse personnelle envoyée (présentation équipe / process)" },
                        { key: "ob_k_9", label: "Email de suivi envoyé (compta, assets, roadmap, règles)" },
                        { key: "ob_k_10", label: "RDV Discovery planifié" },
                      ],
                    },
                    {
                      label: "Cadre de facturation",
                      color: "var(--pillar-prod)",
                      items: [
                        { key: "ob_k_11", label: "Client créé dans la compta (Pennylane)" },
                        { key: "ob_k_12", label: "Première facture / acompte envoyée" },
                        { key: "ob_k_13", label: "Réception de la facture confirmée" },
                        { key: "ob_k_14", label: "Premier paiement reçu" },
                        { key: "ob_k_15", label: "Suivi de trésorerie mis à jour" },
                      ],
                    },
                  ];
                  const allItems = [...closingItems, ...kickoffGroups.flatMap(g => g.items)];
                  const doneCount = allItems.filter(i => obPhases[i.key]).length;
                  const pct = Math.round(doneCount / allItems.length * 100);

                  const CheckItem = ({ item }) => {
                    const checked = !!obPhases[item.key];
                    return (
                      <div onClick={() => savePPMPhase(selProject.id, item.key, !checked)}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, cursor: "pointer", background: checked ? "var(--success-soft)" : "transparent", transition: "background 0.15s", userSelect: "none" }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: 6, border: `2px solid ${checked ? "var(--success)" : "var(--border-2)"}`,
                          background: checked ? "var(--success)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                        }}>
                          {checked && <span style={{ color: "var(--on-solid)", fontSize: 13, lineHeight: 1 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 13, color: checked ? "var(--text-3)" : "var(--text-2)", textDecoration: checked ? "line-through" : "none", transition: "all 0.15s" }}>{item.label}</span>
                      </div>
                    );
                  };

                  return (
                    <div>
                      {/* Progress header */}
                      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px", marginBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Checklist Onboarding PPM</div>
                            <div style={{ fontSize: 13, color: "var(--text-3)" }}>{doneCount} / {allItems.length} étapes complétées</div>
                          </div>
                          <div style={{ fontSize: 28, fontWeight: 800, color: pct === 100 ? "var(--success)" : "var(--gold)" }}>{pct}%</div>
                        </div>
                        <div style={{ height: 6, background: "var(--surface-3)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "var(--success)" : "var(--gold)", borderRadius: 3, transition: "width 0.4s" }} />
                        </div>
                        {pct === 100 && (
                          <div style={{ marginTop: 10, fontSize: 12, color: "var(--success)", fontWeight: 600 }}>✓ Onboarding complet — projet prêt à démarrer !</div>
                        )}
                      </div>

                      {/* CLOSING */}
                      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px", marginBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                          <div style={{ width: 3, height: 18, borderRadius: 2, background: "var(--gold)" }} />
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Closing — Signature</div>
                          <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-3)" }}>{closingItems.filter(i => obPhases[i.key]).length}/{closingItems.length}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {closingItems.map(item => <CheckItem key={item.key} item={item} />)}
                        </div>
                      </div>

                      {/* KICKOFF */}
                      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px", marginBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                          <div style={{ width: 3, height: 18, borderRadius: 2, background: "var(--info)" }} />
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--info)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Kickoff — Lancement</div>
                          <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-3)" }}>{kickoffGroups.flatMap(g => g.items).filter(i => obPhases[i.key]).length}/{kickoffGroups.flatMap(g => g.items).length}</div>
                        </div>
                        {kickoffGroups.map(group => (
                          <div key={group.label} style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: group.color, marginBottom: 6, paddingLeft: 14, textTransform: "uppercase", letterSpacing: "0.08em" }}>{group.label}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              {group.items.map(item => <CheckItem key={item.key} item={item} />)}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Email generators */}
                      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Générer les emails d'onboarding</div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={() => setWelcomeEmailModal('welcome')} style={{
                            flex: 1, padding: "12px 16px", background: "var(--success-soft)", border: "1px solid var(--success-soft)",
                            borderRadius: 8, color: "var(--success)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                          }}>
                            ✉ Welcome Aboard
                          </button>
                          <button onClick={() => setWelcomeEmailModal('followup')} style={{
                            flex: 1, padding: "12px 16px", background: "var(--info-soft)", border: "1px solid var(--info-soft)",
                            borderRadius: 8, color: "var(--info)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                          }}>
                            ✉ Welcome Follow-Up
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* FINANCES TAB (original detail) */}
                {projectTab === "detail" && <>

                {/* Notes section */}
                {selProject.notes && (
                  <div style={{ background: "var(--surface)", border: "1px solid var(--gold-soft)", borderRadius: 12, padding: "18px 20px", marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.08em" }}>📝 Notes</h3>
                      <button onClick={() => openEditProject(selProject)} style={{ background: "none", border: "none", color: "var(--text-3)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✎ Modifier</button>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{selProject.notes}</div>
                  </div>
                )}

                {/* Expenses section */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px", marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Dépenses ({(selProject.expenses || []).length})</h3>
                    <button onClick={() => setModal(`newExpense:${selProject.id}`)} style={{
                      padding: "8px 12px", background: "var(--gold)", color: "var(--gold-ink)", border: "none", borderRadius: 6,
                      fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    }}>+ Ajouter</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(selProject.expenses || []).map(e => (
                      <div key={e.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "var(--bg)", borderRadius: 8,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{e.label}</div>
                          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{e.category} · {e.date} · {EXPENSE_STATUS[e.status]?.label}</div>
                          {e.bdcNumber && <div style={{ fontSize: 11, color: "var(--gold)", marginTop: 2, fontFamily: "'Space Mono', monospace" }}>{e.bdcNumber}</div>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          {e.bdcNumber && <button onClick={() => setPdfPreview({ url: `/api/expenses/${e.id}/bdc`, title: `BDC — ${e.bdcNumber}` })} style={{
                            padding: "6px 10px", background: "var(--gold)", color: "var(--gold-ink)", border: "none", borderRadius: 4,
                            fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                          }}>BDC</button>}
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{(e.amount || 0).toFixed(2)}€ TTC</div>
                            <div style={{ fontSize: 11, color: "var(--text-3)" }}>{(e.amountHT || 0).toFixed(2)}€ HT</div>
                          </div>
                          <button onClick={() => deleteExpense(selProject.id, e.id)} style={{
                            padding: "6px", background: "transparent", border: "1px solid var(--border)", borderRadius: 4,
                            color: "var(--danger)", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                          }}>✕</button>
                        </div>
                      </div>
                    ))}
                    {(selProject.expenses || []).length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)", padding: "12px", textAlign: "center" }}>Aucune dépense</div>}
                  </div>
                </div>

                {/* IP Revenues */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Revenus IP ({(selProject.ipRevenues || []).length})</h3>
                    <button onClick={() => setModal(`newIpRevenue:${selProject.id}`)} style={{
                      padding: "8px 12px", background: "var(--success)", color: "var(--on-solid)", border: "none", borderRadius: 6,
                      fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    }}>+ Ajouter</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(selProject.ipRevenues || []).map(ir => (
                      <div key={ir.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "var(--bg)", borderRadius: 8,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--success)" }}>{ir.label}</div>
                          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{ir.source} · {ir.date || "—"}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--success)" }}>{(ir.amount || 0).toLocaleString()}€</div>
                          <button onClick={() => deleteIpRevenue(selProject.id, ir.id)} style={{
                            padding: "6px", background: "transparent", border: "1px solid var(--border)", borderRadius: 4,
                            color: "var(--danger)", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                          }}>✕</button>
                        </div>
                      </div>
                    ))}
                    {(selProject.ipRevenues || []).length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)", padding: "12px", textAlign: "center" }}>Aucun revenu IP</div>}
                  </div>
                </div>
                </>}
              </div>
            ) : (
              <div>
                {/* ── Barre titre + actions ── */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 12 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--text)" }}>Projets ({filteredProjects.filter(p => ["signed","active","delivered","paid"].includes(p.stage)).length})</h2>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {/* Sort */}
                    <select value={projSort} onChange={e => setProjSort(e.target.value)} style={{ padding: "7px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: projSort !== "date_desc" ? "var(--gold)" : "var(--text-3)", fontSize: 12, fontFamily: "inherit", cursor: "pointer", outline: "none" }}>
                      <option value="date_desc">↓ Date</option>
                      <option value="date_asc">↑ Date</option>
                      <option value="revenue_desc">↓ Revenu</option>
                      <option value="revenue_asc">↑ Revenu</option>
                      <option value="name_asc">A→Z Nom</option>
                      <option value="stage">Par statut</option>
                    </select>
                    {/* Vue toggle */}
                    <div style={{ display: "flex", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
                      <button onClick={() => setProjViewMode("list")} style={{ padding: "7px 10px", background: projViewMode === "list" ? "var(--gold-soft)" : "transparent", border: "none", borderRight: "1px solid var(--border)", color: projViewMode === "list" ? "var(--gold)" : "var(--text-3)", cursor: "pointer", fontSize: 14 }} title="Vue liste">☰</button>
                      <button onClick={() => setProjViewMode("grid")} style={{ padding: "7px 10px", background: projViewMode === "grid" ? "var(--gold-soft)" : "transparent", border: "none", borderRight: "1px solid var(--border)", color: projViewMode === "grid" ? "var(--gold)" : "var(--text-3)", cursor: "pointer", fontSize: 14 }} title="Vue mosaïque">⊞</button>
                      <button onClick={() => setProjViewMode("kanban")} style={{ padding: "7px 10px", background: projViewMode === "kanban" ? "var(--gold-soft)" : "transparent", border: "none", color: projViewMode === "kanban" ? "var(--gold)" : "var(--text-3)", cursor: "pointer", fontSize: 13, fontWeight: 700 }} title="Vue Kanban">▦</button>
                    </div>
                    {/* Export */}
                    <button onClick={() => {
                      const headers = ["Code", "Nom", "Pilier", "Client", "Stage", "Revenu HT (€)", "Dépenses TTC (€)", "Marge (%)", "Date Début", "Date Fin"];
                      const rows = filteredProjects.map(p => [
                        p.code, p.name, PILLAR_MAP[p.pillar]?.label || p.pillar, p.client || "—",
                        STAGE_MAP[p.stage]?.label || p.stage, p.revenue || 0,
                        (p.expenses || []).reduce((s, e) => s + (e.amount || 0), 0).toFixed(2),
                        p.revenue > 0 ? (((p.revenue - (p.expenses || []).reduce((s, e) => s + (e.amount || 0), 0)) / p.revenue * 100)).toFixed(0) : "—",
                        p.startDate || "—", p.endDate || "—",
                      ]);
                      exportToCSV("projects_export.csv", rows, headers);
                    }} style={{ padding: "7px 12px", background: "var(--gold-soft)", border: "1px solid var(--gold)", borderRadius: 6, color: "var(--gold)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📥</button>
                    <button onClick={() => setModal("newProject")} style={{ padding: "8px 14px", background: "var(--gold)", color: "var(--gold-ink)", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Nouveau projet</button>
                  </div>
                </div>

                {/* Projets signés uniquement — hors pipeline commercial */}
                {(() => {
                  const PROJECT_STAGES = ["signed","active","delivered","paid"];
                  const PROJECT_STATUS_MAP = {
                    signed:    { label: "Pas encore commencé", color: "var(--warning)" },
                    active:    { label: "En cours",            color: "var(--info)" },
                    delivered: { label: "Terminé",             color: "var(--success)" },
                    paid:      { label: "Terminé",             color: "var(--success)" },
                  };
                  const activeProjectsList = filteredProjects.filter(p => PROJECT_STAGES.includes(p.stage));
                  return (<>

                {/* ── Vue LISTE ── */}
                {projViewMode === "list" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {activeProjectsList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(p => {
                      const cogs = (p.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
                      const marge = p.revenue > 0 ? Math.round((p.revenue - cogs) / p.revenue * 100) : null;
                      return (
                        <div key={p.id} onClick={() => setSelProject(p)} style={{
                          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px", cursor: "pointer",
                          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
                        }}>
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: "var(--gold)", fontWeight: 700 }}>{p.code}</span>
                              <Badge label={PROJECT_STATUS_MAP[p.stage]?.label || STAGE_MAP[p.stage]?.label} color={PROJECT_STATUS_MAP[p.stage]?.color || STAGE_MAP[p.stage]?.color} />
                              <span style={{ fontSize: 10, color: "var(--text-3)", background: "var(--surface-2)", padding: "2px 6px", borderRadius: 4 }}>{PILLAR_MAP[p.pillar]?.label || p.pillar}</span>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{p.name}</div>
                            <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-3)", alignItems: "center", flexWrap: "wrap" }}>
                              {p.client && <span>{p.client}</span>}
                              {editingDates === p.id ? (
                                <span onClick={e => e.stopPropagation()} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                                  📅
                                  <input type="date" value={p.startDate || ""} onChange={e => saveInlineDate(p.id, "startDate", e.target.value)} style={{ background: "var(--surface-3)", border: "1px solid var(--border-2)", borderRadius: 4, color: "var(--text)", padding: "2px 6px", fontSize: 11, fontFamily: "inherit", width: 120 }} />
                                  <span style={{ color: "var(--text-3)" }}>→</span>
                                  <input type="date" value={p.endDate || ""} onChange={e => saveInlineDate(p.id, "endDate", e.target.value)} style={{ background: "var(--surface-3)", border: "1px solid var(--border-2)", borderRadius: 4, color: "var(--text)", padding: "2px 6px", fontSize: 11, fontFamily: "inherit", width: 120 }} />
                                  <button onClick={e => { e.stopPropagation(); setEditingDates(null); }} style={{ background: "none", border: "none", color: "var(--gold)", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "1px 4px" }}>✓</button>
                                </span>
                              ) : (
                                <span onClick={e => { e.stopPropagation(); setEditingDates(p.id); }} style={{ color: p.startDate || p.endDate ? "var(--text-3)" : "var(--text-3)", cursor: "pointer", borderBottom: "1px dashed var(--border-2)", padding: "2px 6px", borderRadius: 4, background: "var(--surface)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  📅 {p.startDate || p.endDate ? (<>{p.startDate ? new Date(p.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'} → {p.endDate ? new Date(p.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}</>) : "Dates"}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", minWidth: 110 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{(p.revenue || 0).toLocaleString('fr-FR')}€ <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 400 }}>HT</span></div>
                            {p.revenue > 0 && (p.tvaRate || '20') !== '0' && <div style={{ fontSize: 10, color: "var(--text-3)" }}>{computeTTC(p.revenue, p.tvaRate || '20').toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€ TTC</div>}
                            {marge !== null && <div style={{ fontSize: 11, color: marge >= 50 ? "var(--success)" : marge >= 30 ? "var(--gold)" : "var(--danger)", fontWeight: 600 }}>{marge}% marge</div>}
                          </div>
                        </div>
                      );
                    })}
                    {activeProjectsList.length === 0 && <div style={{ textAlign: "center", padding: "40px", color: "var(--text-3)", fontSize: 14 }}>Aucun projet ne correspond à votre recherche</div>}
                    <Pagination total={activeProjectsList.length} page={currentPage} perPage={ITEMS_PER_PAGE} onChange={setCurrentPage} />
                  </div>
                )}

                {/* ── Vue GRILLE ── */}
                {projViewMode === "grid" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                    {activeProjectsList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(p => {
                      const cogs = (p.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
                      const marge = p.revenue > 0 ? Math.round((p.revenue - cogs) / p.revenue * 100) : null;
                      return (
                        <div key={p.id} onClick={() => setSelProject(p)} style={{
                          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px", cursor: "pointer",
                          display: "flex", flexDirection: "column", gap: 10,
                          transition: "border-color 0.15s",
                        }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = "var(--gold-hover)"}
                          onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: "var(--gold)", fontWeight: 700 }}>{p.code}</div>
                            <Badge label={PROJECT_STATUS_MAP[p.stage]?.label || STAGE_MAP[p.stage]?.label} color={PROJECT_STATUS_MAP[p.stage]?.color || STAGE_MAP[p.stage]?.color} />
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{p.name}</div>
                            {p.client && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{p.client}</div>}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto" }}>
                            <div>
                              <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 2 }}>{PILLAR_MAP[p.pillar]?.label || p.pillar}</div>
                              {(p.startDate || p.endDate) && <div style={{ fontSize: 10, color: "var(--text-3)" }}>{p.startDate ? new Date(p.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'} → {p.endDate ? new Date(p.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}</div>}
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{(p.revenue || 0).toLocaleString('fr-FR')}€</div>
                              {marge !== null && <div style={{ fontSize: 10, color: marge >= 50 ? "var(--success)" : marge >= 30 ? "var(--gold)" : "var(--danger)", fontWeight: 600 }}>{marge}%</div>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {activeProjectsList.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px", color: "var(--text-3)", fontSize: 14 }}>Aucun projet ne correspond à votre recherche</div>}
                  </div>
                )}
                {projViewMode === "grid" && <Pagination total={activeProjectsList.length} page={currentPage} perPage={ITEMS_PER_PAGE} onChange={setCurrentPage} />}

                {/* ── Vue KANBAN (par statut projet) ── */}
                {projViewMode === "kanban" && (
                  <div style={{ overflowX: "auto", paddingBottom: 16 }}>
                    <div style={{ display: "flex", gap: 14, minWidth: "max-content", alignItems: "flex-start" }}>
                      {[
                        { key: "signed",    label: "Pas encore commencé", color: "var(--warning)", icon: "⏳" },
                        { key: "active",    label: "En cours",            color: "var(--info)", icon: "🔵" },
                        { key: "delivered", label: "Terminé",             color: "var(--success)", icon: "✅" },
                        { key: "paid",      label: "Terminé & Payé",     color: "var(--success)", icon: "💰" },
                      ].map(col => {
                        const colProjects = activeProjectsList.filter(p => p.stage === col.key);
                        const colRevenue = colProjects.reduce((s, p) => s + (p.revenue || 0), 0);
                        return (
                          <div key={col.key} style={{ width: 280, flexShrink: 0 }}>
                            {/* Entête colonne */}
                            <div style={{ background: "var(--surface)", borderTop: `1px solid ${alpha(col.color, 20)}`, borderLeft: `1px solid ${alpha(col.color, 20)}`, borderRight: `1px solid ${alpha(col.color, 20)}`, borderBottom: `2px solid ${col.color}`, borderRadius: "10px 10px 0 0", padding: "12px 14px", marginBottom: 0 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: col.color }}>{col.icon} {col.label}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, background: alpha(col.color, 13), color: col.color, padding: "2px 8px", borderRadius: 10 }}>{colProjects.length}</span>
                              </div>
                              {colRevenue > 0 && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{colRevenue.toLocaleString('fr-FR')}€ HT</div>}
                            </div>
                            {/* Cartes */}
                            <div style={{ background: "var(--bg)", borderLeft: `1px solid ${alpha(col.color, 13)}`, borderRight: `1px solid ${alpha(col.color, 13)}`, borderBottom: `1px solid ${alpha(col.color, 13)}`, borderTop: "none", borderRadius: "0 0 10px 10px", padding: 8, display: "flex", flexDirection: "column", gap: 8, minHeight: 100 }}>
                              {colProjects.map(p => {
                                const cogs = (p.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
                                const marge = p.revenue > 0 ? Math.round((p.revenue - cogs) / p.revenue * 100) : null;
                                return (
                                  <div key={p.id} onClick={() => setSelProject(p)} style={{
                                    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px",
                                    cursor: "pointer", transition: "border-color 0.15s",
                                  }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = alpha(col.color, 53)}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                                  >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                                      <span style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: "var(--gold)", fontWeight: 700 }}>{p.code}</span>
                                      <span style={{ fontSize: 9, color: "var(--text-3)", background: "var(--surface-3)", padding: "2px 6px", borderRadius: 4 }}>{PILLAR_MAP[p.pillar]?.label || p.pillar}</span>
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4, lineHeight: 1.3 }}>{p.name}</div>
                                    {p.client && <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.client}</div>}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{p.revenue ? `${(p.revenue/1000).toFixed(1)}k€` : "—"}</span>
                                      {marge !== null && <span style={{ fontSize: 10, fontWeight: 600, color: marge >= 50 ? "var(--success)" : marge >= 30 ? "var(--gold)" : "var(--danger)" }}>{marge}% marge</span>}
                                    </div>
                                    {(p.startDate || p.endDate) && <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>📅 {p.startDate ? new Date(p.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'} → {p.endDate ? new Date(p.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'}</div>}
                                  </div>
                                );
                              })}
                              {colProjects.length === 0 && <div style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center", padding: "20px 0", fontStyle: "italic" }}>Aucun projet</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                  </>);
                })()}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ CLIENTS VIEW ══════════════════ */}
        {view === "clients" && (() => {
          const allClients = data.clients || [];
          const clients = allClients.filter(c => !c.pillar || c.pillar === 'AGENCE' || c.pillar === 'BOTH');
          const WON_STAGES = ["signed","active","delivered","paid"];
          const ACTIVE_STAGES = ["active","signed"];

          // Helper: does a project "belong" to a client?
          // Le CLIENT = la société (c.company ↔ p.client). Le contact = la personne.
          const matchesClient = (p, c) => {
            if (p.clientId === c.id) return true; // lien formel
            // Match principal : société ↔ champ client du projet
            if (c.company && p.client) {
              const co = c.company.toLowerCase().trim();
              const pc = p.client.toLowerCase().trim();
              if (co === pc) return true;
              if (co.includes(pc) || pc.includes(co)) return true;
            }
            return false;
          };

          // Enrich each client with project stats — signed contracts only
          const enrichedAll = clients.map(c => {
            const projs = data.projects.filter(p => WON_STAGES.includes(p.stage) && matchesClient(p, c));
            const wonProjs = projs.filter(p => WON_STAGES.includes(p.stage));
            const totalRevenue = projs.reduce((s, p) => s + (p.revenue || 0), 0);
            const totalExpenses = projs.reduce((s, p) => s + (p.expenses || []).reduce((x, e) => x + (e.amount || 0), 0), 0);
            const pillars = [...new Set(projs.map(p => p.pillar).filter(Boolean))];
            const lastProject = [...projs].sort((a,b) => (b.startDate||"") > (a.startDate||"") ? 1 : -1)[0];
            return { ...c, projects: projs, wonProjs, totalRevenue, totalExpenses, pillars, lastProject };
          });

          // Apply client search + pillar filter + sort
          const enriched = (() => {
            let list = enrichedAll;
            if (clientSearch) {
              const q = clientSearch.toLowerCase();
              list = list.filter(c =>
                (c.company || "").toLowerCase().includes(q) ||
                (c.firstName || "").toLowerCase().includes(q) ||
                (c.lastName || "").toLowerCase().includes(q) ||
                (c.email || "").toLowerCase().includes(q) ||
                (c.city || "").toLowerCase().includes(q)
              );
            }
            if (clientPillarFilter !== "All") {
              list = list.filter(c => c.pillars.includes(clientPillarFilter));
            }
            switch (clientSort) {
              case "alpha":   list = [...list].sort((a, b) => (a.company || a.lastName || '').localeCompare(b.company || b.lastName || '')); break;
              case "recent":  list = [...list].sort((a, b) => (b.lastProject?.startDate || b.createdAt || '') < (a.lastProject?.startDate || a.createdAt || '') ? -1 : 1); break;
              case "revenue_desc":
              default:        list = [...list].sort((a, b) => b.totalRevenue - a.totalRevenue); break;
            }
            return list;
          })();

          const selClientEnriched = selClient
            ? (enriched.find(c => c.id === selClient.id) || { ...selClient, projects: [], wonProjs: [], totalRevenue: 0, totalExpenses: 0, pillars: [] })
            : null;

          return (
            <div>
              {/* ── HEADER BAR ── */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                    Clients <span style={{ fontSize: 14, color: "var(--text-3)", fontWeight: 400 }}>({enriched.length} répertoire)</span>
                  </h2>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>Répertoire clients — SIRET, contacts, historique projets</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {selClientEnriched && (
                    <button onClick={() => { setSelClient(null); setEditingClient(null); }} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                      ← Tous les clients
                    </button>
                  )}
                  <button onClick={() => { setClientForm({ pillar: 'AGENCE', tvaApplicable: true, tvaRate: 20 }); setEditingClient('new'); setSelClient(null); }} style={{ padding: "8px 16px", background: "var(--gold)", border: "none", borderRadius: 8, color: "var(--gold-ink)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    + Nouveau client
                  </button>
                </div>
              </div>

              {/* ── FORM (new or edit) ── */}
              {editingClient && (
                <div style={{ background: "var(--surface)", border: "1px solid var(--gold-hover)", borderRadius: 12, padding: 24, marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 20 }}>
                    {editingClient === 'new' ? '+ Nouveau client' : '✏ Modifier le client'}
                  </div>
                  {/* Identité */}
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Structure / Société</div>
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 2 }}><Field label="Nom de la structure *" value={clientForm.company || ''} onChange={v => upcf("company", v)} placeholder="Festival des Griots, ACME Corp…" /></div>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Contact principal (optionnel — vous pourrez en ajouter d'autres après)</div>
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}><Field label="Prénom" value={clientForm.firstName || ''} onChange={v => upcf("firstName", v)} placeholder="Jean" /></div>
                    <div style={{ flex: 1 }}><Field label="NOM" value={clientForm.lastName || ''} onChange={v => upcf("lastName", v)} placeholder="DUPONT" /></div>
                    <div style={{ flex: 1 }}><Field label="Rôle" value={clientForm.contactRole || ''} onChange={v => upcf("contactRole", v)} placeholder="Directeur, Chargé de prod…" /></div>
                  </div>
                  {/* Contact */}
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Contact</div>
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}><Field label="Email" value={clientForm.email || ''} onChange={v => upcf("email", v)} type="email" placeholder="jean@example.com" /></div>
                    <div style={{ flex: 1 }}><Field label="Téléphone" value={clientForm.phone || ''} onChange={v => upcf("phone", v)} placeholder="+33 6 XX XX XX XX" /></div>
                  </div>
                  {/* Adresse */}
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Adresse</div>
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 3 }}><Field label="Adresse" value={clientForm.address || ''} onChange={v => upcf("address", v)} placeholder="12 rue des Arts" /></div>
                    <div style={{ flex: 1 }}><Field label="Code postal" value={clientForm.postalCode || ''} onChange={v => upcf("postalCode", v)} placeholder="75001" /></div>
                    <div style={{ flex: 2 }}><Field label="Ville" value={clientForm.city || ''} onChange={v => upcf("city", v)} placeholder="Paris" /></div>
                  </div>
                  {/* Facturation */}
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Facturation</div>
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}><Field label="SIRET" value={clientForm.siret || ''} onChange={v => upcf("siret", v)} placeholder="XXX XXX XXX XXXXX" /></div>
                    <div style={{ flex: 1 }}><Field label="N° TVA intracommunautaire" value={clientForm.tvaNumber || ''} onChange={v => upcf("tvaNumber", v)} placeholder="FR XX XXX XXX XXX" /></div>
                  </div>
                  <Field label="Notes" value={clientForm.notes || ''} onChange={v => upcf("notes", v)} type="textarea" placeholder="Informations complémentaires…" />
                  {/* Actions */}
                  <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                    <button onClick={saveClient} disabled={(!clientForm.lastName && !clientForm.company) || saving} style={{
                      flex: 1, padding: "12px", background: ((clientForm.lastName || clientForm.company) && !saving) ? "var(--gold)" : "var(--surface-3)",
                      color: ((clientForm.lastName || clientForm.company) && !saving) ? "var(--gold-ink)" : "var(--text-3)", border: "none", borderRadius: 8,
                      fontWeight: 700, fontSize: 14, cursor: ((clientForm.lastName || clientForm.company) && !saving) ? "pointer" : "not-allowed", fontFamily: "inherit",
                    }}>{saving ? 'Enregistrement…' : (editingClient === 'new' ? 'Créer le client' : 'Sauvegarder')}</button>
                    <button onClick={async () => {
                      if (formDirty && !(await confirm({ title: 'Modifications non enregistrées', message: 'Fermer quand même ? Les changements seront perdus.', confirmLabel: 'Fermer sans enregistrer' }))) return;
                      setEditingClient(null); setClientForm({}); setFormDirty(false);
                    }} style={{
                      padding: "12px 20px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8,
                      color: "var(--text-3)", fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                    }}>Annuler</button>
                  </div>
                </div>
              )}

              {!selClientEnriched ? (
                /* ── LISTE + GRID MODE ── */
                <div>
                  {/* ── Barre de filtres / tri / vue ── */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      type="text" placeholder="Rechercher client, ville…"
                      value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                      style={{ flex: 1, minWidth: 180, padding: "8px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                    />
                    <select value={clientPillarFilter} onChange={e => setClientPillarFilter(e.target.value)} style={{ padding: "7px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: clientPillarFilter !== "All" ? "var(--gold)" : "var(--text-3)", fontSize: 12, fontFamily: "inherit", cursor: "pointer", outline: "none" }}>
                      <option value="All">Tous les piliers</option>
                      <option value="STUDIO">Studio</option>
                      <option value="PROD">Production</option>
                      <option value="GRIOTHEQUE">Griothèque</option>
                    </select>
                    <select value={clientSort} onChange={e => setClientSort(e.target.value)} style={{ padding: "7px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: clientSort !== "revenue_desc" ? "var(--gold)" : "var(--text-3)", fontSize: 12, fontFamily: "inherit", cursor: "pointer", outline: "none" }}>
                      <option value="revenue_desc">↓ CA</option>
                      <option value="alpha">A→Z</option>
                      <option value="recent">Récent</option>
                    </select>
                    <div style={{ display: "flex", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
                      <button onClick={() => setClientViewMode("grid")} style={{ padding: "7px 10px", background: clientViewMode === "grid" ? "var(--gold-soft)" : "transparent", border: "none", borderRight: "1px solid var(--border)", color: clientViewMode === "grid" ? "var(--gold)" : "var(--text-3)", cursor: "pointer", fontSize: 14 }} title="Vue grille">⊞</button>
                      <button onClick={() => setClientViewMode("list")} style={{ padding: "7px 10px", background: clientViewMode === "list" ? "var(--gold-soft)" : "transparent", border: "none", color: clientViewMode === "list" ? "var(--gold)" : "var(--text-3)", cursor: "pointer", fontSize: 14 }} title="Vue liste">☰</button>
                    </div>
                    {(clientSearch || clientPillarFilter !== "All") && (
                      <button onClick={() => { setClientSearch(""); setClientPillarFilter("All"); }} style={{ padding: "7px 10px", background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: 6, color: "var(--danger)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✕ Reset</button>
                    )}
                  </div>

                  {/* ── Clients du répertoire ── */}
                  {enrichedAll.length > 0 && (
                    <div style={{ marginBottom: 32 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
                        Répertoire ({enriched.length}{enriched.length !== enrichedAll.length ? ` / ${enrichedAll.length}` : ''})
                      </div>

                  {/* Vue LISTE clients */}
                  {clientViewMode === "list" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                      {enriched.map(c => {
                        const margin = c.totalRevenue > 0 ? Math.round((c.totalRevenue - c.totalExpenses) / c.totalRevenue * 100) : null;
                        return (
                          <div key={c.id} onClick={() => setSelClient(c)} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--gold-hover)"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 160 }}>
                              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--gold-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--gold)", flexShrink: 0 }}>
                                {(c.company || c.lastName || '?')[0].toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{c.company || fmtFullName(c.firstName, c.lastName) || '—'}</div>
                                {(c.firstName || c.lastName) && <div style={{ fontSize: 10, color: "var(--text-3)" }}>{fmtP(c.firstName)} {fmtN(c.lastName)}</div>}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                              {c.pillars.map(pl => <span key={pl} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "var(--gold-soft)", color: "var(--gold)", border: "1px solid var(--gold-soft)" }}>{PILLAR_MAP[pl]?.label || pl}</span>)}
                              <span style={{ fontSize: 12, color: "var(--text-3)" }}>{c.projects.length} projet{c.projects.length > 1 ? 's' : ''}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", minWidth: 60, textAlign: "right" }}>{c.totalRevenue > 0 ? `${c.totalRevenue.toLocaleString('fr-FR')}€` : '—'}</span>
                              {margin !== null && <span style={{ fontSize: 11, color: margin >= 40 ? "var(--success)" : margin >= 20 ? "var(--gold)" : "var(--danger)", fontWeight: 600 }}>{margin}%</span>}
                              {c.email && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{c.email}</span>}
                            </div>
                          </div>
                        );
                      })}
                      {enriched.length === 0 && <div style={{ textAlign: "center", padding: "20px", color: "var(--text-3)", fontSize: 13 }}>Aucun résultat</div>}
                    </div>
                  )}

                  {/* Vue GRILLE clients */}
                  {clientViewMode === "grid" && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                  {enriched.map(c => {
                    const margin = c.totalRevenue > 0 ? Math.round((c.totalRevenue - c.totalExpenses) / c.totalRevenue * 100) : null;
                    const activeProj = c.projects.filter(p => ACTIVE_STAGES.includes(p.stage));
                    return (
                      <div key={c.id} onClick={() => setSelClient(c)} style={{
                        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
                        padding: "20px", cursor: "pointer", transition: "all 0.15s",
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--gold-hover)"; e.currentTarget.style.background = "var(--surface)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}>
                        {/* Avatar + société */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--gold-soft)", border: "1px solid var(--gold-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "var(--gold)", flexShrink: 0 }}>
                              {(c.company?.[0] || c.lastName?.[0] || '?').toUpperCase()}
                            </div>
                            <div>
                              {/* Société = primary */}
                              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>
                                {c.company || fmtFullName(c.firstName, c.lastName) || '—'}
                              </div>
                              {/* Contact = secondary */}
                              {(c.firstName || c.lastName) && (
                                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                                  Contact : {fmtP(c.firstName)} {fmtN(c.lastName)}
                                </div>
                              )}
                              {c.siret && <div style={{ fontSize: 10, color: "var(--text-3)", fontFamily: "'Space Mono', monospace", marginTop: 2 }}>SIRET {c.siret}</div>}
                            </div>
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--gold)" }}>{c.projects.length}</div>
                            <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>projets</div>
                          </div>
                        </div>
                        {/* Piliers */}
                        {c.pillars.length > 0 && (
                          <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
                            {c.pillars.map(pk => (
                              <span key={pk} style={{ fontSize: 10, fontWeight: 600, color: PILLAR_MAP[pk]?.color, background: `${alpha(PILLAR_MAP[pk]?.color, 9)}`, padding: "2px 8px", borderRadius: 10, border: `1px solid ${alpha(PILLAR_MAP[pk]?.color, 20)}` }}>
                                {PILLAR_MAP[pk]?.prefix || pk}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Stats */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                          <div style={{ background: "var(--surface-2)", borderRadius: 6, padding: "8px 10px" }}>
                            <div style={{ fontSize: 9, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 2 }}>CA HT</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                              {c.totalRevenue > 0 ? `${c.totalRevenue.toLocaleString('fr-FR')}€` : "0€"}
                            </div>
                          </div>
                          <div style={{ background: "var(--surface-2)", borderRadius: 6, padding: "8px 10px" }}>
                            <div style={{ fontSize: 9, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 2 }}>Marge</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: margin !== null ? (margin >= 40 ? "var(--success)" : margin >= 20 ? "var(--gold)" : "var(--danger)") : "var(--text-3)" }}>
                              {margin !== null ? `${margin}%` : "—"}
                            </div>
                          </div>
                          <div style={{ background: "var(--surface-2)", borderRadius: 6, padding: "8px 10px" }}>
                            <div style={{ fontSize: 9, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 2 }}>En cours</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: activeProj.length > 0 ? "var(--info)" : "var(--text-3)" }}>{activeProj.length}</div>
                          </div>
                        </div>
                        {/* Contact rapide */}
                        {(c.email || c.phone) && (
                          <div style={{ fontSize: 11, color: "var(--text-3)", borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
                            {c.email && <span style={{ display: "flex", alignItems: "center" }} title={c.email}>✉ {c.email}<CopyBtn text={c.email} /></span>}
                            {c.phone && <span style={{ display: "flex", alignItems: "center" }}>📞 {c.phone}<CopyBtn text={c.phone} /></span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                      </div>
                    )}
                    </div>
                  )}

                  {/* ── Clients hérités des projets (non liés au répertoire) ── */}
                  {(() => {
                    // Aggregate projects that have a client name but no client_id
                    // Only signed contracts = vrais clients (comme Chris Do)
                    const CLIENT_STAGES_UNL = ["signed","active","delivered","paid"];
                    const unlinkedMap = {};
                    data.projects.filter(p => CLIENT_STAGES_UNL.includes(p.stage)).forEach(p => {
                      if (p.clientId) return; // already linked by id → skip
                      // Also skip if the project's client text matches any répertoire client (avoid duplicates)
                      if ((data.clients || []).some(c => matchesClient(p, c))) return;
                      // Le client = la société. On groupe par p.client (nom de la structure)
                      const key = p.client || '';
                      if (!key) return;
                      if (!unlinkedMap[key]) unlinkedMap[key] = {
                        key, projects: [],
                        totalRevenue: 0, totalExpenses: 0,
                        company: p.client || '',
                        email: p.clientEmail || '',
                        phone: p.clientPhone || '',
                        address: p.clientAddress || '',
                        // premier contact trouvé
                        firstName: p.clientFirstName || '',
                        lastName: p.clientLastName || '',
                      };
                      unlinkedMap[key].projects.push(p);
                      unlinkedMap[key].totalRevenue += p.revenue || 0;
                      unlinkedMap[key].totalExpenses += (p.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
                    });
                    const unlinked = Object.values(unlinkedMap).sort((a, b) => b.totalRevenue - a.totalRevenue);
                    if (unlinked.length === 0) return null;
                    return (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                          Clients non liés ({unlinked.length}) <span style={{ fontWeight: 400, color: "var(--text-3)", textTransform: "none", letterSpacing: 0 }}>— issus de vos projets existants</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
                          Ces clients viennent du champ "client" de vos projets. Créez une fiche pour les intégrer au répertoire.
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                          {unlinked.map(u => {
                            const margin = u.totalRevenue > 0 ? Math.round((u.totalRevenue - u.totalExpenses) / u.totalRevenue * 100) : null;
                            const initial = (u.firstName?.[0] || u.company?.[0] || '?').toUpperCase();
                            return (
                              <div key={u.key} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--text-3)", flexShrink: 0 }}>
                                    {initial}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    {/* Société = primary */}
                                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-2)", lineHeight: 1.2 }}>{u.company || '—'}</div>
                                    {/* Contact = secondary si dispo */}
                                    {(u.firstName || u.lastName) && <div style={{ fontSize: 11, color: "var(--text-3)" }}>Contact : {fmtP(u.firstName)} {fmtN(u.lastName)}</div>}
                                    <div style={{ fontSize: 10, color: "var(--text-3)" }}>{u.projects.length} projet{u.projects.length > 1 ? 's' : ''} · {u.totalRevenue.toLocaleString()}€{margin !== null ? ` · ${margin}%` : ''}</div>
                                  </div>
                                </div>
                                <button onClick={() => {
                                  setClientForm({
                                    firstName: u.firstName, lastName: u.lastName,
                                    company: u.company, email: u.email, phone: u.phone, address: u.address,
                                  });
                                  setEditingClient('new');
                                  setSelClient(null);
                                }} style={{ width: "100%", padding: "7px", background: "var(--gold-soft)", border: "1px solid var(--gold-soft)", borderRadius: 6, color: "var(--gold)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                  → Créer une fiche client
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {enriched.length === 0 && Object.values({}).length === 0 && !editingClient && (
                    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-3)" }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
                      <div style={{ fontSize: 15, marginBottom: 8 }}>Aucun client encore</div>
                      <div style={{ fontSize: 12 }}>Cliquez sur "+ Nouveau client" pour en créer un.</div>
                    </div>
                  )}
                </div>
              ) : (
                /* ── CLIENT DETAIL ── */
                <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, alignItems: "start" }}>
                  {/* Fiche client */}
                  <div>
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, marginBottom: 16 }}>
                      {/* Avatar + identité */}
                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--gold-soft)", border: "2px solid var(--gold)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "var(--gold)", flexShrink: 0 }}>
                          {(selClientEnriched.company?.[0] || selClientEnriched.lastName?.[0] || '?').toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Société = primary */}
                          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", lineHeight: 1.3, display: "flex", alignItems: "center" }}>
                            {selClientEnriched.company || fmtFullName(selClientEnriched.firstName, selClientEnriched.lastName) || '—'}
                            <CopyBtn text={selClientEnriched.company || fmtFullName(selClientEnriched.firstName, selClientEnriched.lastName)} />
                          </div>
                          {/* Contact principal = secondary */}
                          {(selClientEnriched.firstName || selClientEnriched.lastName) && (
                            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3, display: "flex", alignItems: "center" }}>
                              {fmtP(selClientEnriched.firstName)} {fmtN(selClientEnriched.lastName)}
                              <CopyBtn text={`${fmtP(selClientEnriched.firstName)} ${fmtN(selClientEnriched.lastName)}`.trim()} />
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Coordonnées structure */}
                      {[
                        { icon: "✉", label: "Email", val: selClientEnriched.email },
                        { icon: "📞", label: "Tél", val: selClientEnriched.phone },
                        { icon: "📍", label: "Adresse", val: [selClientEnriched.address, selClientEnriched.postalCode, selClientEnriched.city].filter(Boolean).join(', ') },
                      ].filter(r => r.val).map(r => (
                        <div key={r.label} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10, fontSize: 12 }}>
                          <span style={{ fontSize: 14, flexShrink: 0 }}>{r.icon}</span>
                          <div>
                            <div style={{ fontSize: 9, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 1 }}>{r.label}</div>
                            <div style={{ color: "var(--text-2)", display: "flex", alignItems: "center" }}>{r.val}<CopyBtn text={r.val} /></div>
                          </div>
                        </div>
                      ))}
                      {/* ── Contacts ── */}
                      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Contacts ({(selClientEnriched.contacts||[]).length})</div>
                          <button onClick={() => { setContactForm({}); setEditingContact(`new:${selClientEnriched.id}`); }} style={{ fontSize: 11, background: "none", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-3)", padding: "2px 8px", cursor: "pointer", fontFamily: "inherit" }}>+ Ajouter</button>
                        </div>
                        {/* Formulaire ajout/édition contact */}
                        {editingContact && (editingContact === `new:${selClientEnriched.id}` || (selClientEnriched.contacts||[]).some(c => c.id === editingContact)) && (
                          <div style={{ background: "var(--surface)", border: "1px solid var(--gold-soft)", borderRadius: 8, padding: 12, marginBottom: 10 }}>
                            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                              <div style={{ flex: 1 }}><Field label="Prénom" value={contactForm.firstName||''} onChange={v => upcct("firstName",v)} placeholder="Prénom" /></div>
                              <div style={{ flex: 1 }}><Field label="NOM" value={contactForm.lastName||''} onChange={v => upcct("lastName",v)} placeholder="NOM" /></div>
                            </div>
                            <Field label="Rôle / Fonction" value={contactForm.role||''} onChange={v => upcct("role",v)} placeholder="Directeur artistique, Chef de projet…" />
                            <div style={{ display: "flex", gap: 8 }}>
                              <div style={{ flex: 1 }}><Field label="Email" value={contactForm.email||''} onChange={v => upcct("email",v)} type="email" /></div>
                              <div style={{ flex: 1 }}><Field label="Téléphone" value={contactForm.phone||''} onChange={v => upcct("phone",v)} /></div>
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button onClick={() => saveContact(selClientEnriched.id)} disabled={(!contactForm.lastName && !contactForm.firstName) || saving} style={{ flex: 1, padding: "7px", background: ((contactForm.lastName||contactForm.firstName) && !saving) ? "var(--gold)" : "var(--surface-3)", color: ((contactForm.lastName||contactForm.firstName) && !saving) ? "var(--gold-ink)" : "var(--text-3)", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{saving ? 'Enregistrement…' : 'Sauvegarder'}</button>
                              <button onClick={() => { setEditingContact(null); setContactForm({}); }} style={{ padding: "7px 12px", background: "none", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-3)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                            </div>
                          </div>
                        )}
                        {/* Liste des contacts */}
                        {(selClientEnriched.contacts||[]).length === 0 && !editingContact && (
                          <div style={{ fontSize: 11, color: "var(--text-3)" }}>Aucun contact — cliquez "+ Ajouter"</div>
                        )}
                        {(selClientEnriched.contacts||[]).map(ct => (
                          <div key={ct.id} style={{ background: "var(--surface)", borderRadius: 8, padding: "10px 12px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)" }}>
                                {fmtP(ct.firstName)} {fmtN(ct.lastName)}
                              </div>
                              {ct.role && <div style={{ fontSize: 10, color: "var(--gold)", marginTop: 1 }}>{ct.role}</div>}
                              {ct.email && <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>✉ {ct.email}</div>}
                              {ct.phone && <div style={{ fontSize: 10, color: "var(--text-3)" }}>📞 {ct.phone}</div>}
                            </div>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button onClick={() => { setContactForm({...ct}); setEditingContact(ct.id); }} style={{ padding: "3px 7px", background: "none", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text-3)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>✏</button>
                              <button onClick={() => deleteContact(selClientEnriched.id, ct.id)} style={{ padding: "3px 7px", background: "none", border: "1px solid var(--danger-soft)", borderRadius: 4, color: "var(--danger)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Facturation */}
                      {(selClientEnriched.siret || selClientEnriched.tvaNumber) && (
                        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 14 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Facturation</div>
                          {selClientEnriched.siret && (
                            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6, display: "flex", alignItems: "center" }}>
                              <span style={{ color: "var(--text-3)" }}>SIRET </span>
                              <span style={{ fontFamily: "'Space Mono', monospace", color: "var(--text-2)", marginLeft: 4 }}>{selClientEnriched.siret}</span>
                              <CopyBtn text={selClientEnriched.siret} />
                            </div>
                          )}
                          {selClientEnriched.tvaNumber && (
                            <div style={{ fontSize: 11, color: "var(--text-3)", display: "flex", alignItems: "center" }}>
                              <span style={{ color: "var(--text-3)" }}>TVA </span>
                              <span style={{ fontFamily: "'Space Mono', monospace", color: "var(--text-2)", marginLeft: 4 }}>{selClientEnriched.tvaNumber}</span>
                              <CopyBtn text={selClientEnriched.tvaNumber} />
                            </div>
                          )}
                        </div>
                      )}
                      {selClientEnriched.notes && (
                        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 14 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, display: "flex", alignItems: "center" }}>
                            Notes<CopyBtn text={selClientEnriched.notes} />
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.6 }}>{selClientEnriched.notes}</div>
                        </div>
                      )}
                      {/* Actions */}
                      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                        <button onClick={() => { setClientForm({ ...selClientEnriched }); setEditingClient(selClientEnriched.id); }} style={{ flex: 1, padding: "8px", background: "var(--gold-soft)", border: "1px solid var(--gold-hover)", borderRadius: 6, color: "var(--gold)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                          ✏ Modifier
                        </button>
                        <button onClick={() => deleteClient(selClientEnriched.id)} style={{ padding: "8px 12px", background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: 6, color: "var(--danger)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                          ✕
                        </button>
                      </div>
                    </div>
                    {/* Stats card */}
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Statistiques</div>
                      {[
                        { l: "Projets", v: selClientEnriched.projects.length, c: "var(--gold)" },
                        { l: "CA total", v: `${selClientEnriched.totalRevenue.toLocaleString()}€`, c: "var(--text)" },
                        { l: "Dépenses", v: `${selClientEnriched.totalExpenses.toLocaleString()}€`, c: "var(--danger)" },
                        { l: "Profit brut", v: `${(selClientEnriched.totalRevenue - selClientEnriched.totalExpenses).toLocaleString()}€`, c: selClientEnriched.totalRevenue >= selClientEnriched.totalExpenses ? "var(--success)" : "var(--danger)" },
                        { l: "Projets actifs", v: selClientEnriched.projects.filter(p => ACTIVE_STAGES.includes(p.stage)).length, c: "var(--info)" },
                      ].map(s => (
                        <div key={s.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{s.l}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: s.c }}>{s.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Projets du client */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Projets ({selClientEnriched.projects.length})</div>
                    </div>
                    {selClientEnriched.projects.length === 0 ? (
                      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "32px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                        Aucun projet lié à ce client pour l'instant.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {selClientEnriched.projects.sort((a,b) => (b.startDate||"") > (a.startDate||"") ? 1 : -1).map(p => {
                          const pillar = PILLAR_MAP[p.pillar];
                          const stage = STAGE_MAP[p.stage];
                          const expenses = (p.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
                          const margin = p.revenue > 0 ? Math.round((p.revenue - expenses) / p.revenue * 100) : null;
                          return (
                            <div key={p.id} onClick={() => { setSelClient(null); setView("projects"); setSelProject(p); }}
                              style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, transition: "all 0.12s" }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: pillar?.color || "var(--text-3)" }}>{p.code}</span>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{p.name}</span>
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                                  {p.startDate ? new Date(p.startDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : "—"}
                                  {p.endDate ? ` → ${new Date(p.endDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}` : ""}
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                <Badge label={stage?.label || p.stage} color={stage?.color || "var(--text-3)"} />
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{(p.revenue || 0).toLocaleString()}€</div>
                                  {margin !== null && <div style={{ fontSize: 10, color: margin >= 40 ? "var(--success)" : margin >= 20 ? "var(--gold)" : "var(--danger)" }}>marge {margin}%</div>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {view === "expenses" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--text)" }}>Dépenses ({filteredExpenses.length})</h2>
              <button onClick={() => {
                const headers = ["Date", "Code Projet", "Nom Projet", "Désignation", "Prestataire", "Catégorie", "Montant HT (€)", "Taux TVA (%)", "Montant TVA (€)", "Montant TTC (€)", "Statut", "Numéro BDC"];
                const rows = filteredExpenses.map(e => [
                  e.date || "—",
                  e.projectCode,
                  e.projectName,
                  e.label,
                  e.provider || "—",
                  e.category,
                  (e.amountHT || 0).toFixed(2),
                  (TVA_MAP[e.tvaRate]?.rate * 100 || 0).toFixed(1),
                  ((e.amountHT || 0) * (TVA_MAP[e.tvaRate]?.rate || 0)).toFixed(2),
                  (e.amount || 0).toFixed(2),
                  EXPENSE_STATUS[e.status]?.label || e.status,
                  e.bdcNumber || "—",
                ]);
                exportToCSV("expenses_export.csv", rows, headers);
              }} style={{
                padding: "8px 14px", background: "var(--gold-soft)", border: "1px solid var(--gold)", borderRadius: 6,
                color: "var(--gold)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>📥 Exporter</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filteredExpenses.map(e => (
                <div key={e.id} style={{
                  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px",
                  display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 250 }}>
                    <div style={{ fontSize: 13, fontFamily: "'Space Mono', monospace", color: "var(--gold)", fontWeight: 700, marginBottom: 4 }}>{e.projectCode}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{e.label}</div>
                    <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--text-3)" }}>
                      <span>{e.projectName}</span>
                      <span>·</span>
                      <span>{e.category}</span>
                      <span>·</span>
                      <span>{e.date}</span>
                      <Badge label={EXPENSE_STATUS[e.status]?.label} color={EXPENSE_STATUS[e.status]?.color} />
                    </div>
                    {e.bdcNumber && <div style={{ fontSize: 11, color: "var(--gold)", marginTop: 4, fontFamily: "'Space Mono', monospace" }}>{e.bdcNumber}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {e.bdcNumber && <button onClick={() => setPdfPreview({ url: `/api/expenses/${e.id}/bdc`, title: `BDC — ${e.bdcNumber}` })} style={{
                      padding: "6px 12px", background: "var(--gold)", color: "var(--gold-ink)", border: "none", borderRadius: 6,
                      fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    }}>BDC</button>}
                    <div style={{ textAlign: "right", minWidth: 150 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{(e.amount || 0).toFixed(2)}€ TTC</div>
                      <div style={{ fontSize: 12, color: "var(--text-3)" }}>{(e.amountHT || 0).toFixed(2)}€ HT</div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredExpenses.length === 0 && <div style={{ textAlign: "center", padding: "40px", color: "var(--text-3)", fontSize: 14 }}>Aucune dépense ne correspond à votre recherche</div>}
            </div>
          </div>
        )}

        {/* ═══ PROVIDERS VIEW ═══ */}
        {view === "providers" && (() => {
          // Count projects per provider
          const provProjectCount = {};
          (data.projects || []).forEach(p => {
            (p.expenses || []).forEach(e => {
              if (e.providerId) provProjectCount[e.providerId] = (provProjectCount[e.providerId] || new Set()).add(p.id);
            });
          });
          let provs = [...(data.providers || [])].map(p => ({ ...p, projectCount: provProjectCount[p.id]?.size || 0 }));

          // Search filter
          if (provSearch) {
            const q = provSearch.toLowerCase();
            provs = provs.filter(p =>
              (p.firstName || "").toLowerCase().includes(q) ||
              (p.lastName || "").toLowerCase().includes(q) ||
              (p.name || "").toLowerCase().includes(q) ||
              (p.company || "").toLowerCase().includes(q) ||
              (p.email || "").toLowerCase().includes(q) ||
              (p.categories || []).some(c => c.toLowerCase().includes(q))
            );
          }
          if (provFilterCat !== "All") provs = provs.filter(p => (p.categories || []).includes(provFilterCat));
          provs.sort((a, b) => {
            if (provSort === "rating") return (b.rating || 0) - (a.rating || 0);
            if (provSort === "tarif") return (b.tarifJour || 0) - (a.tarifJour || 0);
            if (provSort === "projects") return (b.projectCount || 0) - (a.projectCount || 0);
            return (a.firstName || a.name || "").localeCompare(b.firstName || b.name || "");
          });

          const hasActiveFilters = provSearch || provFilterCat !== "All";
          const totalProvs = (data.providers || []).length;

          return (
          <div>
            {/* ── HEADER ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                  Prestataires <span style={{ fontSize: 14, color: "var(--text-3)", fontWeight: 400 }}>({provs.length}{provs.length !== totalProvs ? ` / ${totalProvs}` : ''} freelances)</span>
                </h2>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>Répertoire prestataires — compétences, TJM, historique projets</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {selProvider && (
                  <button onClick={() => setSelProvider(null)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                    ← Tous les prestataires
                  </button>
                )}
                <button onClick={() => { setProvForm({ categories: [] }); setModal("newProvider"); }} style={{
                  padding: "8px 16px", background: "var(--gold)", color: "var(--gold-ink)", border: "none", borderRadius: 8,
                  fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}>+ Nouveau</button>
              </div>
            </div>

            {!selProvider ? (
            <div>
            {/* ── FILTER BAR ── */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="text" placeholder="Rechercher prestataire, compétence…"
                value={provSearch} onChange={e => setProvSearch(e.target.value)}
                style={{ flex: 1, minWidth: 180, padding: "8px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", fontSize: 13, fontFamily: "inherit", outline: "none" }}
              />
              <select value={provFilterCat} onChange={e => setProvFilterCat(e.target.value)} style={{
                padding: "7px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6,
                color: provFilterCat !== "All" ? "var(--gold)" : "var(--text-3)", fontSize: 12, fontFamily: "inherit", cursor: "pointer", outline: "none",
              }}>
                <option value="All">Toutes compétences</option>
                {allProvCats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={provSort} onChange={e => setProvSort(e.target.value)} style={{
                padding: "7px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6,
                color: provSort !== "name" ? "var(--gold)" : "var(--text-3)", fontSize: 12, fontFamily: "inherit", cursor: "pointer", outline: "none",
              }}>
                <option value="name">A→Z</option>
                <option value="rating">↓ Note</option>
                <option value="tarif">↓ TJM</option>
                <option value="projects">↓ Projets</option>
              </select>
              <div style={{ display: "flex", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
                <button onClick={() => setProvViewMode("grid")} style={{ padding: "7px 10px", background: provViewMode === "grid" ? "var(--gold-soft)" : "transparent", border: "none", borderRight: "1px solid var(--border)", color: provViewMode === "grid" ? "var(--gold)" : "var(--text-3)", cursor: "pointer", fontSize: 14 }} title="Vue grille">⊞</button>
                <button onClick={() => setProvViewMode("list")} style={{ padding: "7px 10px", background: provViewMode === "list" ? "var(--gold-soft)" : "transparent", border: "none", color: provViewMode === "list" ? "var(--gold)" : "var(--text-3)", cursor: "pointer", fontSize: 14 }} title="Vue liste">☰</button>
              </div>
              {hasActiveFilters && (
                <button onClick={() => { setProvSearch(""); setProvFilterCat("All"); }} style={{ padding: "7px 10px", background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: 6, color: "var(--danger)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✕ Reset</button>
              )}
            </div>

            {/* ── GRID VIEW ── */}
            {provViewMode === "grid" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                {provs.map(prov => {
                  const initials = (prov.firstName?.[0] || prov.lastName?.[0] || prov.name?.[0] || '?').toUpperCase();
                  const displayName = prov.firstName || prov.lastName
                    ? <>{fmtP(prov.firstName)} <span style={{ textTransform: "uppercase" }}>{fmtN(prov.lastName)}</span></>
                    : fmtP(prov.name);
                  const tjmMin = prov.tarifMin || prov.tarifJour || 0;
                  const tjmMax = prov.tarifMax || 0;
                  const hasRange = tjmMin > 0 && tjmMax > 0 && tjmMax > tjmMin;
                  const tjmLabel = tjmMin > 0
                    ? (hasRange ? `${tjmMin.toLocaleString('fr-FR')}–${tjmMax.toLocaleString('fr-FR')}€` : `${tjmMin.toLocaleString('fr-FR')}€`)
                    : "—";
                  return (
                    <div key={prov.id} onClick={() => setSelProvider(prov)} style={{
                      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20,
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--gold-hover)"; e.currentTarget.style.background = "var(--surface)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}
                    >
                      {/* Avatar + nom + nb projets */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--gold-soft)", border: "1px solid var(--gold-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "var(--gold)", flexShrink: 0 }}>
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>{displayName}</div>
                            {prov.company && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{prov.company}</div>}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--gold)" }}>{prov.projectCount || 0}</div>
                          <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>projets</div>
                        </div>
                      </div>
                      {/* Étoiles */}
                      <div style={{ marginBottom: 12 }} onClick={e => e.stopPropagation()}>
                        <StarRating value={prov.rating || 0} onChange={async (r) => {
                          await fetch(`/api/providers/${prov.id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ rating: r }) });
                          refreshData();
                        }} size={14} />
                      </div>
                      {/* Catégories */}
                      {(prov.categories || []).length > 0 && (
                        <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
                          {(prov.categories || []).map(cat => {
                            const c = getCatColor(cat);
                            return <span key={cat} style={{ fontSize: 10, fontWeight: 600, color: c.text, background: c.bg, padding: "2px 8px", borderRadius: 10, border: `1px solid ${c.border}` }}>{cat}</span>;
                          })}
                        </div>
                      )}
                      {/* Stats grid : TJM | Projets | TTC */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                        <div style={{ background: "var(--surface-2)", borderRadius: 6, padding: "8px 10px" }}>
                          <div style={{ fontSize: 9, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 2 }}>TJM HT</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: tjmMin > 0 ? "var(--text)" : "var(--text-3)" }}>{tjmLabel}</div>
                        </div>
                        <div style={{ background: "var(--surface-2)", borderRadius: 6, padding: "8px 10px" }}>
                          <div style={{ fontSize: 9, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 2 }}>Projets</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: prov.projectCount > 0 ? "var(--info)" : "var(--text-3)" }}>{prov.projectCount || 0}</div>
                        </div>
                        <div style={{ background: "var(--surface-2)", borderRadius: 6, padding: "8px 10px" }}>
                          <div style={{ fontSize: 9, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 2 }}>TTC/j</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)" }}>
                            {tjmMin > 0 && (prov.tvaRate || '20') !== '0'
                              ? `${computeTTC(tjmMin, prov.tvaRate || '20').toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€`
                              : "—"}
                          </div>
                        </div>
                      </div>
                      {/* Contact */}
                      {(prov.email || prov.phone) && (
                        <div style={{ fontSize: 11, color: "var(--text-3)", borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
                          {prov.email && <span style={{ display: "flex", alignItems: "center" }} title={prov.email}>✉ {prov.email}<CopyBtn text={prov.email} /></span>}
                          {prov.phone && <span style={{ display: "flex", alignItems: "center" }}>📞 {prov.phone}<CopyBtn text={prov.phone} /></span>}
                        </div>
                      )}
                    </div>
                  );
                })}
                {provs.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px", color: "var(--text-3)", fontSize: 14 }}>Aucun prestataire trouvé</div>}
              </div>
            )}

            {/* ── LIST VIEW ── */}
            {provViewMode === "list" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {provs.map(prov => {
                  const initials = (prov.firstName?.[0] || prov.lastName?.[0] || prov.name?.[0] || '?').toUpperCase();
                  const tjmMin = prov.tarifMin || prov.tarifJour || 0;
                  const tjmMax = prov.tarifMax || 0;
                  const hasRange = tjmMin > 0 && tjmMax > 0 && tjmMax > tjmMin;
                  return (
                    <div key={prov.id} onClick={() => setSelProvider(prov)} style={{
                      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 16px",
                      cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--gold-hover)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}>
                      {/* Left : avatar + nom + compétences */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 160 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--gold-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--gold)", flexShrink: 0 }}>
                          {initials}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                            {prov.firstName || prov.lastName
                              ? <>{fmtP(prov.firstName)} <span style={{ textTransform: "uppercase" }}>{fmtN(prov.lastName)}</span></>
                              : fmtP(prov.name)}
                          </div>
                          {prov.company && <div style={{ fontSize: 10, color: "var(--text-3)" }}>{prov.company}</div>}
                        </div>
                      </div>
                      {/* Right : catégories + TJM + projets + note + contact */}
                      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                        {(prov.categories || []).slice(0, 2).map(cat => {
                          const c = getCatColor(cat);
                          return <span key={cat} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>{cat}</span>;
                        })}
                        {tjmMin > 0 && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", minWidth: 50 }}>
                            {hasRange ? <>{tjmMin.toLocaleString('fr-FR')}–<span style={{ color: "var(--gold)" }}>{tjmMax.toLocaleString('fr-FR')}</span>€</> : `${tjmMin.toLocaleString('fr-FR')}€`}
                            <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 400 }}> /j</span>
                          </span>
                        )}
                        <span style={{ fontSize: 12, color: prov.projectCount > 0 ? "var(--info)" : "var(--text-3)" }}>{prov.projectCount} projet{prov.projectCount > 1 ? "s" : ""}</span>
                        <span onClick={e => e.stopPropagation()}>
                          <StarRating value={prov.rating || 0} onChange={async (r) => {
                            await fetch(`/api/providers/${prov.id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ rating: r }) });
                            refreshData();
                          }} size={12} />
                        </span>
                        {prov.email && <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11, color: "var(--text-3)" }}>✉ {prov.email}<CopyBtn text={prov.email} /></span>}
                        {prov.phone && <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11, color: "var(--text-3)" }}>📞 {prov.phone}<CopyBtn text={prov.phone} /></span>}
                      </div>
                    </div>
                  );
                })}
                {provs.length === 0 && <div style={{ textAlign: "center", padding: "40px", color: "var(--text-3)", fontSize: 14 }}>Aucun prestataire trouvé</div>}
              </div>
            )}
            </div>
            ) : (() => {
              /* ── PROVIDER DETAIL ── */
              const prov = selProvider;
              const initials = (prov.firstName?.[0] || prov.lastName?.[0] || prov.name?.[0] || '?').toUpperCase();
              const displayName = prov.firstName || prov.lastName
                ? `${prov.firstName ? prov.firstName.charAt(0).toUpperCase() + prov.firstName.slice(1).toLowerCase() : ''} ${(prov.lastName || '').toUpperCase()}`.trim()
                : (prov.name || '—');
              const tjmMin = prov.tarifMin || prov.tarifJour || 0;
              const tjmMax = prov.tarifMax || 0;
              const hasRange = tjmMin > 0 && tjmMax > 0 && tjmMax > tjmMin;

              // Collect all expenses from all projects linked to this provider
              const provExpenses = [];
              (data.projects || []).forEach(p => {
                (p.expenses || []).forEach(e => {
                  if (e.providerId === prov.id) {
                    provExpenses.push({ ...e, projectCode: p.code, projectName: p.name, projectId: p.id, projectStage: p.stage, project: p });
                  }
                });
              });
              // Group by project
              const expByProject = {};
              provExpenses.forEach(e => {
                if (!expByProject[e.projectId]) expByProject[e.projectId] = { project: e.project, expenses: [] };
                expByProject[e.projectId].expenses.push(e);
              });
              const projectGroups = Object.values(expByProject).sort((a, b) => (b.project.startDate || '') > (a.project.startDate || '') ? 1 : -1);
              const totalCA = provExpenses.reduce((s, e) => s + (e.amountHT || e.amount || 0), 0);

              return (
                <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, alignItems: "start" }}>
                  {/* ── FICHE PRESTATAIRE ── */}
                  <div>
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, marginBottom: 16 }}>
                      {/* Avatar + identité */}
                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--gold-soft)", border: "2px solid var(--gold)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "var(--gold)", flexShrink: 0 }}>
                          {initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", lineHeight: 1.3, display: "flex", alignItems: "center" }}>
                            {displayName}<CopyBtn text={displayName} />
                          </div>
                          {prov.company && (
                            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3, display: "flex", alignItems: "center" }}>
                              {prov.company}<CopyBtn text={prov.company} />
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Note */}
                      <div style={{ marginBottom: 16 }} onClick={e => e.stopPropagation()}>
                        <StarRating value={prov.rating || 0} onChange={async (r) => {
                          await fetch(`/api/providers/${prov.id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ rating: r }) });
                          refreshData();
                          setSelProvider(prev => ({ ...prev, rating: r }));
                        }} size={16} />
                      </div>
                      {/* Catégories */}
                      {(prov.categories || []).length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
                          {(prov.categories || []).map(cat => {
                            const c = getCatColor(cat);
                            return <span key={cat} style={{ fontSize: 10, fontWeight: 600, color: c.text, background: c.bg, padding: "3px 9px", borderRadius: 10, border: `1px solid ${c.border}` }}>{cat}</span>;
                          })}
                        </div>
                      )}
                      {/* Tous les champs — toujours affichés avec CopyBtn si renseigné */}
                      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 4 }}>
                        {[
                          { icon: "✉", label: "Email", val: prov.email },
                          { icon: "📞", label: "Téléphone", val: prov.phone },
                        ].map(r => (
                          <div key={r.label} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12, fontSize: 12 }}>
                            <span style={{ fontSize: 14, flexShrink: 0, opacity: r.val ? 1 : 0.3 }}>{r.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 9, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 2 }}>{r.label}</div>
                              {r.val ? (
                                <div style={{ color: "var(--text-2)", display: "flex", alignItems: "center" }}>
                                  {r.val}<CopyBtn text={r.val} />
                                </div>
                              ) : (
                                <div style={{ color: "var(--text-3)", fontStyle: "italic", fontSize: 11, cursor: "pointer" }}
                                  onClick={() => { setProvForm({ ...prov, categories: prov.categories || [] }); setModal(`editProvider:${prov.id}`); }}>
                                  — <span style={{ color: "var(--gold)" }}>Ajouter</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* TJM */}
                      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 2 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Tarif journalier HT</div>
                        {tjmMin > 0 ? (
                          <>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {hasRange ? (
                                <>
                                  <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{tjmMin.toLocaleString('fr-FR')}€</span>
                                  <CopyBtn text={`${tjmMin}`} />
                                  <span style={{ fontSize: 14, color: "var(--text-3)" }}>—</span>
                                  <span style={{ fontSize: 20, fontWeight: 800, color: "var(--gold)" }}>{tjmMax.toLocaleString('fr-FR')}€</span>
                                  <CopyBtn text={`${tjmMax}`} />
                                </>
                              ) : (
                                <>
                                  <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{tjmMin.toLocaleString('fr-FR')}€</span>
                                  <CopyBtn text={`${tjmMin}`} />
                                </>
                              )}
                            </div>
                            {(prov.tvaRate || '20') !== '0' && (
                              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4, display: "flex", alignItems: "center" }}>
                                TTC : {hasRange
                                  ? `${computeTTC(tjmMin, prov.tvaRate||'20').toLocaleString('fr-FR',{maximumFractionDigits:0})}€ — ${computeTTC(tjmMax, prov.tvaRate||'20').toLocaleString('fr-FR',{maximumFractionDigits:0})}€`
                                  : `${computeTTC(tjmMin, prov.tvaRate||'20').toLocaleString('fr-FR',{maximumFractionDigits:0})}€`}
                                <CopyBtn text={`${computeTTC(tjmMin, prov.tvaRate||'20').toFixed(0)}`} />
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ color: "var(--text-3)", fontStyle: "italic", fontSize: 11, cursor: "pointer" }}
                            onClick={() => { setProvForm({ ...prov, categories: prov.categories || [] }); setModal(`editProvider:${prov.id}`); }}>
                            — <span style={{ color: "var(--gold)" }}>Ajouter</span>
                          </div>
                        )}
                      </div>
                      {/* Notes */}
                      {prov.notes && (
                        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 14 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, display: "flex", alignItems: "center" }}>
                            Notes<CopyBtn text={prov.notes} />
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.6 }}>{prov.notes}</div>
                        </div>
                      )}
                      {/* Actions */}
                      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                        <button onClick={() => { setProvForm({ ...prov, categories: prov.categories || [] }); setModal(`editProvider:${prov.id}`); }} style={{ flex: 1, padding: "8px", background: "var(--gold-soft)", border: "1px solid var(--gold-hover)", borderRadius: 6, color: "var(--gold)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                          ✏ Modifier
                        </button>
                        <button onClick={() => deleteProvider(prov.id)} style={{ padding: "8px 12px", background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: 6, color: "var(--danger)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                          ✕
                        </button>
                      </div>
                    </div>
                    {/* Stats card */}
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Statistiques</div>
                      {[
                        { l: "Projets", v: projectGroups.length, c: "var(--gold)" },
                        { l: "Volume facturé HT", v: totalCA > 0 ? `${totalCA.toLocaleString('fr-FR')}€` : "—", c: "var(--text)" },
                        { l: "Dépenses enregistrées", v: provExpenses.length, c: "var(--text-3)" },
                        { l: "Note", v: prov.rating ? `${prov.rating}/5 ★` : "Non noté", c: prov.rating >= 4 ? "var(--success)" : prov.rating >= 3 ? "var(--gold)" : "var(--text-3)" },
                      ].map(s => (
                        <div key={s.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{s.l}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: s.c }}>{s.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── PROJETS / DÉPENSES ── */}
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
                      Interventions ({projectGroups.length} projet{projectGroups.length !== 1 ? "s" : ""})
                    </div>
                    {projectGroups.length === 0 ? (
                      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "32px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                        Aucune dépense liée à ce prestataire pour l'instant.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {projectGroups.map(({ project: p, expenses: exps }) => {
                          const pillar = PILLAR_MAP[p.pillar];
                          const stage = STAGE_MAP[p.stage];
                          const groupTotal = exps.reduce((s, e) => s + (e.amountHT || e.amount || 0), 0);
                          return (
                            <div key={p.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                              {/* En-tête projet */}
                              <div onClick={() => { setSelProvider(null); setView("projects"); setSelProject(p); }}
                                style={{ padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: exps.length > 0 ? "1px solid var(--border)" : "none" }}
                                onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: pillar?.color || "var(--text-3)" }}>{p.code}</span>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{p.name}</span>
                                </div>
                                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                  <Badge label={stage?.label || p.stage} color={stage?.color || "var(--text-3)"} />
                                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)" }}>{groupTotal.toLocaleString('fr-FR')}€ HT</span>
                                </div>
                              </div>
                              {/* Lignes dépenses */}
                              {exps.map(e => (
                                <div key={e.id} style={{ padding: "10px 18px 10px 34px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--surface)", fontSize: 12 }}>
                                  <div>
                                    <span style={{ color: "var(--text-2)" }}>{e.label}</span>
                                    {e.date && <span style={{ color: "var(--text-3)", marginLeft: 8 }}>{e.date}</span>}
                                  </div>
                                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                    <Badge label={EXPENSE_STATUS[e.status]?.label || e.status} color={EXPENSE_STATUS[e.status]?.color || "var(--text-3)"} />
                                    <span style={{ fontWeight: 600, color: "var(--text)" }}>{(e.amountHT || e.amount || 0).toLocaleString('fr-FR')}€ HT</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
          );
        })()}
      </div>

        {/* ═══ TEAM VIEW ═══ */}
        {view === "team" && (
          <div style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: 0 }}>Team</h2>
              <button onClick={() => { setTeamForm({}); setModal("newTeam"); }} style={{
                padding: "8px 18px", background: "var(--gold)", color: "var(--gold-ink)", border: "none", borderRadius: 8,
                fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              }}>+ Membre</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {(data.team || []).map(m => (
                <div key={m.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{fmtP(m.name)}</div>
                      <div style={{ fontSize: 12, color: "var(--gold)", marginTop: 2 }}>{m.role || "—"}</div>
                    </div>
                    <span style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: m.type === "internal" ? "var(--success-soft)" : "var(--info-soft)",
                      color: m.type === "internal" ? "var(--success)" : "var(--info)",
                      border: `1px solid ${m.type === "internal" ? "var(--success-soft)" : "var(--info-soft)"}`,
                    }}>{m.type === "internal" ? "Interne" : "Freelance"}</span>
                  </div>
                  {m.email && <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 2 }}>{m.email}</div>}
                  {m.phone && <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 2 }}>{m.phone}</div>}
                  {m.providerId && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>Lié au prestataire: {data.providers.find(p => p.id === m.providerId)?.name || "?"}</div>}
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <button onClick={() => { setTeamForm(m); setModal(`editTeam:${m.id}`); }} style={{
                      padding: "5px 12px", background: "var(--gold-soft)", border: "1px solid var(--gold)", borderRadius: 6,
                      color: "var(--gold)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    }}>Modifier</button>
                    <button onClick={() => deleteTeamMember(m.id)} style={{
                      padding: "5px 12px", background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: 6,
                      color: "var(--danger)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    }}>Retirer</button>
                  </div>
                </div>
              ))}
              {(!data.team || data.team.length === 0) && <div style={{ textAlign: "center", padding: 40, color: "var(--text-3)", fontSize: 14, gridColumn: "1/-1" }}>Aucun membre dans l'équipe</div>}
            </div>
          </div>
        )}

        {/* ═══ TASKS VIEW (Kanban + Liste) ═══ */}
        {view === "tasks" && (() => {
          const TASK_COLS = [
            { key: "todo",        label: "À faire",   color: "var(--text-3)",    icon: "○" },
            { key: "in_progress", label: "En cours",  color: "var(--info)", icon: "◐" },
            { key: "review",      label: "En revue",  color: "var(--warning)", icon: "◑" },
            { key: "done",        label: "Terminé",   color: "var(--success)", icon: "●" },
          ];
          const STATUS_INFO = Object.fromEntries(TASK_COLS.map(c => [c.key, c]));

          // ── All tasks enriched ──
          let allTasks = data.projects.flatMap(p =>
            (p.tasks || []).map(t => ({ ...t, projectCode: p.code, projectName: p.name, projectId: p.id, projectPillar: p.pillar }))
          );

          // ── Extract unique assignees & projects for filters ──
          const assignees = [...new Set(allTasks.map(t => t.assigneeName).filter(Boolean))].sort();
          const projectsWithTasks = [...new Map(allTasks.map(t => [t.projectId, { id: t.projectId, code: t.projectCode, name: t.projectName }])).values()].sort((a, b) => a.code.localeCompare(b.code));

          // ── Apply filters ──
          let filtered = allTasks;
          if (tasksFilterAssignee === "__none__") filtered = filtered.filter(t => !t.assigneeName);
          else if (tasksFilterAssignee !== "all") filtered = filtered.filter(t => t.assigneeName === tasksFilterAssignee);
          if (tasksFilterProject !== "all") filtered = filtered.filter(t => t.projectId === tasksFilterProject);

          const byStatus = {};
          TASK_COLS.forEach(c => { byStatus[c.key] = filtered.filter(t => t.status === c.key); });
          const totalTasks = filtered.length;
          const doneTasks = byStatus.done.length;
          const globalPct = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0;

          const handleTaskDrop = async (taskId, newStatus) => {
            setData(prev => ({
              ...prev,
              projects: prev.projects.map(p => ({
                ...p,
                tasks: (p.tasks || []).map(t => t.id === taskId ? { ...t, status: newStatus } : t),
              })),
            }));
            try {
              await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
              });
            } catch (err) { console.error('Erreur changement statut tâche:', err); }
          };

          // ── Shared card renderer ──
          const TaskCard = ({ t, colColor }) => {
            const due = t.dueDate ? new Date(t.dueDate) : null;
            const now = new Date();
            const daysLeft = due ? Math.ceil((due - now) / 86400000) : null;
            const isOverdue = daysLeft !== null && daysLeft < 0;
            const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
            return (
              <div
                draggable
                onDragStart={e => { e.dataTransfer.setData('taskId', t.id); e.dataTransfer.effectAllowed = 'move'; }}
                onClick={() => { const proj = data.projects.find(p => p.id === t.projectId); if (proj) { setSelProject(proj); setView("projects"); setProjectTab("tasks"); } }}
                style={{
                  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
                  padding: "10px 12px", cursor: "grab", transition: "border-color 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = alpha(colColor || "var(--gold)", 40)}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "var(--gold)", fontWeight: 700 }}>{t.projectCode}</span>
                  <button
                    title="Supprimer"
                    onClick={e => { e.stopPropagation(); setDeleteConfirm({ id: t.id, code: t.projectCode, name: t.title, isTask: true }); }}
                    style={{ background: "transparent", border: "none", cursor: "pointer", padding: "1px 3px", fontSize: 10, color: "var(--text-3)", lineHeight: 1, borderRadius: 3 }}
                    onMouseEnter={e => { e.currentTarget.style.color = "var(--danger)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--text-3)"; }}
                  >✕</button>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 4, lineHeight: 1.3 }}>{t.title}</div>
                {t.assigneeName && <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 2 }}>👤 {t.assigneeName}</div>}
                {due && <div style={{ fontSize: 9, color: isOverdue ? "var(--danger)" : isUrgent ? "var(--warning)" : "var(--text-3)", marginTop: 2 }}>
                  ⏱ {due.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  {isOverdue && ` (+${Math.abs(daysLeft)}j)`}
                </div>}
                <div style={{ fontSize: 9, color: "var(--text-3)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.projectName}
                </div>
              </div>
            );
          };

          // ── Dropdown style ──
          const selStyle = {
            padding: "6px 10px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6,
            color: "var(--text-2)", fontSize: 11, fontFamily: "inherit", cursor: "pointer", outline: "none",
          };

          return (
            <div>
              {/* ── Header ── */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: 0 }}>Tâches</h2>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--text-3)" }}>{totalTasks} tâche{totalTasks > 1 ? "s" : ""}</span>
                  {totalTasks > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", padding: "4px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
                      <div style={{ width: 80, height: 4, background: "var(--surface-3)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${globalPct}%`, height: "100%", background: globalPct === 100 ? "var(--success)" : "var(--gold)", borderRadius: 2, transition: "width 0.3s" }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: globalPct === 100 ? "var(--success)" : "var(--gold)" }}>{globalPct}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Toolbar: view toggle + filters + groupBy ── */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
                {/* View toggle */}
                <div style={{ display: "flex", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
                  {[{ k: "kanban", l: "Kanban", icon: "▣" }, { k: "list", l: "Liste", icon: "☰" }].map(v => (
                    <button key={v.k} onClick={() => setTasksViewMode(v.k)} style={{
                      padding: "6px 14px", border: "none", cursor: "pointer", fontFamily: "inherit",
                      fontSize: 11, fontWeight: 600, transition: "all 0.15s",
                      background: tasksViewMode === v.k ? "var(--gold-soft)" : "transparent",
                      color: tasksViewMode === v.k ? "var(--gold)" : "var(--text-3)",
                      borderRight: v.k === "kanban" ? "1px solid var(--border)" : "none",
                    }}>{v.icon} {v.l}</button>
                  ))}
                </div>

                <div style={{ width: 1, height: 20, background: "var(--surface-3)" }} />

                {/* Filter: assignee */}
                <select value={tasksFilterAssignee} onChange={e => setTasksFilterAssignee(e.target.value)} style={selStyle}>
                  <option value="all">👤 Tous</option>
                  {assignees.map(a => <option key={a} value={a}>{a}</option>)}
                  <option value="__none__">Non assigné</option>
                </select>

                {/* Filter: project */}
                <select value={tasksFilterProject} onChange={e => setTasksFilterProject(e.target.value)} style={selStyle}>
                  <option value="all">▣ Tous les projets</option>
                  {projectsWithTasks.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                </select>

                {/* GroupBy (for list view) */}
                {tasksViewMode === "list" && (
                  <>
                    <div style={{ width: 1, height: 20, background: "var(--surface-3)" }} />
                    <span style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase" }}>Grouper par :</span>
                    {[{ k: "status", l: "Statut" }, { k: "assignee", l: "Personne" }, { k: "project", l: "Projet" }].map(g => (
                      <button key={g.k} onClick={() => setTasksGroupBy(g.k)} style={{
                        padding: "4px 10px", borderRadius: 6, border: `1px solid ${tasksGroupBy === g.k ? "var(--gold)" : "var(--border)"}`,
                        background: tasksGroupBy === g.k ? "var(--gold-soft)" : "transparent",
                        color: tasksGroupBy === g.k ? "var(--gold)" : "var(--text-3)",
                        fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      }}>{g.l}</button>
                    ))}
                  </>
                )}

                {/* Reset filters */}
                {(tasksFilterAssignee !== "all" || tasksFilterProject !== "all") && (
                  <button onClick={() => { setTasksFilterAssignee("all"); setTasksFilterProject("all"); }} style={{
                    padding: "4px 10px", borderRadius: 6, border: "1px solid var(--danger-soft)",
                    background: "var(--danger-soft)", color: "var(--danger)", fontSize: 10, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>✕ Reset</button>
                )}
              </div>

              {/* ── KPI pills ── */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                {TASK_COLS.map(c => (
                  <div key={c.key} style={{
                    background: "var(--surface)", border: `1px solid ${alpha(c.color, 20)}`, borderRadius: 8,
                    padding: "8px 16px", display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span style={{ fontSize: 14, color: c.color }}>{c.icon}</span>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{byStatus[c.key].length}</div>
                      <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase" }}>{c.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ════════ KANBAN VIEW ════════ */}
              {tasksViewMode === "kanban" && (
                <div style={{ overflowX: "auto", paddingBottom: 16 }}>
                  <div style={{ display: "flex", gap: 10, minWidth: "max-content", alignItems: "flex-start" }}>
                    {TASK_COLS.map(col => {
                      const colTasks = byStatus[col.key];
                      return (
                        <div key={col.key} style={{ width: 260, flexShrink: 0 }}
                          onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                          onDrop={e => { e.preventDefault(); const taskId = e.dataTransfer.getData('taskId'); if (taskId) handleTaskDrop(taskId, col.key); }}
                        >
                          <div style={{
                            background: "var(--surface)", borderTop: `2px solid ${col.color}`,
                            borderLeft: `1px solid ${alpha(col.color, 20)}`, borderRight: `1px solid ${alpha(col.color, 20)}`,
                            borderRadius: "10px 10px 0 0", padding: "10px 14px",
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: col.color }}>{col.icon} {col.label}</span>
                              <span style={{ fontSize: 10, fontWeight: 700, background: alpha(col.color, 13), color: col.color, padding: "1px 6px", borderRadius: 10 }}>{colTasks.length}</span>
                            </div>
                          </div>
                          <div style={{
                            background: "var(--bg)", borderLeft: `1px solid ${alpha(col.color, 13)}`, borderRight: `1px solid ${alpha(col.color, 13)}`,
                            borderBottom: `1px solid ${alpha(col.color, 13)}`, borderRadius: "0 0 10px 10px",
                            padding: 6, display: "flex", flexDirection: "column", gap: 6, minHeight: 80,
                          }}>
                            {colTasks.map(t => <TaskCard key={t.id} t={t} colColor={col.color} />)}
                            {colTasks.length === 0 && <div style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center", padding: "20px 0", fontStyle: "italic" }}>vide</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ════════ LIST VIEW ════════ */}
              {tasksViewMode === "list" && (() => {
                // Group tasks
                let groups = [];
                if (tasksGroupBy === "status") {
                  groups = TASK_COLS.map(c => ({ key: c.key, label: `${c.icon} ${c.label}`, color: c.color, tasks: byStatus[c.key] }));
                } else if (tasksGroupBy === "assignee") {
                  const byAssignee = {};
                  filtered.forEach(t => {
                    const k = t.assigneeName || "Non assigné";
                    if (!byAssignee[k]) byAssignee[k] = [];
                    byAssignee[k].push(t);
                  });
                  groups = Object.entries(byAssignee).sort((a, b) => a[0].localeCompare(b[0])).map(([name, tasks]) => ({
                    key: name, label: `👤 ${name}`, color: "var(--gold)", tasks,
                  }));
                } else if (tasksGroupBy === "project") {
                  const byProj = {};
                  filtered.forEach(t => {
                    if (!byProj[t.projectId]) byProj[t.projectId] = { code: t.projectCode, name: t.projectName, tasks: [] };
                    byProj[t.projectId].tasks.push(t);
                  });
                  groups = Object.values(byProj).sort((a, b) => a.code.localeCompare(b.code)).map(g => ({
                    key: g.code, label: `${g.code} — ${g.name}`, color: "var(--gold)", tasks: g.tasks,
                  }));
                }

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {groups.filter(g => g.tasks.length > 0).map(group => (
                      <div key={group.key}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${alpha(group.color, 20)}` }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: group.color }}>{group.label}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, background: alpha(group.color, 13), color: group.color, padding: "1px 6px", borderRadius: 10 }}>{group.tasks.length}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {group.tasks.map(t => {
                            const si = STATUS_INFO[t.status] || TASK_COLS[0];
                            const due = t.dueDate ? new Date(t.dueDate) : null;
                            const now = new Date();
                            const daysLeft = due ? Math.ceil((due - now) / 86400000) : null;
                            const isOverdue = daysLeft !== null && daysLeft < 0;
                            return (
                              <div key={t.id}
                                draggable
                                onDragStart={e => { e.dataTransfer.setData('taskId', t.id); e.dataTransfer.effectAllowed = 'move'; }}
                                onClick={() => { const proj = data.projects.find(p => p.id === t.projectId); if (proj) { setSelProject(proj); setView("projects"); setProjectTab("tasks"); } }}
                                style={{
                                  display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                                  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
                                  cursor: "pointer", transition: "border-color 0.15s",
                                }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = "var(--gold)"}
                                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                              >
                                {/* Status dot */}
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: si.color, flexShrink: 0 }} />
                                {/* Project code */}
                                <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "var(--gold)", fontWeight: 700, width: 75, flexShrink: 0 }}>{t.projectCode}</span>
                                {/* Title */}
                                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                                {/* Assignee */}
                                <span style={{ fontSize: 10, color: "var(--text-3)", width: 90, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.assigneeName || "—"}</span>
                                {/* Due date */}
                                <span style={{ fontSize: 10, color: isOverdue ? "var(--danger)" : "var(--text-3)", width: 60, flexShrink: 0, textAlign: "right" }}>
                                  {due ? due.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : "—"}
                                </span>
                                {/* Status badge */}
                                <span style={{ fontSize: 9, fontWeight: 600, color: si.color, background: alpha(si.color, 9), padding: "2px 8px", borderRadius: 10, flexShrink: 0 }}>{si.label}</span>
                                {/* Delete */}
                                <button
                                  title="Supprimer"
                                  onClick={e => { e.stopPropagation(); setDeleteConfirm({ id: t.id, code: t.projectCode, name: t.title, isTask: true }); }}
                                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: "2px 4px", fontSize: 10, color: "var(--text-3)", lineHeight: 1 }}
                                  onMouseEnter={e => { e.currentTarget.style.color = "var(--danger)"; }}
                                  onMouseLeave={e => { e.currentTarget.style.color = "var(--text-3)"; }}
                                >✕</button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {filtered.length === 0 && <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-3)", fontSize: 13 }}>Aucune tâche{tasksFilterAssignee !== "all" || tasksFilterProject !== "all" ? " pour ces filtres" : ""}</div>}
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* ═══ CALENDAR VIEW ═══ */}
        {view === "calendar" && (() => {
          const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
          const DAYS_FR = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
          const daysInMonth = new Date(dashCalYear, dashCalMonth + 1, 0).getDate();
          const firstDow = (new Date(dashCalYear, dashCalMonth, 1).getDay() + 6) % 7;
          const cells = [];
          for (let i = 0; i < firstDow; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(d);
          while (cells.length % 7 !== 0) cells.push(null);
          const pad = (n) => String(n).padStart(2, '0');
          const PILLAR_COLORS = { STUDIO: 'var(--gold)', PROD: 'var(--info)', GRIOTHEQUE: 'var(--success)' };
          const PILLAR_LABELS = { STUDIO: 'Studio', PROD: 'Production', GRIOTHEQUE: 'Griothèque' };
          const prevMonth = () => { if (dashCalMonth === 0) { setDashCalMonth(11); setDashCalYear(dashCalYear - 1); } else setDashCalMonth(dashCalMonth - 1); setDashCalPopover(null); };
          const nextMonth = () => { if (dashCalMonth === 11) { setDashCalMonth(0); setDashCalYear(dashCalYear + 1); } else setDashCalMonth(dashCalMonth + 1); setDashCalPopover(null); };
          const activeProjects = data.projects.filter(p => ["signed", "active", "delivered"].includes(p.stage) && (p.startDate || p.endDate));
          const fmtD = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
          const popProject = dashCalPopover?.projectId ? data.projects.find(p => p.id === dashCalPopover.projectId) : null;
          return (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>📅 Calendrier</h2>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", position: "relative" }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                  <button onClick={prevMonth} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", cursor: "pointer", padding: "6px 12px", fontSize: 14, fontFamily: "inherit" }}>‹</button>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{MONTHS_FR[dashCalMonth]} {dashCalYear}</div>
                  <button onClick={nextMonth} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", cursor: "pointer", padding: "6px 12px", fontSize: 14, fontFamily: "inherit" }}>›</button>
                </div>
                {/* Legend */}
                <div style={{ display: "flex", gap: 16, padding: "8px 20px", borderBottom: "1px solid var(--border)" }}>
                  {[{l: "Studio", c: PILLAR_COLORS.STUDIO}, {l: "Production", c: PILLAR_COLORS.PROD}, {l: "Griothèque", c: PILLAR_COLORS.GRIOTHEQUE}].map(p => (
                    <div key={p.l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-3)" }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: p.c }}></div>{p.l}
                    </div>
                  ))}
                </div>
                {/* Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                  {DAYS_FR.map(d => (
                    <div key={d} style={{ padding: "10px 4px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", borderBottom: "1px solid var(--border)" }}>{d}</div>
                  ))}
                  {cells.map((day, idx) => {
                    if (!day) return <div key={`e${idx}`} style={{ minHeight: 100, background: "var(--bg)", borderBottom: "1px solid var(--border)", borderRight: idx % 7 !== 6 ? "1px solid var(--border)" : "none" }} />;
                    const dateStr = `${dashCalYear}-${pad(dashCalMonth + 1)}-${pad(day)}`;
                    const isToday = dateStr === new Date().toISOString().slice(0, 10);
                    const dayProjects = activeProjects.filter(p => {
                      const s = p.startDate || p.endDate;
                      const e = p.endDate || p.startDate;
                      return s <= dateStr && e >= dateStr;
                    });
                    return (
                      <div key={`d${day}`} style={{ minHeight: 100, padding: "4px 6px", background: isToday ? "var(--gold-soft)" : "transparent", borderBottom: "1px solid var(--border)", borderRight: idx % 7 !== 6 ? "1px solid var(--border)" : "none", cursor: "pointer", transition: "background 0.1s" }}
                        onMouseEnter={e => { if (!isToday) e.currentTarget.style.background = "var(--surface)"; }}
                        onMouseLeave={e => { if (!isToday) e.currentTarget.style.background = "transparent"; }}>
                        <div style={{ fontSize: 11, fontWeight: isToday ? 800 : 500, color: isToday ? "var(--gold)" : "var(--text-3)", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                          {isToday ? <span style={{ background: "var(--gold)", color: "var(--gold-ink)", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>{day}</span> : day}
                        </div>
                        {dayProjects.slice(0, 3).map(p => {
                          const color = PILLAR_COLORS[p.pillar] || "var(--gold)";
                          const isDeadline = p.endDate === dateStr;
                          return (
                            <div key={p.id} onClick={(e) => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setDashCalPopover({ projectId: p.id, x: rect.left + rect.width / 2, y: rect.bottom + 4 }); }}
                              style={{ fontSize: 9, fontWeight: 600, padding: "3px 6px", marginBottom: 2, borderRadius: 4, background: color + "22", color: color, borderLeft: `3px solid ${color}`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", lineHeight: "16px", transition: "all 0.1s" }}
                              onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.3)"; }}
                              onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
                              title={`${p.code} — ${p.name}${isDeadline ? " (deadline)" : ""}`}>
                              {isDeadline && "⚠ "}{p.code}
                            </div>
                          );
                        })}
                        {dayProjects.length > 3 && <div style={{ fontSize: 9, color: "var(--text-3)", textAlign: "center" }}>+{dayProjects.length - 3} autres</div>}
                      </div>
                    );
                  })}
                </div>
                {/* ── Inline Popover ── */}
                {dashCalPopover && popProject && <>
                  <div onClick={() => setDashCalPopover(null)} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
                  <div style={{ position: "fixed", left: Math.min(dashCalPopover.x - 140, typeof window !== 'undefined' ? window.innerWidth - 300 : 800), top: dashCalPopover.y + 4, zIndex: 210, width: 280, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", boxShadow: "var(--shadow-lg)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: "var(--text-3)", marginBottom: 2 }}>{popProject.code}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)", lineHeight: 1.3 }}>{popProject.name}</div>
                      </div>
                      <div onClick={() => setDashCalPopover(null)} style={{ cursor: "pointer", color: "var(--text-3)", fontSize: 14, marginLeft: 8 }}>✕</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", fontSize: 11, marginBottom: 12 }}>
                      <div>
                        <div style={{ color: "var(--text-3)", fontSize: 9, textTransform: "uppercase", marginBottom: 2 }}>Pilier</div>
                        <div style={{ color: PILLAR_COLORS[popProject.pillar] || "var(--gold)", fontWeight: 700 }}>{PILLAR_LABELS[popProject.pillar] || popProject.pillar}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-3)", fontSize: 9, textTransform: "uppercase", marginBottom: 2 }}>Stage</div>
                        <div style={{ color: "var(--text)", fontWeight: 600 }}>{STAGE_MAP[popProject.stage]?.label || popProject.stage}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-3)", fontSize: 9, textTransform: "uppercase", marginBottom: 2 }}>Dates</div>
                        <div style={{ color: "var(--text)" }}>{fmtD(popProject.startDate)} → {fmtD(popProject.endDate)}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--text-3)", fontSize: 9, textTransform: "uppercase", marginBottom: 2 }}>Revenu</div>
                        <div style={{ color: "var(--gold)", fontWeight: 700 }}>{(popProject.revenue || 0).toLocaleString('fr-FR')} €</div>
                      </div>
                      {popProject.client && <div style={{ gridColumn: "1 / -1" }}>
                        <div style={{ color: "var(--text-3)", fontSize: 9, textTransform: "uppercase", marginBottom: 2 }}>Client</div>
                        <div style={{ color: "var(--text)" }}>{popProject.client}</div>
                      </div>}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => { setSelProject(popProject); setView("projects"); setDashCalPopover(null); }} style={{ flex: 1, padding: "7px 0", border: "none", borderRadius: 6, background: "var(--gold)", color: "var(--gold-ink)", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Voir le projet</button>
                    </div>
                  </div>
                </>}
              </div>
            </div>
          );
        })()}

        {/* ═══ SETTINGS VIEW ═══ */}
        {view === "settings" && (() => {
          const sf = settingsForm || settings;
          const usf = (k, v) => setSettingsForm(f => ({ ...(f || settings), [k]: v }));
          const saveSettings = async () => {
            setSavingSettings(true);
            try {
              const updated = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settingsForm) }).then(r => r.json());
              setSettings(updated);
              setSettingsForm(null);
            } finally { setSavingSettings(false); }
          };
          const isEmpty = v => !v || v === "À compléter" || v === "À compléter (ex: TVA non applicable art. 293B CGI)";
          const allFields = ["companyName","legalStatus","legalRepFirstName","legalRepLastName","capital","siret","tvaNumber","rcs","apeCode","address","postalCode","city","country","phone","email","website","bankName","iban","bic","paymentTerms","latePaymentNote","tvaNote"];
          const filledCount = allFields.filter(k => !isEmpty(sf[k])).length;
          const completionPct = Math.round((filledCount / allFields.length) * 100);

          const Field2 = ({ label, k, placeholder, type = "text", flex = 1 }) => {
            const val = sf[k] || "";
            const missing = isEmpty(val);
            return (
              <div style={{ flex }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 5, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                {settingsForm ? (
                  <input value={val} onChange={e => usf(k, e.target.value)} placeholder={placeholder} type={type}
                    style={{ width: "100%", background: "var(--bg)", border: `1px solid ${missing ? "var(--warning)" : "var(--border)"}`, borderRadius: 8, padding: "10px 12px", color: "var(--text)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none", transition: "border-color 0.15s" }} />
                ) : (
                  <div style={{ fontSize: 13, padding: "10px 0", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    {missing
                      ? <span style={{ color: "var(--text-3)", fontStyle: "italic" }}>Non renseigné</span>
                      : <span style={{ color: "var(--text)" }}>{val}</span>}
                    {missing && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--warning)", background: "var(--warning-soft)", border: "1px solid var(--warning-soft)", borderRadius: 4, padding: "2px 6px", letterSpacing: "0.05em" }}>À REMPLIR</span>}
                  </div>
                )}
              </div>
            );
          };

          const navSections = [
            { id: "identity", icon: "🏢", label: "Identité", keys: ["companyName","legalStatus","legalRepFirstName","legalRepLastName","capital"] },
            { id: "legal",    icon: "🔢", label: "Numéros légaux", keys: ["siret","tvaNumber","rcs","apeCode"] },
            { id: "contact",  icon: "📍", label: "Coordonnées", keys: ["address","postalCode","city","country","phone","email","website"] },
            { id: "bank",     icon: "🏦", label: "Banque", keys: ["bankName","iban","bic"] },
            { id: "legal2",   icon: "📋", label: "Mentions légales", keys: ["paymentTerms","latePaymentNote","tvaNote"] },
          ];
          const activeNav = navSections.find(s => s.id === settingsSection) || navSections[0];

          return (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              {/* ── HEADER ── */}
              <div style={{ background: "linear-gradient(135deg, var(--surface) 0%, var(--bg) 100%)", borderBottom: "1px solid var(--border)", padding: "28px 32px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--gold)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Structure</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", letterSpacing: "0.02em", marginBottom: 4 }}>
                      {sf.companyName || "Ma structure"}
                      {sf.legalStatus && <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-3)", marginLeft: 10 }}>{sf.legalStatus}</span>}
                    </div>
                    {(sf.legalRepFirstName || sf.legalRepLastName) && (
                      <div style={{ fontSize: 13, color: "var(--text-3)" }}>{fmtP(sf.legalRepFirstName)} {fmtN(sf.legalRepLastName)} · {sf.city || "—"}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      {settingsForm ? (
                        <>
                          <button onClick={() => setSettingsForm(null)} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-3)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
                          <button onClick={saveSettings} disabled={savingSettings} style={{ padding: "8px 20px", background: "var(--gold)", border: "none", borderRadius: 8, color: "var(--gold-ink)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{savingSettings ? "…" : "✓ Sauvegarder"}</button>
                        </>
                      ) : (
                        <button onClick={() => setSettingsForm({ ...settings })} style={{ padding: "8px 20px", background: "var(--gold-soft)", border: "1px solid var(--gold)", borderRadius: 8, color: "var(--gold)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✎ Modifier</button>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 120, height: 4, background: "var(--surface-3)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${completionPct}%`, height: "100%", background: completionPct === 100 ? "var(--success)" : completionPct > 50 ? "var(--gold)" : "var(--danger)", borderRadius: 2, transition: "width 0.3s" }} />
                      </div>
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>{completionPct}% complété</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── BODY ── */}
              <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                {/* Sidebar nav */}
                <div style={{ width: 200, borderRight: "1px solid var(--border)", padding: "20px 12px", display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                  {navSections.map(s => {
                    const sectionMissing = s.keys.filter(k => isEmpty(sf[k])).length;
                    const isActive = settingsSection === s.id;
                    return (
                      <button key={s.id} onClick={() => setSettingsSection(s.id)} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 12px", borderRadius: 8, border: "none", textAlign: "left",
                        background: isActive ? "var(--gold-soft)" : "transparent",
                        borderLeft: isActive ? "2px solid var(--gold)" : "2px solid transparent",
                        cursor: "pointer", fontFamily: "inherit", transition: "all 0.1s",
                      }}>
                        <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? "var(--gold)" : "var(--text-3)" }}>{s.icon} {s.label}</span>
                        {sectionMissing > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--warning)", background: "var(--warning-soft)", borderRadius: 10, padding: "1px 6px", minWidth: 16, textAlign: "center" }}>{sectionMissing}</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Content */}
                <div style={{ flex: 1, padding: "28px 32px", overflowY: "auto" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{activeNav.icon} {activeNav.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 24 }}>
                    {activeNav.id === "identity" && "Raison sociale, statut et représentant légal"}
                    {activeNav.id === "legal" && "Identifiants officiels de la structure — Kbis"}
                    {activeNav.id === "contact" && "Adresse du siège et contacts publics"}
                    {activeNav.id === "bank" && "Coordonnées bancaires pour les devis et factures"}
                    {activeNav.id === "legal2" && "Mentions obligatoires sur vos documents commerciaux"}
                  </div>

                  <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}>
                    {activeNav.id === "identity" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ display: "flex", gap: 16 }}>
                          <Field2 label="Nom de la structure" k="companyName" placeholder="LES GRIOTS" flex={2} />
                          <Field2 label="Statut juridique" k="legalStatus" placeholder="SASU" />
                        </div>
                        <div style={{ display: "flex", gap: 16 }}>
                          <Field2 label="Prénom représentant légal" k="legalRepFirstName" placeholder="Moos" />
                          <Field2 label="Nom représentant légal" k="legalRepLastName" placeholder="Coulibaly" />
                          <Field2 label="Capital social" k="capital" placeholder="1 000 €" />
                        </div>
                      </div>
                    )}
                    {activeNav.id === "legal" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ display: "flex", gap: 16 }}>
                          <Field2 label="SIRET" k="siret" placeholder="XXX XXX XXX XXXXX" flex={2} />
                          <Field2 label="N° TVA intracommunautaire" k="tvaNumber" placeholder="FR XX XXX XXX XXX" flex={2} />
                        </div>
                        <div style={{ display: "flex", gap: 16 }}>
                          <Field2 label="RCS" k="rcs" placeholder="RCS Paris B XXX XXX XXX" flex={2} />
                          <Field2 label="Code APE / NAF" k="apeCode" placeholder="7021Z" />
                        </div>
                      </div>
                    )}
                    {activeNav.id === "contact" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <Field2 label="Adresse" k="address" placeholder="Rue et numéro" />
                        <div style={{ display: "flex", gap: 16 }}>
                          <Field2 label="Code postal" k="postalCode" placeholder="75000" />
                          <Field2 label="Ville" k="city" placeholder="Paris" flex={2} />
                          <Field2 label="Pays" k="country" placeholder="France" flex={2} />
                        </div>
                        <div style={{ display: "flex", gap: 16 }}>
                          <Field2 label="Téléphone" k="phone" placeholder="+33 6 XX XX XX XX" />
                          <Field2 label="Email contact" k="email" placeholder="contact@lesgriots.fr" type="email" />
                        </div>
                        <Field2 label="Site web" k="website" placeholder="https://lesgriots.studio" />
                      </div>
                    )}
                    {activeNav.id === "bank" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <Field2 label="Banque" k="bankName" placeholder="Nom de la banque" />
                        <Field2 label="IBAN" k="iban" placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX" />
                        <Field2 label="BIC / SWIFT" k="bic" placeholder="XXXXXXXX" />
                      </div>
                    )}
                    {activeNav.id === "legal2" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <Field2 label="Conditions de paiement" k="paymentTerms" placeholder="30 jours à réception de facture" />
                        <Field2 label="Pénalités de retard" k="latePaymentNote" placeholder="Pénalités au taux légal en vigueur + 40€ forfait" />
                        <Field2 label="Mention TVA" k="tvaNote" placeholder="TVA non applicable — art. 293B du CGI" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ═══ MODALS ═══ */}

      {/* New Team Member */}
      {modal === "newTeam" && (
        <Modal title="Ajouter un membre" onClose={() => setModal(null)}>
          <Field label="Nom" value={teamForm.name} onChange={v => setTeamForm(f => ({ ...f, name: v }))} required />
          <Field label="Rôle" value={teamForm.role} onChange={v => setTeamForm(f => ({ ...f, role: v }))} placeholder="Réalisateur, Monteur, DA..." />
          <Field label="Type" value={teamForm.type || "freelance"} onChange={v => setTeamForm(f => ({ ...f, type: v }))} options={[{ value: "freelance", label: "Freelance" }, { value: "internal", label: "Interne" }]} />
          <Field label="Email" value={teamForm.email} onChange={v => setTeamForm(f => ({ ...f, email: v }))} type="email" />
          <Field label="Téléphone" value={teamForm.phone} onChange={v => setTeamForm(f => ({ ...f, phone: v }))} />
          <Field label="Lier à un prestataire" value={teamForm.providerId || ""} onChange={v => setTeamForm(f => ({ ...f, providerId: v }))} options={[{ value: "", label: "Aucun" }, ...data.providers.map(p => ({ value: p.id, label: p.name }))]} />
          <button onClick={addTeamMember} disabled={!teamForm.name || saving} style={{
            width: "100%", padding: "12px", background: (teamForm.name && !saving) ? "var(--gold)" : "var(--surface-3)",
            color: (teamForm.name && !saving) ? "var(--gold-ink)" : "var(--text-3)", border: "none", borderRadius: 8,
            fontWeight: 700, fontSize: 15, cursor: (teamForm.name && !saving) ? "pointer" : "not-allowed", fontFamily: "inherit", marginTop: 8,
          }}>{saving ? 'Enregistrement…' : 'Ajouter'}</button>
        </Modal>
      )}

      {/* Edit Team Member */}
      {typeof modal === "string" && modal.startsWith("editTeam:") && (() => {
        const tmId = modal.split(":")[1];
        return (
          <Modal title="Modifier le membre" onClose={() => setModal(null)}>
            <Field label="Nom" value={teamForm.name} onChange={v => setTeamForm(f => ({ ...f, name: v }))} required />
            <Field label="Rôle" value={teamForm.role} onChange={v => setTeamForm(f => ({ ...f, role: v }))} />
            <Field label="Type" value={teamForm.type || "freelance"} onChange={v => setTeamForm(f => ({ ...f, type: v }))} options={[{ value: "freelance", label: "Freelance" }, { value: "internal", label: "Interne" }]} />
            <Field label="Email" value={teamForm.email} onChange={v => setTeamForm(f => ({ ...f, email: v }))} type="email" />
            <Field label="Téléphone" value={teamForm.phone} onChange={v => setTeamForm(f => ({ ...f, phone: v }))} />
            <Field label="Lier à un prestataire" value={teamForm.providerId || ""} onChange={v => setTeamForm(f => ({ ...f, providerId: v }))} options={[{ value: "", label: "Aucun" }, ...data.providers.map(p => ({ value: p.id, label: p.name }))]} />
            <button onClick={async () => { const ok = await updateTeamMember(tmId, teamForm); if (ok) { setFormDirty(false); setModal(null); setTeamForm({}); } }} disabled={!teamForm.name || saving} style={{
              width: "100%", padding: "12px", background: (teamForm.name && !saving) ? "var(--gold)" : "var(--surface-3)",
              color: (teamForm.name && !saving) ? "var(--gold-ink)" : "var(--text-3)", border: "none", borderRadius: 8,
              fontWeight: 700, fontSize: 15, cursor: (teamForm.name && !saving) ? "pointer" : "not-allowed", fontFamily: "inherit", marginTop: 8,
            }}>{saving ? 'Enregistrement…' : 'Sauvegarder'}</button>
          </Modal>
        );
      })()}

      {/* PDF Preview Modal */}
      {pdfPreview && (
        <div onClick={() => setPdfPreview(null)} style={{
          position: "fixed", inset: 0, zIndex: 99999, background: "var(--overlay)",
          backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "min(900px, 92vw)", height: "min(85vh, 900px)", background: "var(--bg)", borderRadius: 14,
            border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>📄</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{pdfPreview.title}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => {
                  const a = document.createElement('a');
                  a.href = pdfPreview.url; a.download = ''; a.click();
                }} style={{
                  padding: "6px 14px", background: "var(--success-soft)", border: "1px solid var(--success)",
                  borderRadius: 6, color: "var(--success)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}>⬇ Télécharger</button>
                <button onClick={() => window.open(pdfPreview.url, '_blank')} style={{
                  padding: "6px 14px", background: "var(--info-soft)", border: "1px solid var(--info)",
                  borderRadius: 6, color: "var(--info)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}>↗ Nouvel onglet</button>
                <button onClick={() => setPdfPreview(null)} style={{
                  padding: "6px 14px", background: "var(--surface-3)", border: "1px solid var(--border-2)",
                  borderRadius: 6, color: "var(--text-3)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}>✕</button>
              </div>
            </div>
            {/* PDF embed */}
            <object
              data={pdfPreview.url}
              type="application/pdf"
              style={{ flex: 1, border: "none", background: "var(--surface)", borderRadius: "0 0 14px 14px", width: "100%" }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, background: "var(--surface)" }}>
                <span style={{ fontSize: 48 }}>📄</span>
                <p style={{ color: "var(--text-3)", fontSize: 14 }}>Impossible d'afficher le PDF dans le navigateur.</p>
                <button onClick={() => window.open(pdfPreview.url, '_blank')} style={{
                  padding: "10px 24px", background: "var(--gold)", color: "var(--gold-ink)", border: "none",
                  borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer",
                }}>Ouvrir le PDF</button>
              </div>
            </object>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--overlay)", backdropFilter: "blur(6px)",
        }} onClick={() => setDeleteConfirm(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
            padding: "32px 36px", maxWidth: 420, width: "90%",
            boxShadow: "var(--shadow-lg)",
          }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--danger-soft)", border: "1px solid var(--danger-soft)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24 }}>🗑</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Supprimer {deleteConfirm.isTask ? "cette tâche" : "ce projet"} ?</div>
              <div style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.5 }}>
                <span style={{ color: "var(--gold)", fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>{deleteConfirm.code}</span>
                {" — "}{deleteConfirm.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 10, padding: "6px 12px", background: "var(--danger-soft)", borderRadius: 6, display: "inline-block" }}>
                Cette action est irréversible
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{
                flex: 1, padding: "12px 16px", background: "var(--surface-3)", border: "1px solid var(--border)", borderRadius: 10,
                color: "var(--text-2)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                transition: "background 0.15s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface-3)"}
                onMouseLeave={e => e.currentTarget.style.background = "var(--surface-3)"}
              >Annuler</button>
              <button onClick={async () => {
                try {
                  if (deleteConfirm.isTask) {
                    await fetch(`/api/tasks/${deleteConfirm.id}`, { method: 'DELETE' });
                    setData(prev => ({
                      ...prev,
                      projects: prev.projects.map(p => ({
                        ...p,
                        tasks: (p.tasks || []).filter(t => t.id !== deleteConfirm.id),
                      })),
                    }));
                  } else {
                    await fetch(`/api/projects/${deleteConfirm.id}`, { method: 'DELETE' });
                    const fresh = await fetch('/api/data').then(r => r.json());
                    setData(fresh);
                    if (selProject?.id === deleteConfirm.id) setSelProject(null);
                  }
                } catch (err) { console.error('Erreur suppression:', err); }
                setDeleteConfirm(null);
              }} style={{
                flex: 1, padding: "12px 16px", background: "var(--danger)", border: "none", borderRadius: 10,
                color: "var(--on-solid)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                transition: "background 0.15s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--danger)"}
                onMouseLeave={e => e.currentTarget.style.background = "var(--danger)"}
              >Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* New Project Template Selection */}
      {modal === "newProject" && (
        <Modal title="Créer un projet" onClose={() => setModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {PROJECT_TEMPLATES.map(t => (
              <button key={t.key} onClick={() => addProject(t)} style={{
                padding: "16px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8,
                textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "var(--text)",
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: "var(--gold)" }}>{t.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 6 }}>{t.notes}</div>
                <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
                  <Badge label={PILLAR_MAP[t.pillar]?.label} color={PILLAR_MAP[t.pillar]?.color} />
                  {t.priceRange && <Badge label={`${t.priceRange[0]}-${t.priceRange[1]}€`} color="var(--gold)" />}
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Edit Project */}
      {typeof modal === "string" && modal.startsWith("editProject:") && (() => {
        const pid = modal.split(":")[1];
        return (
          <Modal title="Modifier le projet" onClose={guardedCloseModal}>
            <Field label="Nom du projet" value={pf.name} onChange={v => upf("name", v)} required />
            <Field label="Étape pipeline" value={pf.stage} onChange={v => upf("stage", v)} options={PIPELINE_STAGES.map(s => ({ value: s.key, label: `${s.icon} ${s.label}` }))} />
            {/* Client selector */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Client</div>
              {/* Linked client from clients DB */}
              <Field label="Lier à un client du répertoire" value={pf.clientId || ""} onChange={v => {
                const linked = (data.clients || []).find(c => c.id === v);
                if (linked) {
                  upf("clientId", v);
                  upf("clientFirstName", linked.firstName);
                  upf("clientLastName", linked.lastName);
                  upf("client", linked.company);
                  upf("clientEmail", linked.email);
                  upf("clientPhone", linked.phone);
                  upf("clientAddress", [linked.address, linked.postalCode, linked.city].filter(Boolean).join(', '));
                } else {
                  upf("clientId", "");
                }
              }} options={[
                { value: "", label: "— Aucun client lié —" },
                ...(data.clients || []).filter(c => !c.pillar || c.pillar === 'AGENCE' || c.pillar === 'BOTH').map(c => ({
                  value: c.id,
                  label: c.company ? (fmtFullName(c.firstName, c.lastName) ? `${c.company} · ${fmtFullName(c.firstName, c.lastName)}` : c.company) : (fmtFullName(c.firstName, c.lastName) || c.id),
                }))
              ]} />
              {/* Manual fields — always editable even when client is linked */}
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}><Field label="Prénom" value={pf.clientFirstName || ''} onChange={v => upf("clientFirstName", v)} placeholder="Prénom" /></div>
                <div style={{ flex: 1 }}><Field label="NOM" value={pf.clientLastName || ''} onChange={v => upf("clientLastName", v)} placeholder="NOM" /></div>
                <div style={{ flex: 2 }}><Field label="Structure / Organisation" value={pf.client || ''} onChange={v => upf("client", v)} placeholder="Nom de la structure" /></div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}><Field label="Email" value={pf.clientEmail || ''} onChange={v => upf("clientEmail", v)} type="email" /></div>
                <div style={{ flex: 1 }}><Field label="Téléphone" value={pf.clientPhone || ''} onChange={v => upf("clientPhone", v)} /></div>
              </div>
              <Field label="Adresse facturation" value={pf.clientAddress || ''} onChange={v => upf("clientAddress", v)} type="textarea" />
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Contact facturation (si différent)</div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}><Field label="Prénom contact" value={pf.clientContactFirstName || ''} onChange={v => upf("clientContactFirstName", v)} placeholder="Prénom" /></div>
                <div style={{ flex: 1 }}><Field label="NOM contact" value={pf.clientContactLastName || ''} onChange={v => upf("clientContactLastName", v)} placeholder="NOM" /></div>
              </div>
            </div>
            <Field label="Conditions de paiement" value={pf.paymentTerms || ""} onChange={v => upf("paymentTerms", v)}
              options={[
                { value: "", label: `Défaut (${settings.paymentTerms || "30j à réception"})` },
                { value: "Comptant", label: "Comptant — à la commande" },
                { value: "30% à la commande, 70% à la livraison", label: "30% commande · 70% livraison" },
                { value: "50% à la commande, 50% à la livraison", label: "50% commande · 50% livraison" },
                { value: "30 jours à réception de facture", label: "30 jours à réception" },
                { value: "45 jours à réception de facture", label: "45 jours à réception" },
                { value: "60 jours à réception de facture", label: "60 jours à réception" },
                { value: "30 jours fin de mois", label: "30 jours fin de mois" },
                { value: "Sur devis spécifique", label: "Sur devis spécifique" },
              ]}
            />
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}><Field label="Budget dépenses (€)" value={pf.budget} onChange={v => upf("budget", v)} type="number" /></div>
              <div style={{ flex: 2 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}><Field label="Revenu facturé HT (€)" value={pf.revenue} onChange={v => upf("revenue", v)} type="number" /></div>
                  <div style={{ flex: 1 }}><Field label="Taux TVA" value={pf.tvaRate || '20'} onChange={v => upf("tvaRate", v)} options={TVA_RATES.map(t => ({ value: t.key, label: t.label }))} /></div>
                </div>
                {pf.revenue > 0 && (pf.tvaRate || '20') !== '0' && (
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                    TTC : {computeTTC(parseFloat(pf.revenue || 0), pf.tvaRate || '20').toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}><Field label="Heures passées" value={pf.hoursSpent} onChange={v => upf("hoursSpent", v)} type="number" placeholder="0" /></div>
              <div style={{ flex: 1, display: "flex", alignItems: "flex-end", paddingBottom: 16 }}>
                <div style={{ fontSize: 13, color: pf.hoursSpent > 0 && pf.revenue > 0 ? ((pf.revenue / pf.hoursSpent) < 50 ? "var(--danger)" : "var(--success)") : "var(--text-3)" }}>
                  EHR : {pf.hoursSpent > 0 && pf.revenue > 0 ? `${(pf.revenue / pf.hoursSpent).toFixed(0)}€/h` : "—"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}><Field label="Date de début" value={pf.startDate} onChange={v => upf("startDate", v)} type="date" /></div>
              <div style={{ flex: 1 }}><Field label="Date de fin" value={pf.endDate} onChange={v => upf("endDate", v)} type="date" /></div>
            </div>
            <Field label="Notes" value={pf.notes} onChange={v => upf("notes", v)} type="textarea" />
            <button onClick={() => saveEditProject(pid)} disabled={!pf.name || saving} style={{
              width: "100%", padding: "12px", background: (pf.name && !saving) ? "var(--gold)" : "var(--surface-3)",
              color: (pf.name && !saving) ? "var(--gold-ink)" : "var(--text-3)", border: "none", borderRadius: 8,
              fontWeight: 700, fontSize: 15, cursor: (pf.name && !saving) ? "pointer" : "not-allowed", fontFamily: "inherit", marginTop: 8,
            }}>{saving ? 'Enregistrement…' : 'Sauvegarder'}</button>
          </Modal>
        );
      })()}

      {/* New Expense */}
      {typeof modal === "string" && modal.startsWith("newExpense:") && (() => {
        const pid = modal.split(":")[1];
        const proj = data.projects.find(p => p.id === pid);
        const typicals = proj?.typicalExpenses || [];
        return (
          <Modal title="Nouvelle dépense" onClose={guardedCloseModal}>
            {/* Provider selector */}
            {(data.providers || []).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", color: "var(--text-3)", fontSize: 12, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Prestataire enregistré</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(data.providers || []).map(prov => (
                    <button key={prov.id} onClick={() => selectProviderForExpense(prov.id)} style={{
                      padding: "6px 12px", borderRadius: 6, fontSize: 12, fontFamily: "inherit", cursor: "pointer",
                      background: ef.providerId === prov.id ? "var(--gold-soft)" : "var(--bg)",
                      border: `1px solid ${ef.providerId === prov.id ? "var(--gold)" : "var(--border)"}`,
                      color: ef.providerId === prov.id ? "var(--gold)" : "var(--text-3)",
                    }}>
                      {prov.firstName || prov.lastName ? `${fmtP(prov.firstName)} ${fmtN(prov.lastName)}`.trim() : fmtP(prov.name)}
                      {prov.company && <span style={{ color: "var(--text-3)" }}> · {prov.company}</span>}
                      {prov.tarifJour > 0 && <span style={{ color: "var(--text-3)" }}> · {prov.tarifJour}€ HT/j</span>}
                    </button>
                  ))}
                  {ef.providerId && <button onClick={() => selectProviderForExpense("")} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12, fontFamily: "inherit", cursor: "pointer", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--danger)" }}>✕ Retirer</button>}
                </div>
              </div>
            )}
            {typicals.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", color: "var(--text-3)", fontSize: 12, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Catégories suggérées</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {typicals.map(cat => (
                    <button key={cat} onClick={() => uef("category", cat)} style={{
                      padding: "5px 12px", borderRadius: 6, fontSize: 12, fontFamily: "inherit", cursor: "pointer",
                      background: ef.category === cat ? "var(--gold-soft)" : "var(--bg)",
                      border: `1px solid ${ef.category === cat ? "var(--gold)" : "var(--border)"}`,
                      color: ef.category === cat ? "var(--gold)" : "var(--text-3)",
                    }}>{cat}</button>
                  ))}
                </div>
              </div>
            )}
            <Field label="Désignation" value={ef.label} onChange={v => uef("label", v)} placeholder="Ex: Montage final" required />
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}><Field label="Montant HT (€)" value={ef.amountHT} onChange={v => uef("amountHT", v)} type="number" placeholder="0" required /></div>
              <div style={{ flex: 1 }}>
                <Field label="Taux TVA" value={ef.tvaRate} onChange={v => uef("tvaRate", v)} options={TVA_RATES.map(t => ({ value: t.key, label: t.label }))} />
              </div>
            </div>
            {ef.amountHT && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 16, fontSize: 13 }}>
                <span style={{ color: "var(--text-3)" }}>HT: <strong style={{ color: "var(--text)" }}>{parseFloat(ef.amountHT || 0).toFixed(2)}€</strong></span>
                <span style={{ color: "var(--text-3)" }}>TVA: <strong style={{ color: "var(--text)" }}>{(parseFloat(ef.amountHT || 0) * (TVA_MAP[ef.tvaRate]?.rate || 0)).toFixed(2)}€</strong></span>
                <span style={{ color: "var(--gold)" }}>TTC: <strong>{(parseFloat(ef.amountHT || 0) * (1 + (TVA_MAP[ef.tvaRate]?.rate || 0))).toFixed(2)}€</strong></span>
              </div>
            )}
            <Field label="Catégorie" value={ef.category} onChange={v => uef("category", v)} options={EXPENSE_CATEGORIES} />
            {!ef.providerId && <Field label="Prestataire (libre)" value={ef.provider} onChange={v => uef("provider", v)} placeholder="Nom du prestataire" />}
            <Field label="Date" value={ef.date} onChange={v => uef("date", v)} type="date" />
            <Field label="Statut" value={ef.status} onChange={v => uef("status", v)} options={[
              { value: "pending", label: "En attente" }, { value: "paid", label: "Payé" }, { value: "overdue", label: "En retard" },
            ]} />
            <Field label="Notes" value={ef.notes} onChange={v => uef("notes", v)} type="textarea" placeholder="Détails..." />
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 16 }}>
              <input type="checkbox" checked={ef.generateBDC} onChange={e => uef("generateBDC", e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--gold)" }} />
              <span style={{ fontSize: 14, color: "var(--text-2)" }}>Générer un bon de commande (BDC)</span>
            </label>
            <button onClick={() => addExpense(pid)} disabled={!ef.label || !ef.amountHT || saving} style={{
              width: "100%", padding: "12px", background: (ef.label && ef.amountHT && !saving) ? "var(--gold)" : "var(--surface-3)",
              color: (ef.label && ef.amountHT && !saving) ? "var(--gold-ink)" : "var(--text-3)", border: "none", borderRadius: 8,
              fontWeight: 700, fontSize: 15, cursor: (ef.label && ef.amountHT && !saving) ? "pointer" : "not-allowed", fontFamily: "inherit", marginTop: 8,
            }}>{saving ? 'Enregistrement…' : 'Ajouter la dépense'}</button>
          </Modal>
        );
      })()}

      {/* New IP Revenue */}
      {typeof modal === "string" && modal.startsWith("newIpRevenue:") && (() => {
        const pid = modal.split(":")[1];
        return (
          <Modal title="Nouveau revenu IP" onClose={guardedCloseModal}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", color: "var(--text-3)", fontSize: 12, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Source de revenu</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {IP_REVENUE_SOURCES.map(src => (
                  <button key={src} onClick={() => uir("source", src)} style={{
                    padding: "6px 14px", borderRadius: 6, fontSize: 12, fontFamily: "inherit", cursor: "pointer",
                    background: ir.source === src ? "var(--success-soft)" : "var(--bg)",
                    border: `1px solid ${ir.source === src ? "var(--success)" : "var(--border)"}`,
                    color: ir.source === src ? "var(--success)" : "var(--text-3)",
                  }}>{src}</button>
                ))}
              </div>
            </div>
            <Field label="Description" value={ir.label} onChange={v => uir("label", v)} placeholder="Ex: Vente droits diffusion Arte" required />
            <Field label="Montant (€)" value={ir.amount} onChange={v => uir("amount", v)} type="number" placeholder="0" required />
            <Field label="Date" value={ir.date} onChange={v => uir("date", v)} type="date" />
            <Field label="Notes" value={ir.notes} onChange={v => uir("notes", v)} type="textarea" placeholder="Détails du contrat, conditions..." />
            <button onClick={() => addIpRevenue(pid)} disabled={!ir.label || !ir.amount || saving} style={{
              width: "100%", padding: "12px", background: (ir.label && ir.amount && !saving) ? "var(--success)" : "var(--surface-3)",
              color: (ir.label && ir.amount && !saving) ? "var(--on-solid)" : "var(--text-3)", border: "none", borderRadius: 8,
              fontWeight: 700, fontSize: 15, cursor: (ir.label && ir.amount && !saving) ? "pointer" : "not-allowed", fontFamily: "inherit", marginTop: 8,
            }}>{saving ? 'Enregistrement…' : 'Ajouter le revenu'}</button>
          </Modal>
        );
      })()}

      {/* New Provider */}
      {modal === "newProvider" && (
        <Modal title="Nouveau prestataire" onClose={guardedCloseModal}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><Field label="Prénom *" value={provForm.firstName || ''} onChange={v => uprov("firstName", v)} placeholder="Karim" required /></div>
            <div style={{ flex: 1 }}><Field label="NOM *" value={provForm.lastName || ''} onChange={v => uprov("lastName", v)} placeholder="TOURÉ" /></div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><Field label="Société (si applicable)" value={provForm.company || ''} onChange={v => uprov("company", v)} placeholder="Ex: Studio K" /></div>
          </div>
          <MultiCategorySelect selected={provForm.categories || []} onChange={v => uprov("categories", v)} options={allProvCats} onAddCustom={addCustomProvCat} />
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", color: "var(--text-3)", fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Note</label>
            <StarRating value={provForm.rating || 0} onChange={v => uprov("rating", v)} size={22} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", color: "var(--text-3)", fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Fourchette TJM (€ HT)</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="number" value={provForm.tarifMin || ''} onChange={e => uprov("tarifMin", e.target.value)} placeholder="Min" style={{ flex: 1, padding: "8px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", fontSize: 13, fontFamily: "inherit" }} />
              <span style={{ color: "var(--text-3)", fontSize: 16, fontWeight: 700 }}>–</span>
              <input type="number" value={provForm.tarifMax || ''} onChange={e => uprov("tarifMax", e.target.value)} placeholder="Max (optionnel)" style={{ flex: 1, padding: "8px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", fontSize: 13, fontFamily: "inherit" }} />
              <Field label="" value={provForm.tvaRate} onChange={v => uprov("tvaRate", v)} options={TVA_RATES.map(t => ({ value: t.key, label: t.label }))} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><Field label="Email" value={provForm.email} onChange={v => uprov("email", v)} placeholder="karim@studio.com" type="email" /></div>
            <div style={{ flex: 1 }}><Field label="Téléphone" value={provForm.phone || ''} onChange={v => uprov("phone", v)} placeholder="+33 6 XX XX XX XX" /></div>
          </div>
          <Field label="SIRET" value={provForm.siret} onChange={v => uprov("siret", v)} placeholder="123 456 789 00012" />
          <button onClick={addProvider} disabled={!(provForm.firstName || provForm.lastName) || saving} style={{
            width: "100%", padding: "12px", background: ((provForm.firstName || provForm.lastName) && !saving) ? "var(--gold)" : "var(--surface-3)",
            color: ((provForm.firstName || provForm.lastName) && !saving) ? "var(--gold-ink)" : "var(--text-3)", border: "none", borderRadius: 8,
            fontWeight: 700, fontSize: 15, cursor: ((provForm.firstName || provForm.lastName) && !saving) ? "pointer" : "not-allowed", fontFamily: "inherit", marginTop: 8,
          }}>{saving ? 'Enregistrement…' : 'Ajouter le prestataire'}</button>
        </Modal>
      )}

      {/* Edit Provider */}
      {typeof modal === "string" && modal.startsWith("editProvider:") && (() => {
        const provId = modal.split(":")[1];
        return (
          <Modal title="Modifier le prestataire" onClose={guardedCloseModal}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}><Field label="Prénom *" value={provForm.firstName || ''} onChange={v => uprov("firstName", v)} required /></div>
              <div style={{ flex: 1 }}><Field label="NOM *" value={provForm.lastName || ''} onChange={v => uprov("lastName", v)} /></div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}><Field label="Société (si applicable)" value={provForm.company || ''} onChange={v => uprov("company", v)} placeholder="Ex: Studio K" /></div>
            </div>
            <MultiCategorySelect selected={provForm.categories || []} onChange={v => uprov("categories", v)} options={allProvCats} onAddCustom={addCustomProvCat} />
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", color: "var(--text-3)", fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Note</label>
              <StarRating value={provForm.rating || 0} onChange={v => uprov("rating", v)} size={22} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", color: "var(--text-3)", fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Fourchette TJM (€ HT)</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="number" value={provForm.tarifMin || ''} onChange={e => uprov("tarifMin", e.target.value)} placeholder="Min" style={{ flex: 1, padding: "8px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", fontSize: 13, fontFamily: "inherit" }} />
                <span style={{ color: "var(--text-3)", fontSize: 16, fontWeight: 700 }}>–</span>
                <input type="number" value={provForm.tarifMax || ''} onChange={e => uprov("tarifMax", e.target.value)} placeholder="Max (optionnel)" style={{ flex: 1, padding: "8px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", fontSize: 13, fontFamily: "inherit" }} />
                <Field label="" value={provForm.tvaRate} onChange={v => uprov("tvaRate", v)} options={TVA_RATES.map(t => ({ value: t.key, label: t.label }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}><Field label="Email" value={provForm.email} onChange={v => uprov("email", v)} type="email" /></div>
              <div style={{ flex: 1 }}><Field label="Téléphone" value={provForm.phone || ''} onChange={v => uprov("phone", v)} placeholder="+33 6 XX XX XX XX" /></div>
            </div>
            <Field label="SIRET" value={provForm.siret} onChange={v => uprov("siret", v)} placeholder="123 456 789 00012" />
            <button onClick={() => saveEditProvider(provId)} disabled={!(provForm.firstName || provForm.lastName || provForm.name) || saving} style={{
              width: "100%", padding: "12px", background: ((provForm.firstName || provForm.lastName || provForm.name) && !saving) ? "var(--gold)" : "var(--surface-3)",
              color: ((provForm.firstName || provForm.lastName || provForm.name) && !saving) ? "var(--gold-ink)" : "var(--text-3)", border: "none", borderRadius: 8,
              fontWeight: 700, fontSize: 15, cursor: ((provForm.firstName || provForm.lastName || provForm.name) && !saving) ? "pointer" : "not-allowed", fontFamily: "inherit", marginTop: 8,
            }}>{saving ? 'Enregistrement…' : 'Sauvegarder'}</button>
          </Modal>
        );
      })()}

      {/* WELCOME EMAIL MODALS */}
      {welcomeEmailModal && selProject && (() => {
        // Prénom pour salutation : priorité client lié, puis champs inline, puis fallback
        const _linkedCli = projectClient(selProject);
        const clientFirstName = fmtP(_linkedCli?.firstName || selProject.clientFirstName || selProject.clientContactFirstName) || '[Prénom client]';
        // Nom complet pour les références formelles
        const clientName = fmtFullName(_linkedCli?.firstName || selProject.clientFirstName, _linkedCli?.lastName || selProject.clientLastName)
          || fmtFullName(selProject.clientContactFirstName, selProject.clientContactLastName)
          || selProject.clientContact || selProject.client || '[Nom client]';
        const bizName = settings?.companyName || 'LES GRIOTS';
        const phone = settings?.phone || '[numéro de téléphone]';
        const email = settings?.email || '[email]';
        const projectName = selProject.name || '[projet]';

        const welcomeSubject = `Bienvenue dans la famille ${bizName} !`;
        const welcomeBody = `Bonjour ${clientFirstName} !

Bienvenue dans la famille ${bizName} ! Merci de nous avoir confié ce projet. Je suis très enthousiaste à l'idée de travailler avec vous sur ${projectName}.

Avant de démarrer, je voulais m'assurer que vous sachiez que vous pouvez me joindre à tout moment pendant les heures de bureau, par email (${email}) ou par téléphone (${phone}). Je serai ravi·e de répondre à toutes vos questions au fil du projet.

La première chose importante est de planifier notre session de discovery ensemble. Ce sera une réunion d'environ 1h30 pour aligner notre compréhension de vos besoins et objectifs. J'aimerais qu'on puisse se retrouver dans les deux prochaines semaines — je vous propose ces créneaux :
• [Option 1 : date et heure]
• [Option 2 : date et heure]
L'une de ces options vous convient-elle ?

Je vous enverrai ensuite un email de suivi pour vous intégrer à chaque aspect de notre process — restez connecté·e !

Comme convenu, voici un exemplaire contresigné du contrat : [lien ou pièce jointe].

Encore une fois, bienvenue dans la famille — très excité·e pour l'aventure qui nous attend !

Bien à vous,
${bizName}`;

        const followupSubject = `Premiers pas & prochaines étapes (action requise) — ${projectName}`;
        const followupBody = `Bonjour ${clientFirstName} !

Merci encore de nous avoir confié ce projet — très impatient·e de démarrer !

Cet email a pour but de fluidifier votre intégration dans la famille ${bizName} et de vous donner des premières actions concrètes. Pardonnez le format liste : c'est uniquement pour la clarté.

1. Informations de facturation
Je vous enverrai une facture dans les 24 prochaines heures pour l'acompte initial de 50 % tel que détaillé dans le contrat signé. Êtes-vous le bon point de contact pour cela ? Ou dois-je coordonner avec quelqu'un d'autre dans votre équipe ?
Par ailleurs, avez-vous besoin d'un numéro de bon de commande sur vos factures ?

2. Transfert des assets existants
Au cours du projet, nous aurons probablement besoin d'éléments de votre côté (logos, photos, vidéos, documents de marque...). Pour faciliter ce transfert, vous pouvez nous les envoyer via [lien de partage Drive/Dropbox]. Nous vous enverrons également une invitation séparée sous peu.

3. Accès au planning de projet
Si vous avez des questions sur où nous en sommes dans le process, nous avons mis en place un planning de production. Vous pouvez y accéder ici : [lien planning]. Si quoi que ce soit impacte des délais importants, nous vous préviendrons directement par email.

4. Règles de collaboration
Voici comment nous travaillons ensemble — processus, délais de feedback, et nos engagements mutuels : [lien règles d'engagement / charte projet].

Si vous avez la moindre question, n'hésitez pas ! Merci pour cette opportunité et impatient·e de travailler ensemble.

Bien à vous,
${bizName}`;

        const body = welcomeEmailModal === 'welcome' ? welcomeBody : followupBody;
        const subject = welcomeEmailModal === 'welcome' ? welcomeSubject : followupSubject;
        const title = welcomeEmailModal === 'welcome' ? '✉ Welcome Aboard Email' : '✉ Welcome Follow-Up Email';

        return (
          <Modal title={title} onClose={() => setWelcomeEmailModal(null)}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Objet</div>
              <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--gold)", fontWeight: 600 }}>{subject}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Corps de l'email</div>
              <textarea readOnly value={body} style={{
                width: "100%", minHeight: 320, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8,
                padding: "14px", fontSize: 13, color: "var(--text-2)", fontFamily: "'Geist Sans', 'DM Sans', sans-serif",
                lineHeight: 1.7, resize: "vertical", boxSizing: "border-box", outline: "none",
              }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { navigator.clipboard.writeText(`Objet : ${subject}\n\n${body}`); }} style={{
                flex: 1, padding: "12px", background: "var(--gold-soft)", border: "1px solid var(--gold)",
                borderRadius: 8, color: "var(--gold)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>
                📋 Copier l'email complet
              </button>
              {welcomeEmailModal === 'welcome' && (
                <button onClick={() => setWelcomeEmailModal('followup')} style={{
                  flex: 1, padding: "12px", background: "var(--info-soft)", border: "1px solid var(--info-soft)",
                  borderRadius: 8, color: "var(--info)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}>
                  → Follow-Up
                </button>
              )}
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-3)", lineHeight: 1.6 }}>
              Les champs entre [crochets] sont à personnaliser avant l'envoi. Remplis tes infos société dans Paramètres pour les pré-remplir automatiquement.
            </div>
          </Modal>
        );
      })()}

      {/* ── COMMAND PALETTE ── */}
      <CommandPalette
        open={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        projects={data.projects || []}
        clients={data.clients || []}
        providers={data.providers || []}
        onNavigate={handleCmdNavigate}
      />

      {/* ── BANDEAU AUTO-REFRESH EN ÉCHEC ── */}
      {offline && !loading && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9998,
          padding: '8px 16px', borderRadius: 8, background: 'var(--gold-soft)', border: '1px solid var(--gold)',
          color: 'var(--gold)', fontSize: 12, fontWeight: 500, fontFamily: "'Geist Sans', 'DM Sans', sans-serif",
          boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--gold)', display: 'inline-block' }} />
          Données non actualisées — reconnexion…
        </div>
      )}

      {/* ── BANDEAU ERREUR DE CHARGEMENT INITIAL ── */}
      {loadError && (
        <div style={{ position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9998,
          padding: '12px 18px', borderRadius: 8, background: 'var(--danger-soft)', border: '1px solid var(--danger)',
          color: 'var(--danger)', fontSize: 13, fontFamily: "'Geist Sans', 'DM Sans', sans-serif",
          boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <span>✕ Impossible de charger les données.</span>
          <button onClick={() => { setLoading(true); loadInitialData(); }} style={{
            padding: '5px 12px', background: 'var(--danger)', color: 'var(--on-solid)', border: 'none', borderRadius: 6,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>Réessayer</button>
        </div>
      )}

      {/* ── TOAST NOTIFICATION ── */}
      {toast && (
        <div key={toast.id} style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, padding: '12px 20px', borderRadius: 8,
          background: toast.type === 'error' ? 'var(--danger)' : toast.type === 'warning' ? 'var(--gold)' : 'var(--success)',
          color: toast.type === 'warning' ? 'var(--gold-ink)' : 'var(--on-solid)',
          fontSize: 13, fontWeight: 500, fontFamily: "'Geist Sans', 'DM Sans', sans-serif",
          boxShadow: 'var(--shadow-md)', maxWidth: 360,
          transition: 'opacity 0.3s ease-out',
        }}>
          {toast.type === 'error' ? '✕ ' : toast.type === 'warning' ? '⚠ ' : '✓ '}{toast.message}
        </div>
      )}
      </div>{/* end MAIN CONTENT */}
    </div>
  );
}

