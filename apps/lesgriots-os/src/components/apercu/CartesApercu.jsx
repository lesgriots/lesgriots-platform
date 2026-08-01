'use client';

/**
 * Les blocs de la vue d'ensemble, d'après la maquette Claude Design.
 *
 * Trois idées reprises, et elles tiennent ensemble.
 *
 * La carte d'indicateur porte un disque de couleur en fond et une icône : le
 * chiffre se repère avant d'être lu, ce qui compte sur un écran qu'on ouvre
 * vingt fois par jour. Une couleur par famille, jamais l'or pour tout.
 *
 * « Ce qui vous attend » transforme la conformité en gestes datés avec un
 * bouton chacun. Une liste d'alertes dit ce qui ne va pas ; une liste de
 * gestes dit quoi faire. Le second se traite, le premier se subit.
 *
 * « Prochaines sessions » met la date en gros à gauche, parce que c'est par
 * elle qu'on cherche, et le statut en pastille à droite.
 */

import Link from 'next/link';

const TONS = {
  or:     { disque: 'rgba(255,202,0,0.20)',   trait: 'var(--gold-deep)',     fond: 'rgba(255,202,0,0.08)' },
  bleu:   { disque: 'rgba(38,112,180,0.16)',  trait: 'var(--pillar-studio)', fond: 'rgba(38,112,180,0.07)' },
  violet: { disque: 'rgba(131,71,161,0.16)',  trait: 'var(--pillar-prod)',   fond: 'rgba(131,71,161,0.07)' },
  vert:   { disque: 'rgba(30,132,73,0.16)',   trait: 'var(--success)',       fond: 'rgba(30,132,73,0.07)' },
  rouge:  { disque: 'rgba(184,51,40,0.16)',   trait: 'var(--danger)',        fond: 'rgba(184,51,40,0.07)' },
};

const ICONES = {
  cible: 'M8 14.5A6.5 6.5 0 1 0 8 1.5a6.5 6.5 0 0 0 0 13Z M8 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z',
  toque: 'M8 2 1.5 5.2 8 8.4l6.5-3.2L8 2Z M4.2 6.6v3.6c0 1.1 1.7 2 3.8 2s3.8-.9 3.8-2V6.6 M14.5 5.2v4',
  horloge: 'M8 14.5A6.5 6.5 0 1 0 8 1.5a6.5 6.5 0 0 0 0 13Z M8 4.4V8l2.4 1.6',
  etoile: 'M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6L8 1.8Z',
};

const svg = (nom, taille) => (
  <svg width={taille} height={taille} viewBox="0 0 16 16" fill="none" stroke="currentColor"
    strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={ICONES[nom]} />
  </svg>
);

const boutonStyle = {
  flex: 'none', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
  font: 'inherit', fontSize: 12.5, fontWeight: 700, padding: '8px 14px', borderRadius: 9,
  cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap',
};

const MOIS = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Un indicateur : le chiffre d'abord, la couleur pour le repérer. */
export function CarteIndicateur({ titre, note, valeur, unite, ton = 'or', icone = 'cible' }) {
  const t = TONS[ton] || TONS.or;
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', background: 'var(--surface)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px 20px',
      minHeight: 132,
    }}>
      <div aria-hidden="true" style={{
        position: 'absolute', top: -46, right: -46, width: 150, height: 150,
        borderRadius: '50%', background: t.disque,
      }} />
      <div style={{ position: 'absolute', top: 20, right: 22, color: t.trait }}>{svg(icone, 26)}</div>
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.01em' }}>{titre}</div>
        {note && <div style={{ color: 'var(--text-3)', fontSize: 12.5, marginTop: 2 }}>{note}</div>}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 14 }}>
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.03em', color: t.trait, lineHeight: 1 }}>{valeur}</span>
          {unite && <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{unite}</span>}
        </div>
      </div>
    </div>
  );
}

