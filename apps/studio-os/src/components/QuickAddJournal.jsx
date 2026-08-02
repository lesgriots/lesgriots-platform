'use client';
/**
 * QuickAddJournal — modale globale ⌘J pour ajouter une entrée au journal d'un projet.
 *
 * - Ouvre/ferme avec Cmd/Ctrl+J ou Esc
 * - Charge la liste des projets (filtre stage actif)
 * - 5 types : email / call / meeting / note / milestone
 * - Toast confirmation, ferme automatiquement après succès
 * - Persiste le dernier projet sélectionné en localStorage pour gagner du temps
 */
import { useEffect, useRef, useState } from 'react';
import { useToast, Button, Badge } from '@/components/ui';

const TYPES = [
  { key: 'note',      label: 'Note',     icon: '✎' },
  { key: 'email',     label: 'Email',    icon: '✉' },
  { key: 'call',      label: 'Appel',    icon: '☎' },
  { key: 'meeting',   label: 'Meeting',  icon: '⌘' },
  { key: 'milestone', label: 'Milestone', icon: '✦' },
];

const PILLAR_TONE = {
  STUDIO: 'info', PROD: 'pillar', GRIOTHEQUE: 'gold',
};

const STORAGE_KEY = 'lg-quickadd-last-project';

export default function QuickAddJournal() {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [type, setType] = useState('note');
  const [content, setContent] = useState('');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);
  const { toast } = useToast();

  // Raccourci ⌘J / Ctrl+J global
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape' && open) {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Charge les projets à la première ouverture
  useEffect(() => {
    if (!open || projects.length) return;
    fetch('/api/data')
      .then(r => r.json())
      .then(data => {
        const list = (data.projects || [])
          .filter(p => !['paid', 'lost'].includes(p.stage))
          .sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        setProjects(list);
        // Restore last
        const last = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        if (last && list.some(p => p.id === last)) setProjectId(last);
        else if (list.length) setProjectId(list[0].id);
      })
      .catch(() => toast.error('Impossible de charger les projets'));
  }, [open, projects.length, toast]);

  // Focus le textarea quand on ouvre
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    if (!open) {
      setContent('');
      setSearch('');
    }
  }, [open]);

  const filtered = search
    ? projects.filter(p => {
        const q = search.toLowerCase();
        return (p.code || '').toLowerCase().includes(q)
          || (p.name || '').toLowerCase().includes(q);
      })
    : projects;

  const submit = async () => {
    if (!projectId || !content.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/journal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content: content.trim() }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const project = projects.find(p => p.id === projectId);
      toast.success(`Entrée ajoutée — ${project?.code || 'projet'}`);
      localStorage.setItem(STORAGE_KEY, projectId);
      setContent('');
      setOpen(false);
    } catch (e) {
      toast.error(`Échec : ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const onTextareaKey = (e) => {
    // Cmd+Enter pour submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ajouter une entrée au journal"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--overlay)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        className="lg-anim-rise resp-modal"
        style={{
          width: 'min(560px, calc(100vw - 32px))',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--gold)', fontSize: 14 }}>✎</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
              Quick-add — entrée journal
            </span>
          </div>
          <kbd style={{
            fontSize: 10,
            padding: '2px 6px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            color: 'var(--text-3)',
            fontFamily: 'var(--font-mono)',
          }}>Esc</kbd>
        </div>

        {/* Project picker */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <label style={labelStyle}>Projet</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer par code ou nom…"
            style={{
              width: '100%',
              padding: '6px 10px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontSize: 12,
              fontFamily: 'var(--font-sans)',
              marginBottom: 8,
              outline: 'none',
            }}
          />
          <div style={{
            maxHeight: 140,
            overflowY: 'auto',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg)',
          }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 12, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
                Aucun projet trouvé
              </div>
            ) : (
              filtered.map(p => (
                <button
                  key={p.id}
                  onClick={() => setProjectId(p.id)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    background: projectId === p.id ? 'var(--gold-soft)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'var(--font-sans)',
                    color: projectId === p.id ? 'var(--gold-deep)' : 'var(--text)',
                    transition: 'background var(--duration) var(--ease)',
                  }}
                >
                  <span style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)',
                    color: 'var(--text-3)', minWidth: 64,
                  }}>{p.code}</span>
                  <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                  <Badge tone={PILLAR_TONE[p.pillar] || 'neutral'} pillar={p.pillar} size="sm">
                    {p.pillar}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Type picker */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <label style={labelStyle}>Type</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TYPES.map(t => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px',
                  background: type === t.key ? 'var(--gold-soft)' : 'var(--surface-2)',
                  border: `1px solid ${type === t.key ? 'var(--gold)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: type === t.key ? 'var(--gold-deep)' : 'var(--text-2)',
                  fontSize: 11,
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                  transition: 'all var(--duration) var(--ease)',
                  fontWeight: type === t.key ? 500 : 400,
                }}
              >
                <span style={{ fontSize: 13 }}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '12px 16px' }}>
          <label style={labelStyle}>Contenu</label>
          <textarea
            ref={inputRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={onTextareaKey}
            placeholder="Ce qui s'est passé, à retenir, à suivre…"
            rows={4}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              lineHeight: 1.5,
              resize: 'vertical',
              outline: 'none',
            }}
          />
        </div>

        {/* Actions */}
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface-2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            ⌘+Enter pour valider
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!projectId || !content.trim() || submitting}
              onClick={submit}
            >
              {submitting ? 'Enregistrement…' : 'Ajouter'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  color: 'var(--text-3)',
  fontFamily: 'var(--font-mono)',
  marginBottom: 6,
};
