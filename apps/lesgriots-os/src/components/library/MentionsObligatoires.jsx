'use client';

/**
 * Les mentions obligatoires d'un programme, héritées de l'organisme.
 *
 * Ces quatre textes décrivent la maison, pas le programme : les faire saisir
 * quinze fois, c'est garantir qu'au bout d'un an quinze versions circulent et
 * qu'un auditeur tombe sur celle qu'on a oublié de corriger. Ils s'écrivent
 * donc une fois dans les réglages de l'organisme, et cet écran montre ce dont
 * le programme hérite.
 *
 * L'exception reste possible et se voit : une formation à distance n'a pas
 * les mêmes moyens techniques qu'une formation en salle. Écrire un texte ici
 * détache la mention de l'organisme, et l'écran le dit en clair, avec de quoi
 * revenir en arrière.
 */

import { useEffect, useState } from 'react';

const panneau = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 };
const attenue = { color: 'var(--text-3)', fontSize: 12.5, lineHeight: 1.55 };
const zone = {
  width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--surface-2)', color: 'var(--text)', padding: '10px 11px', font: 'inherit',
  fontSize: 13, lineHeight: 1.55, resize: 'vertical',
};
const primaire = { border: 0, borderRadius: 8, padding: '10px 14px', background: 'var(--gold)', color: '#171713', fontWeight: 750, cursor: 'pointer' };
const discret = { border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', background: 'var(--surface-2)', color: 'var(--text)', fontWeight: 650, cursor: 'pointer', fontSize: 12.5 };

const MENTIONS = [
  { champ: 'modalites_pedagogiques', reglage: 'mention_methodes', titre: 'Méthodes pédagogiques' },
  { champ: 'moyens_materiels', reglage: 'mention_moyens', titre: 'Moyens techniques et pédagogiques' },
  { champ: 'accessibility', reglage: 'mention_accessibilite', titre: 'Accessibilité et situation de handicap' },
  { champ: 'delais_acces', reglage: 'mention_delais', titre: 'Délais d’accès' },
];

export default function MentionsObligatoires({ formationId, formation, onEnregistre }) {
  const [reglages, setReglages] = useState(null);
  const [propre, setPropre] = useState({});
  const [etat, setEtat] = useState('chargement');
  const [avis, setAvis] = useState('');

  useEffect(() => {
    setPropre(Object.fromEntries(MENTIONS.map((m) => [m.champ, formation?.[m.champ] || ''])));
  }, [formation]);

  useEffect(() => {
    let vivant = true;
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => { if (vivant) { setReglages(d || {}); setEtat('pret'); } })
      .catch(() => { if (vivant) setEtat('erreur'); });
    return () => { vivant = false; };
  }, []);

  const resolue = (m) => {
    const local = String(propre[m.champ] || '').trim();
    if (local) return { valeur: local, origine: 'programme' };
    const herite = String(reglages?.[m.reglage] || '').trim();
    if (herite) return { valeur: herite, origine: 'organisme' };
    return { valeur: '', origine: 'absente' };
  };

  const absentes = MENTIONS.filter((m) => resolue(m).origine === 'absente');

  const enregistrer = async () => {
    setEtat('envoi'); setAvis('');
    try {
      const r = await fetch(`/api/formations/${formationId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(MENTIONS.map((m) => [m.champ, propre[m.champ] || '']))),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Enregistrement refusé');
      setAvis('Exceptions enregistrées pour ce programme.');
      onEnregistre?.(d);
    } catch (e) { setAvis(e.message); }
    finally { setEtat('pret'); }
  };

  if (etat === 'chargement') return <div style={panneau}><p style={attenue}>Chargement…</p></div>;
  if (etat === 'erreur') return <div style={panneau}><p style={attenue}>Impossible de lire les réglages de l’organisme.</p></div>;

  return <div style={panneau}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ marginTop: 0, marginBottom: 4 }}>Mentions obligatoires</h2>
        <p style={{ ...attenue, margin: 0, maxWidth: 720 }}>
          Ces quatre mentions décrivent l’organisme, pas ce programme. Elles s’écrivent une seule fois
          dans <a href="/parametres-formation" style={{ color: 'var(--gold)' }}>les réglages de l’organisme</a>,
          et tous les programmes en héritent. Vous n’avez rien à recopier ici.
        </p>
      </div>
    </div>

    <p style={{ ...attenue, marginTop: 12, color: absentes.length ? 'var(--gold)' : 'var(--success)', fontWeight: 700 }}>
      {absentes.length
        ? `${absentes.length} mention(s) manquante(s), ni ici ni dans les réglages : ${absentes.map((m) => m.titre).join(', ')}. Ce programme ne peut pas être publié.`
        : 'Les quatre mentions sont couvertes. Ce programme peut être publié.'}
    </p>

    {avis && <p role="status" style={{ background: 'var(--surface-2)', padding: 11, borderRadius: 8, color: 'var(--text-2)', fontSize: 13 }}>{avis}</p>}

    <div style={{ display: 'grid', gap: 18, marginTop: 10 }}>
      {MENTIONS.map((m) => {
        const r = resolue(m);
        const detache = r.origine === 'programme';
        return <div key={m.champ} style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span style={{ fontSize: 13.5, fontWeight: 750, color: 'var(--text)' }}>{m.titre}</span>
            <span style={{
              ...attenue,
              color: r.origine === 'absente' ? 'var(--gold)' : detache ? 'var(--text-2)' : 'var(--success)',
              fontWeight: 700,
            }}>
              {r.origine === 'absente' ? 'Manquante' : detache ? 'Texte propre à ce programme' : 'Héritée de l’organisme'}
            </span>
          </div>

          {detache
            ? <>
              <textarea rows={5} value={propre[m.champ] || ''} onChange={(e) => setPropre((p) => ({ ...p, [m.champ]: e.target.value }))} style={{ ...zone, marginTop: 8 }} />
              <button type="button" style={{ ...discret, marginTop: 8 }} onClick={() => setPropre((p) => ({ ...p, [m.champ]: '' }))}>
                Revenir au texte de l’organisme
              </button>
            </>
            : <>
              <p style={{ ...attenue, whiteSpace: 'pre-wrap', color: r.valeur ? 'var(--text-2)' : 'var(--text-3)', marginTop: 8, marginBottom: 8 }}>
                {r.valeur || 'Rien n’est écrit dans les réglages de l’organisme. Allez l’écrire là-bas plutôt qu’ici : ce texte servira à tous vos programmes.'}
              </p>
              <button type="button" style={discret} onClick={() => setPropre((p) => ({ ...p, [m.champ]: r.valeur || ' ' }))}>
                Écrire un texte propre à ce programme
              </button>
            </>}
        </div>;
      })}
    </div>

    <div style={{ marginTop: 18 }}>
      <button type="button" style={primaire} onClick={enregistrer} disabled={etat === 'envoi'}>
        {etat === 'envoi' ? 'Enregistrement…' : 'Enregistrer les exceptions de ce programme'}
      </button>
    </div>
  </div>;
}