/** Un geste à poser : dit quoi faire, et propose de le faire. */
export function LigneGeste({ ton = 'or', texte, meta, action, href, onAction }) {
  const t = TONS[ton] || TONS.or;
  const bouton = action && (href
    ? <Link href={href} style={boutonStyle}>{action}</Link>
    : <button type="button" onClick={onAction} style={boutonStyle}>{action}</button>);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
      background: t.fond, borderRadius: 10, padding: '13px 15px',
    }}>
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', minWidth: 0 }}>
        <span aria-hidden="true" style={{
          width: 8, height: 8, borderRadius: '50%', background: t.trait, flex: 'none', marginTop: 6,
        }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>{texte}</div>
          {meta && <div style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>{meta}</div>}
        </div>
      </div>
      {bouton}
    </div>
  );
}

/** Une date à venir : le jour en gros, parce que c'est par lui qu'on cherche. */
export function LigneSession({ date, titre, meta, statut, ton = 'or', href }) {
  const d = date ? new Date(`${String(date).slice(0, 10)}T12:00:00`) : null;
  const valide = d && !Number.isNaN(d.getTime());
  const jour = valide ? String(d.getDate()).padStart(2, '0') : '—';
  const mois = valide ? MOIS[d.getMonth()] : '';
  const t = TONS[ton] || TONS.or;

  const contenu = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, border: '1px solid var(--border)',
      borderRadius: 10, padding: '12px 15px', background: 'var(--surface)',
    }}>
      <div style={{ textAlign: 'center', flex: 'none', width: 46, borderRight: '1px solid var(--border)', paddingRight: 14 }}>
        <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-.03em', color: t.trait, lineHeight: 1 }}>{jour}</div>
        <div style={{ color: 'var(--text-3)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 3 }}>{mois}</div>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.35 }}>{titre}</div>
        {meta && <div style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>{meta}</div>}
      </div>
      {statut && <span style={{
        flex: 'none', background: t.fond, color: t.trait, fontSize: 11.5, fontWeight: 700,
        padding: '5px 11px', borderRadius: 999, whiteSpace: 'nowrap',
      }}>{statut}</span>}
    </div>
  );

  return href
    ? <Link href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>{contenu}</Link>
    : contenu;
}

/** Le sélecteur de période, en pilules. */
export function Pilules({ options, valeur, sur }) {
  return (
    <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }} role="tablist">
      {options.map(([cle, libelle, compteur]) => {
        const actif = valeur === cle;
        return (
          <button
            key={cle}
            role="tab"
            aria-selected={actif}
            onClick={() => sur(cle)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '9px 17px', borderRadius: 999, font: 'inherit', fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
              border: `1px solid ${actif ? 'var(--gold)' : 'var(--border)'}`,
              background: actif ? 'var(--gold-soft)' : 'var(--surface)',
              color: 'var(--text)',
            }}
          >
            {libelle}
            {compteur != null && <span style={{
              background: actif ? 'var(--gold)' : 'var(--surface-2)',
              color: actif ? 'var(--gold-ink)' : 'var(--text-3)',
              borderRadius: 999, padding: '1px 8px', fontSize: 11.5, fontWeight: 800,
            }}>{compteur}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** La colonne de droite : ce que l'écran dit, et comment s'en servir. */
export function Reperes({ reperes = [], astuces = [] }) {
  const bloc = (titre, items, icone) => items.length > 0 && (
    <div style={{ marginBottom: 30 }}>
      <div style={{
        color: 'var(--text-3)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.09em',
        textTransform: 'uppercase', marginBottom: 14,
      }}>{titre}</div>
      <div style={{ display: 'grid', gap: 16 }}>
        {items.map((x, i) => (
          <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
            <span style={{
              flex: 'none', width: 26, height: 26, borderRadius: 8, background: 'var(--gold-soft)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--gold-deep)', fontSize: 13, fontWeight: 700,
            }}>{icone}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{x.titre}</div>
              <div style={{ color: 'var(--text-3)', fontSize: 12.5, lineHeight: 1.5, marginTop: 2 }}>{x.texte}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  if (!reperes.length && !astuces.length) return null;
  return (
    <aside style={{ width: 288, flex: 'none', paddingLeft: 26, borderLeft: '1px solid var(--border)' }}>
      {bloc('Repères', reperes, 'i')}
      {bloc('Astuces', astuces, '?')}
    </aside>
  );
}
