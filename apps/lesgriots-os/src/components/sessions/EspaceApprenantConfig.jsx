'use client';

/**
 * Ce que la session montre dans l'espace apprenant.
 *
 * L'espace affichait tout, tout le temps. Or ce qui doit être visible dépend
 * de la session : le programme n'est pas toujours prêt à être publié, et les
 * boutons d'émargement n'ont de sens que si la présence se signe en ligne.
 *
 * Deux niveaux, comme il se doit : ce réglage-ci vaut pour cette session, et
 * un bouton permet d'en faire la référence de toutes les nouvelles. On ne
 * touche jamais aux sessions déjà réglées : ce serait modifier dans leur dos
 * ce que des apprenants voient peut-être déjà.
 */

import { useEffect, useState } from 'react';

const carte = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 };
const attenue = { color: 'var(--text-3)', fontSize: 12, lineHeight: 1.5 };
const titre = { margin: 0, fontSize: 16, letterSpacing: '-.02em', color: 'var(--text)' };
const champ = {
  width: '100%', boxSizing: 'border-box', padding: '10px 11px',
  border: '1px solid var(--border-2)', borderRadius: 9,
  background: 'var(--surface-2)', color: 'var(--text)', font: 'inherit', fontSize: 13,
};
function bouton(secondaire, desactive = false) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 10,
    fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: desactive ? 'not-allowed' : 'pointer',
    opacity: desactive ? .45 : 1, whiteSpace: 'nowrap', textDecoration: 'none',
    background: secondaire ? 'var(--surface)' : 'var(--gold)',
    color: secondaire ? 'var(--text)' : 'var(--gold-ink)',
    border: `1.5px solid ${secondaire ? 'var(--border-2)' : 'var(--gold)'}`,
  };
}

const VISIBILITES = [
  { cle: 'programme', libelle: 'Le programme', aide: 'Description, objectifs et modules. À masquer tant qu’il n’est pas arrêté.' },
  { cle: 'lieu', libelle: 'Le lieu', aide: 'Adresse et accessibilité. À masquer si la salle n’est pas confirmée.' },
  { cle: 'formateur', libelle: 'Le formateur', aide: 'Son nom. À masquer si l’intervenant peut encore changer.' },
  { cle: 'documents', libelle: 'Mes documents', aide: 'Ses pièces nominatives et les documents pédagogiques de la session. Les factures, devis et conventions de session ne sont jamais montrés.' },
  { cle: 'emargement', libelle: 'Les boutons d’émargement', aide: 'La signature en ligne, demi-journée par demi-journée. À laisser fermé si tu émarges sur papier.' },
  { cle: 'questionnaires', libelle: 'Les questionnaires', aide: 'Positionnement, à chaud, à froid. Ce sont tes preuves des indicateurs 4 et 30.' },
];

