'use client';
/**
 * BriefSections — Creative brief structuré façon PPM (Practical Project Management / The Futur).
 *
 * Composant réutilisable, utilisé sur la page /projects/[id]/brief.
 *
 * Props :
 *   brief : objet { goal, overview, brandPositioning, userNeeds, clientNeeds, creativeDirection, milestones, deliverySpecs }
 *   onSave(key, value) : appelé à chaque blur d'un champ
 *   onGenerate : optionnel — handler pour générer PDF (affiche bouton si fourni)
 *   generating : bool — désactive le bouton pendant la génération
 *   header : bool (default true) — affiche le header titre + progress + bouton PDF
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';

export const BRIEF_FIELDS = [
  { key: 'goal',              label: 'Goal',                hint: 'But du projet en une à deux phrases.',                          placeholder: 'Attirer les utilisateurs à explorer, participer, s\'inscrire…',                                            large: true },
  { key: 'overview',          label: 'Overview',            hint: 'Vue d\'ensemble plus large : contexte, comment ça marche.',     placeholder: 'Ce site servira d\'outil marketing. L\'info la plus excitante sera curée…',                                large: true },
  { key: 'brandPositioning',  label: 'Brand positioning',   hint: 'Le positionnement de marque, en une phrase forte.',             placeholder: 'Connecter et donner du pouvoir aux communautés obsédées par…' },
  { key: 'userNeeds',         label: 'User needs',          hint: 'Profil de l\'utilisateur primaire + ce qu\'il doit pouvoir accomplir.', placeholder: '« L\'Attendee », membre de la communauté. Doit pouvoir : 1) apprendre… 2) acheter…',                large: true },
  { key: 'clientNeeds',       label: 'Client needs',        hint: 'Ce que le client veut que le projet accomplisse côté business.', placeholder: '1) Vendre des billets · 2) Capturer des emails · 3) Informer…' },
  { key: 'creativeDirection', label: 'Creative direction',  hint: 'Direction artistique, do\'s & don\'ts visuels.',                 placeholder: '✓ Esthétique manga · ✗ Pas trop corporate · ✓ Utiliser des photos de la communauté…',                       large: true },
  { key: 'milestones',        label: 'Jalons',              hint: 'Deadlines importantes du projet.',                              placeholder: 'Kickoff · Présentation v1 · Livraison finale…' },
  { key: 'deliverySpecs',     label: 'Specs techniques',    hint: 'Format, résolution, codecs, plateformes de livraison.',         placeholder: 'Vidéos 16:9 ProRes 422 HQ + H264 web · 1920×1080 24fps…' },
];

export const BRIEF_PPM_KEYS = ['goal', 'overview', 'brandPositioning', 'userNeeds', 'clientNeeds', 'creativeDirection'];
const BRIEF_BY_KEY = Object.fromEntries(BRIEF_FIELDS.map(f => [f.key, f]));

export default function BriefSections({ brief = {}, onSave, onGenerate, generating, header = true }) {
  const ppmFilled = BRIEF_PPM_KEYS.filter(k => (brief[k] || '').trim()).length;
  const ppmTotal = BRIEF_PPM_KEYS.length;
  const pctFilled = Math.round((ppmFilled / ppmTotal) * 100);

  const section = (key) => {
    const cfg = BRIEF_BY_KEY[key];
    if (!cfg) return null;
    return (
      <BriefSection
        key={key}
        field={cfg}
        value={brief[key] || ''}
        onSave={(v) => onSave(key, v)}
      />
    );
  };

  return (
    <div>
      {header && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 12, paddingBottom: 12, marginBottom: 20,
          borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <h2 style={{
                margin: 0, fontSize: 16, fontWeight: 500,
                color: 'var(--text)', fontFamily: 'var(--font-title)',
                letterSpacing: -0.01,
              }}>
                Creative brief
              </h2>
              <span style={{
                fontSize: 11, fontFamily: 'var(--font-mono)',
                color: 'var(--text-3)',
              }}>
                {ppmFilled}/{ppmTotal} sections PPM
              </span>
            </div>
            <div style={{
              marginTop: 6, height: 3, width: 240, maxWidth: '100%',
              background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${pctFilled}%`,
                background: pctFilled === 100 ? 'var(--success)' : 'var(--gold)',
                transition: 'width var(--duration-slow) var(--ease-out)',
              }} />
            </div>
          </div>
          {onGenerate && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onGenerate}
              disabled={generating || ppmFilled === 0}
            >
              {generating ? 'Génération…' : '📋 Exporter PDF'}
            </Button>
          )}
        </div>
      )}

      {section('goal')}
      {section('overview')}
      {section('brandPositioning')}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 24,
      }}>
        {section('userNeeds')}
        {section('clientNeeds')}
      </div>

      {section('creativeDirection')}

      <div style={{
        marginTop: 24, paddingTop: 18,
        borderTop: '1px dashed var(--border-2)',
      }}>
        <div style={{
          fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6,
          color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
          marginBottom: 6,
        }}>
          Pilotage interne LES GRIOTS
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 16 }}>
          Sections complémentaires hors brief créatif standard
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
        }}>
          {section('milestones')}
          {section('deliverySpecs')}
        </div>
      </div>
    </div>
  );
}

function BriefSection({ field, value, onSave }) {
  const [focused, setFocused] = useState(false);
  const [local, setLocal] = useState(value);
  const isEmpty = !value || !value.trim();
  const ref = useRef(null);

  useEffect(() => { if (!focused) setLocal(value); }, [value, focused]);

  const commit = async () => {
    if (local === value) return;
    try { await onSave(local); }
    catch { setLocal(value); }
  };

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      ref.current?.blur();
    }
    if (e.key === 'Escape') {
      setLocal(value);
      setTimeout(() => ref.current?.blur(), 10);
    }
  };

  return (
    <div style={{ paddingBottom: 8, marginBottom: 18 }}>
      <div style={{
        width: 28, height: 1.5,
        background: 'var(--text)',
        marginBottom: 6,
      }} />
      <div style={{
        fontSize: 11, fontWeight: 600,
        color: 'var(--text)',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 4,
        fontFamily: 'var(--font-sans)',
      }}>
        {field.label}
      </div>
      <div style={{
        fontSize: 11, color: 'var(--text-3)',
        marginBottom: 8, fontStyle: 'italic',
      }}>
        {field.hint}
      </div>
      <textarea
        ref={ref}
        value={focused ? local : (value || '')}
        onChange={(e) => setLocal(e.target.value)}
        onFocus={() => { setLocal(value || ''); setFocused(true); }}
        onBlur={() => { setFocused(false); commit(); }}
        onKeyDown={onKeyDown}
        placeholder={field.placeholder}
        rows={field.large ? 4 : 2}
        style={{
          width: '100%',
          padding: '8px 10px',
          background: focused ? 'var(--surface-2)' : 'transparent',
          border: '1px solid ' + (focused ? 'var(--gold)' : 'transparent'),
          borderRadius: 'var(--radius-sm)',
          color: isEmpty && !focused ? 'var(--text-3)' : 'var(--text)',
          fontSize: 13,
          lineHeight: 1.55,
          fontFamily: 'var(--font-sans)',
          fontStyle: isEmpty && !focused ? 'italic' : 'normal',
          outline: 'none',
          resize: 'vertical',
          minHeight: field.large ? 80 : 50,
          transition: 'all var(--duration) var(--ease)',
          boxShadow: focused ? 'var(--focus-ring)' : 'none',
          cursor: focused ? 'text' : 'pointer',
        }}
      />
      {focused && (
        <div style={{
          fontSize: 10, color: 'var(--text-3)',
          marginTop: 4, fontFamily: 'var(--font-mono)',
          textAlign: 'right',
        }}>
          ⌘+Enter pour valider · Esc pour annuler
        </div>
      )}
    </div>
  );
}
