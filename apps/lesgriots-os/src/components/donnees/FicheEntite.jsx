'use client';

/**
 * La fiche, en un seul composant, pour toutes les données de l'OS.
 *
 * Le principe est le même partout : on ne demande pas un champ « parce que
 * c'est mieux d'avoir l'information », on le demande parce que sans lui une
 * pièce ne peut pas être produite, un dossier ne peut pas être déposé, ou un
 * audit ne peut pas être passé. La raison est écrite sous chaque champ.
 *
 * Une fiche se décrit ainsi :
 *   blocs          = [{ id, titre, intro, champs: [{ cle, libelle, aide,
 *                       requis, type, options, lignes }] }]
 *   indispensables = [[cle, 'ce qui manque, en toutes lettres']]
 */

import { useMemo } from 'react';

const carte = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 };
const attenue = { color: 'var(--text-3)', fontSize: 12, lineHeight: 1.5 };
const titreStyle = { margin: 0, fontSize: 16, letterSpacing: '-.02em', color: 'var(--text)' };
const saisie = {
  width: '100%', boxSizing: 'border-box', padding: '10px 11px',
  border: '1px solid var(--border-2)', borderRadius: 9,
  background: 'var(--surface-2)', color: 'var(--text)', font: 'inherit', fontSize: 13,
};

export function bouton(secondaire, desactive = false) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 10,
    fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: desactive ? 'not-allowed' : 'pointer',
    opacity: desactive ? .45 : 1, whiteSpace: 'nowrap', textDecoration: 'none',
    background: secondaire ? 'var(--surface)' : 'var(--gold)',
    color: secondaire ? 'var(--text)' : 'var(--gold-ink)',
    border: `1.5px solid ${secondaire ? 'var(--border-2)' : 'var(--gold)'}`,
  };
}

export const styleCarte = carte;
export const styleAttenue = attenue;
export const styleTitre = titreStyle;

export default function FicheEntite({
  blocs, indispensables = [], valeurs, onChange,
  onEnregistrer, modifie, occupe, message, erreur, actions, enfants,
}) {
  const tousChamps = useMemo(() => blocs.flatMap((b) => b.champs), [blocs]);
  const rempli = (cle) => String(valeurs[cle] ?? '').trim().length > 0;
  const remplis = tousChamps.filter((c) => rempli(c.cle)).length;
  const manquants = indispensables.filter(([cle]) => !rempli(cle));
  const total = tousChamps.length || 1;

  return <div style={{ display: 'grid', gap: 16 }}>

    <section style={{ ...carte, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div style={{ ...attenue, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, fontSize: 10 }}>Complétude du dossier</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)', marginTop: 4 }}>{remplis} / {total} champs</div>
      </div>
      <div style={{ flex: '1 1 260px', minWidth: 200 }}>
        <div style={{ height: 9, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.round((remplis / total) * 100)}%`, height: '100%', background: 'var(--gold)' }} />
        </div>
        <div style={{ ...attenue, marginTop: 8 }}>
          {manquants.length
            ? `Il manque ${manquants.map(([, mot]) => mot).join(', ')}.`
            : 'Le dossier est complet sur les points bloquants.'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
        {actions}
        <button type="button" onClick={onEnregistrer} disabled={!modifie || occupe} style={bouton(false, !modifie || occupe)}>
          {occupe ? 'Enregistrement…' : modifie ? 'Enregistrer la fiche' : 'Fiche à jour'}
        </button>
      </div>
    </section>

    {message && <div style={{ padding: '11px 14px', borderRadius: 10, background: 'var(--success-soft)', border: '1.5px solid color-mix(in srgb, var(--success) 40%, transparent)', fontSize: 13, fontWeight: 700 }}>{message}</div>}
    {erreur && <div style={{ padding: '11px 14px', borderRadius: 10, background: 'var(--danger-soft)', border: '1.5px solid color-mix(in srgb, var(--danger) 40%, transparent)', fontSize: 13, fontWeight: 700 }}>{erreur}</div>}

    {blocs.map((bloc) => <section key={bloc.id} style={{ ...carte, ...(bloc.ton === 'alerte' ? { borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)' } : {}) }}>
      <h2 style={titreStyle}>{bloc.titre}</h2>
      {bloc.intro && <p style={{ ...attenue, margin: '6px 0 16px' }}>{bloc.intro}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
        {bloc.champs.map((champ) => {
          const vide = !rempli(champ.cle);
          const alerte = champ.requis && vide;
          const commun = {
            value: valeurs[champ.cle] ?? '',
            onChange: (e) => onChange(champ.cle, e.target.value),
            style: { ...saisie, borderColor: alerte ? 'color-mix(in srgb, var(--danger) 45%, transparent)' : 'var(--border-2)' },
          };
          return <label key={champ.cle} style={{ display: 'grid', gap: 5, gridColumn: champ.large ? '1 / -1' : 'auto' }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: alerte ? 'var(--danger)' : 'var(--text-3)' }}>
              {champ.libelle}{alerte ? ' · à renseigner' : ''}
            </span>
            {champ.options
              ? <select {...commun}><option value="">À définir</option>{champ.options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
              : champ.lignes
                ? <textarea {...commun} rows={champ.lignes} style={{ ...commun.style, resize: 'vertical' }} />
                : <input type={champ.type || 'text'} {...commun} />}
            {champ.aide && <span style={{ ...attenue, fontSize: 11.5 }}>{champ.aide}</span>}
          </label>;
        })}
      </div>
    </section>)}

    {enfants}
  </div>;
}
