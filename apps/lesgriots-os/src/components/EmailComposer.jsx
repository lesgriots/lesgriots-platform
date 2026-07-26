'use client';
/**
 * EmailComposer — modale de composition d'email depuis un template PPM.
 *
 * Props :
 *   open : booléen
 *   onClose : fonction
 *   project : objet projet courant
 *   client : objet client lié (si dispo)
 *
 * Workflow :
 *   1) Choisit un template (par défaut le premier disponible)
 *   2) Pré-remplit les champs depuis le projet/client
 *   3) L'utilisateur édite les variables → preview live du subject + body
 *   4) Actions : Copier (clipboard), Ouvrir dans Mail (mailto:), Logger dans le journal
 */
import { useEffect, useMemo, useState } from 'react';
import { Button, useToast } from '@/components/ui';
import { EMAIL_TEMPLATES, EMAIL_TEMPLATES_MAP, getDefaultsForTemplate } from '@/lib/email-templates';

export default function EmailComposer({ open, onClose, project, client }) {
  const [templateKey, setTemplateKey] = useState(EMAIL_TEMPLATES[0]?.key);
  const [vars, setVars] = useState({});
  const [copying, setCopying] = useState(false);
  const [logging, setLogging] = useState(false);
  const { toast } = useToast();

  const template = EMAIL_TEMPLATES_MAP[templateKey];

  // Re-init vars quand on change de template ou de projet
  useEffect(() => {
    if (!template) return;
    setVars(getDefaultsForTemplate(template, project));
  }, [templateKey, project, template]);

  // Esc ferme
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const subject = useMemo(() => {
    if (!template) return '';
    try { return template.subject({ project, client, vars }); }
    catch { return ''; }
  }, [template, project, client, vars]);

  const body = useMemo(() => {
    if (!template) return '';
    try { return template.body({ project, client, vars }); }
    catch { return ''; }
  }, [template, project, client, vars]);

  const setVar = (key, value) => setVars(v => ({ ...v, [key]: value }));

  const copyEmail = async () => {
    setCopying(true);
    const full = `Sujet : ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(full);
      toast.success('Email copié dans le presse-papier');
    } catch (e) {
      toast.error('Impossible de copier');
    } finally {
      setCopying(false);
    }
  };

  const openInMail = () => {
    const to = client?.email || '';
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  const logInJournal = async () => {
    if (!project?.id) return;
    setLogging(true);
    try {
      const summary = `Email "${template.label}" envoyé · Objet : ${subject}`;
      const r = await fetch(`/api/projects/${project.id}/journal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email',
          content: `${summary}\n\n--- Body ---\n${body}`,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success('Logué dans le journal projet');
    } catch (e) {
      toast.error(`Log : ${e.message}`);
    } finally {
      setLogging(false);
    }
  };

  if (!open || !template) return null;

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Composer un email"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--overlay)',
        zIndex: 900,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '6vh',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        className="lg-anim-rise resp-modal"
        style={{
          width: 'min(820px, calc(100vw - 32px))',
          maxHeight: '88vh',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 14, color: 'var(--gold)' }}>✉</span>
            <h3 style={{
              margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text)',
              fontFamily: 'var(--font-title)',
            }}>
              Composer un email
            </h3>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              · {template.description}
            </span>
          </div>
          <kbd style={{
            fontSize: 10, padding: '2px 6px',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 4, color: 'var(--text-3)',
            fontFamily: 'var(--font-mono)',
          }}>Esc</kbd>
        </div>

        {/* Template selector */}
        {EMAIL_TEMPLATES.length > 1 && (
          <div style={{
            padding: '10px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', gap: 6, flexWrap: 'wrap',
          }}>
            {EMAIL_TEMPLATES.map(t => (
              <button
                key={t.key}
                onClick={() => setTemplateKey(t.key)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: '1px solid ' + (templateKey === t.key ? 'var(--gold)' : 'var(--border)'),
                  background: templateKey === t.key ? 'var(--gold-soft)' : 'transparent',
                  color: templateKey === t.key ? 'var(--gold-deep)' : 'var(--text-2)',
                  fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Corps scrollable */}
        <div className="resp-grid-1col" style={{
          flex: 1, overflowY: 'auto',
          display: 'grid', gridTemplateColumns: '1fr 1.2fr',
          minHeight: 0,
        }}>
          {/* Variables à gauche */}
          <div style={{
            padding: '14px 18px',
            borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: 14,
            overflowY: 'auto',
          }}>
            <div style={{
              fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6,
              color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
            }}>
              Variables
            </div>

            {/* Destinataire (auto depuis client) */}
            <FieldRow label="Destinataire">
              <div style={{
                padding: '6px 10px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                color: client?.email ? 'var(--text)' : 'var(--text-3)',
                fontFamily: 'var(--font-mono)',
              }}>
                {client?.email || '(pas d\'email client renseigné)'}
              </div>
            </FieldRow>

            {/* Champs du template */}
            {template.fields.map(f => (
              <FieldRow key={f.key} label={f.label}>
                <FieldInput
                  field={f}
                  value={vars[f.key]}
                  onChange={(v) => setVar(f.key, v)}
                />
              </FieldRow>
            ))}
          </div>

          {/* Preview à droite */}
          <div style={{
            padding: '14px 18px',
            display: 'flex', flexDirection: 'column', gap: 12,
            background: 'var(--surface-2)',
            overflowY: 'auto',
          }}>
            <div style={{
              fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6,
              color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
            }}>
              Aperçu
            </div>
            <div>
              <div style={{
                fontSize: 10, color: 'var(--text-3)',
                fontFamily: 'var(--font-mono)', marginBottom: 4,
                textTransform: 'uppercase', letterSpacing: 0.6,
              }}>Sujet</div>
              <div style={{
                fontSize: 13, fontWeight: 500, color: 'var(--text)',
                padding: '6px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
              }}>
                {subject || '(vide)'}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 10, color: 'var(--text-3)',
                fontFamily: 'var(--font-mono)', marginBottom: 4,
                textTransform: 'uppercase', letterSpacing: 0.6,
              }}>Corps</div>
              <pre style={{
                margin: 0, padding: '10px 12px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12, lineHeight: 1.55,
                color: 'var(--text)',
                fontFamily: 'var(--font-sans)',
                whiteSpace: 'pre-wrap', wordWrap: 'break-word',
                maxHeight: '50vh', overflowY: 'auto',
              }}>{body}</pre>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 8, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            Le destinataire est rempli depuis l'email du client lié.
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="ghost" size="sm" onClick={onClose}>Fermer</Button>
            <Button variant="secondary" size="sm" onClick={logInJournal} disabled={logging}>
              {logging ? 'Log…' : '📓 Logger dans journal'}
            </Button>
            <Button variant="secondary" size="sm" onClick={copyEmail} disabled={copying}>
              {copying ? '…' : '⎘ Copier'}
            </Button>
            <Button variant="primary" size="sm" onClick={openInMail}>
              ✉ Ouvrir dans Mail
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// FieldRow & FieldInput
// ─────────────────────────────────────────────────────────
function FieldRow({ label, children }) {
  return (
    <div>
      <div style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6,
        color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
        marginBottom: 5,
      }}>{label}</div>
      {children}
    </div>
  );
}

function FieldInput({ field, value, onChange }) {
  const common = {
    padding: '6px 10px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    width: '100%',
    outline: 'none',
  };

  if (field.type === 'date') {
    return <input type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} style={common} />;
  }
  if (field.type === 'textarea') {
    return (
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={field.rows || 3}
        style={{ ...common, lineHeight: 1.5, resize: 'vertical' }}
      />
    );
  }
  if (field.type === 'list') {
    return <ListEditor value={value || []} onChange={onChange} placeholder={field.placeholder} />;
  }
  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      style={common}
    />
  );
}

function ListEditor({ value, onChange, placeholder }) {
  const items = Array.isArray(value) ? value : [];
  const update = (i, v) => onChange(items.map((it, idx) => idx === i ? v : it));
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, '']);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ color: 'var(--text-3)', fontSize: 12 }}>•</span>
          <input
            type="text"
            value={item}
            onChange={(e) => update(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder={i === 0 ? placeholder : ''}
            autoFocus={i === items.length - 1 && !item}
            style={{
              flex: 1, padding: '4px 8px',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text)',
              fontSize: 12, outline: 'none', fontFamily: 'var(--font-sans)',
            }}
          />
          <button
            onClick={() => remove(i)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-3)', padding: '2px 4px', fontSize: 13, lineHeight: 1,
            }}
            title="Supprimer"
          >×</button>
        </div>
      ))}
      <button
        onClick={add}
        style={{
          padding: '4px 10px',
          background: 'transparent', color: 'var(--text-3)',
          border: '1px dashed var(--border-2)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 11, cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          alignSelf: 'flex-start',
          marginTop: 2,
        }}
      >+ Ajouter</button>
    </div>
  );
}