export default function EspaceApprenantConfig({ sessionId, session, onNotice, onRecharger }) {
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState({});
  const [initial, setInitial] = useState('');
  const [occupe, setOccupe] = useState('');

  useEffect(() => {
    let o = {};
    try { o = JSON.parse(session?.espace_options || '{}') || {}; } catch { o = {}; }
    setNom(session?.espace_nom_public || '');
    setDescription(session?.espace_description || '');
    setOptions(o);
    setInitial(JSON.stringify({ n: session?.espace_nom_public || '', d: session?.espace_description || '', o }));
  }, [session?.id, session?.espace_options, session?.espace_nom_public, session?.espace_description]);

  const modifie = initial !== JSON.stringify({ n: nom, d: description, o: options });
  const actif = (cle) => options[cle] !== false;

  const enregistrer = async () => {
    setOccupe('session');
    try {
      const r = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          espace_nom_public: nom, espace_description: description,
          espace_options: JSON.stringify(options),
        }),
      });
      if (!r.ok) throw new Error('Enregistrement impossible');
      onNotice?.('Espace apprenant mis à jour. Les apprenants verront le changement à leur prochaine visite.');
      await onRecharger?.();
    } catch (e) { onNotice?.(e.message); } finally { setOccupe(''); }
  };

  const definirDefaut = async () => {
    setOccupe('defaut');
    try {
      const r = await fetch('/api/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ espace_options_defaut: JSON.stringify(options) }),
      });
      if (!r.ok) throw new Error('Réglage par défaut non enregistré');
      onNotice?.('Ces réglages deviennent la référence des nouvelles sessions. Les sessions déjà réglées ne bougent pas.');
    } catch (e) { onNotice?.(e.message); } finally { setOccupe(''); }
  };

  return <div style={{ display: 'grid', gap: 14 }}>

    <section style={carte}>
      <h2 style={titre}>Ce que l’apprenant voit</h2>
      <p style={{ ...attenue, margin: '6px 0 16px' }}>
        Le nom interne d’une session n’est pas toujours celui qu’on montre. Ici, tu écris ce que l’apprenant lit en ouvrant son espace.
      </p>
      <div style={{ display: 'grid', gap: 14 }}>
        <label style={{ display: 'grid', gap: 5 }}>
          <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>Nom de la session pour les apprenants</span>
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder={session?.formation_title || 'Nom affiché'} style={champ} />
          <span style={{ ...attenue, fontSize: 11.5 }}>Laisse vide pour reprendre le nom de la session.</span>
        </label>
        <label style={{ display: 'grid', gap: 5 }}>
          <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>Mot d’accueil</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Bienvenue. Voici tout ce dont vous aurez besoin avant, pendant et après la formation." style={{ ...champ, resize: 'vertical' }} />
          <span style={{ ...attenue, fontSize: 11.5 }}>Affiché en tête de son espace. Deux phrases suffisent.</span>
        </label>
      </div>
    </section>

    <section style={carte}>
      <h2 style={titre}>Options de visibilité</h2>
      <p style={{ ...attenue, margin: '6px 0 16px' }}>
        Tout est affiché par défaut. Ferme ce qui n’est pas prêt plutôt que de laisser un apprenant lire un programme provisoire.
      </p>
      <div style={{ display: 'grid', gap: 14 }}>
        {VISIBILITES.map((v) => (
          <label key={v.cle} style={{ display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr)', gap: 12, cursor: 'pointer', alignItems: 'start' }}>
            <button type="button" role="switch" aria-checked={actif(v.cle)} aria-label={v.libelle}
              onClick={() => setOptions((c) => ({ ...c, [v.cle]: !actif(v.cle) }))}
              style={{ width: 40, height: 23, padding: 3, border: '1px solid var(--border-2)', borderRadius: 99, background: actif(v.cle) ? 'var(--gold)' : 'var(--surface-2)', cursor: 'pointer', marginTop: 2 }}>
              <span style={{ display: 'block', width: 15, height: 15, borderRadius: '50%', background: actif(v.cle) ? 'var(--gold-ink)' : 'var(--text-3)', transform: actif(v.cle) ? 'translateX(17px)' : 'translateX(0)', transition: 'transform .16s ease' }} />
            </button>
            <span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{v.libelle}</span>
              <span style={{ ...attenue, display: 'block', marginTop: 2 }}>{v.aide}</span>
            </span>
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <button type="button" onClick={enregistrer} disabled={!modifie || occupe === 'session'} style={bouton(false, !modifie || occupe === 'session')}>
          {occupe === 'session' ? 'Enregistrement…' : modifie ? 'Enregistrer pour cette session' : 'Session à jour'}
        </button>
        <button type="button" onClick={definirDefaut} disabled={occupe === 'defaut'} style={bouton(true, occupe === 'defaut')}>
          {occupe === 'defaut' ? 'Enregistrement…' : 'En faire le réglage par défaut'}
        </button>
      </div>
      <p style={{ ...attenue, marginTop: 10 }}>
        Le réglage par défaut s’applique aux sessions qui n’ont pas le leur. Les sessions déjà réglées ne bougent pas : ce serait changer dans leur dos ce que des apprenants voient peut-être déjà.
      </p>
    </section>
  </div>;
}
