'use client';

/**
 * L'éditeur du formulaire d'inscription d'un programme.
 *
 * Ce formulaire n'est pas un questionnaire de plus : dans un organisme de
 * cette taille, il tient lieu d'entretien préalable. C'est là que la personne
 * dit d'où elle part, qui paie, et ce qu'il faudrait aménager pour elle. Ses
 * réponses deviennent la trace de positionnement de son inscription, ce que
 * l'indicateur 8 du référentiel demande de pouvoir montrer.
 *
 * D'où deux partis pris. Le formulaire se définit sur le PROGRAMME, parce
 * qu'un programme tourne plusieurs fois et que refaire le formulaire à chaque
 * date est l'endroit exact où les versions divergent. Et l'écran se termine
 * par « la suite » : le message de confirmation et le lien de rendez-vous,
 * proposés au moment où la personne est encore devant son écran, plutôt que
 * dans un e-mail qu'elle ouvrira peut-être.
 */

import { useEffect, useState } from 'react';

const panneau = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 };
const attenue = { color: 'var(--text-3)', fontSize: 12.5, lineHeight: 1.55 };
const champ = {
  width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--surface-2)', color: 'var(--text)', padding: '9px 11px', font: 'inherit', fontSize: 13,
};
const primaire = { border: 0, borderRadius: 8, padding: '10px 14px', background: 'var(--gold)', color: '#171613', fontWeight: 750, cursor: 'pointer' };
const discret = { border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', background: 'var(--surface-2)', color: 'var(--text)', fontWeight: 650, cursor: 'pointer' };

const TYPES = [
  ['texte', 'Texte court'],
  ['zone', 'Texte long'],
  ['email', 'Adresse e-mail'],
  ['tel', 'Téléphone'],
  ['liste', 'Choix dans une liste'],
  ['case', 'Case à cocher'],
];

const cleDepuis = (libelle, rang) => libelle
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  .slice(0, 40) || `champ_${rang}`;

export default function EditeurFormulaireInscription({ formationId }) {
  const [socle, setSocle] = useState([]);
  const [champs, setChamps] = useState([]);
  const [suite, setSuite] = useState({ message: '', lienRdv: '', libelleRdv: '', texteRdv: '' });
  const [personnalise, setPersonnalise] = useState(false);
  const [etat, setEtat] = useState('chargement');
  const [avis, setAvis] = useState('');

  useEffect(() => {
    let vivant = true;
    fetch(`/api/formations/${formationId}/formulaire-inscription`)
      .then((r) => r.json())
      .then((d) => {
        if (!vivant) return;
        setSocle(d.socle || []);
        setChamps(d.champs || []);
        setSuite(d.suite || {});
        setPersonnalise(Boolean(d.personnalise));
        setEtat('pret');
      })
      .catch(() => { if (vivant) setEtat('erreur'); });
    return () => { vivant = false; };
  }, [formationId]);

  const modifier = (i, patch) => setChamps((c) => c.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const retirer = (i) => setChamps((c) => c.filter((_, j) => j !== i));
  const deplacer = (i, pas) => setChamps((c) => {
    const j = i + pas;
    if (j < 0 || j >= c.length) return c;
    const copie = [...c];
    [copie[i], copie[j]] = [copie[j], copie[i]];
    return copie;
  });
  const ajouter = () => setChamps((c) => [...c, {
    cle: `champ_${c.length + 1}`, libelle: '', type: 'texte', obligatoire: false, aide: '', options: [],
  }]);

  const enregistrer = async () => {
    setEtat('envoi'); setAvis('');
    try {
      const charge = champs.map((c, i) => ({ ...c, cle: c.cle?.startsWith('champ_') ? cleDepuis(c.libelle || '', i + 1) : c.cle }));
      const r = await fetch(`/api/formations/${formationId}/formulaire-inscription`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ champs: charge, suite }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Enregistrement refusé');
      setChamps(d.champs); setSuite(d.suite); setPersonnalise(true);
      setAvis('Formulaire enregistré. Toutes les sessions de ce programme l’utilisent désormais.');
    } catch (e) { setAvis(e.message); }
    finally { setEtat('pret'); }
  };

  if (etat === 'chargement') return <div style={panneau}><p style={attenue}>Chargement du formulaire…</p></div>;
  if (etat === 'erreur') return <div style={panneau}><p style={attenue}>Impossible de charger le formulaire d’inscription.</p></div>;

  return <div style={{ display: 'grid', gap: 16 }}>
    <div style={panneau}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 4 }}>Formulaire d’inscription</h2>
          <p style={{ ...attenue, margin: 0, maxWidth: 700 }}>
            Ce que vous demandez à quelqu’un qui s’inscrit à une session de ce programme. Il tient lieu
            d’entretien préalable : les réponses deviennent la trace de positionnement de l’inscription.
            {personnalise ? '' : ' Rien n’est encore réglé : les questions ci-dessous sont celles par défaut.'}
          </p>
        </div>
        <button type="button" style={primaire} onClick={enregistrer} disabled={etat === 'envoi'}>
          {etat === 'envoi' ? 'Enregistrement…' : 'Enregistrer le formulaire'}
        </button>
      </div>
      {avis && <p role="status" style={{ background: 'var(--surface-2)', padding: 11, borderRadius: 8, color: 'var(--text-2)', fontSize: 13, marginBottom: 0 }}>{avis}</p>}
    </div>

    <div style={panneau}>
      <h3 style={{ marginTop: 0, fontSize: 15 }}>Toujours demandé</h3>
      <p style={{ ...attenue, marginTop: 0 }}>
        L’identité ne se règle pas : sans elle il n’y a pas d’inscription, et c’est l’adresse e-mail
        qui rattache la demande à une fiche apprenant existante.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {socle.map((c) => <span key={c.cle} style={{ ...attenue, border: '1px solid var(--border)', borderRadius: 999, padding: '6px 12px', color: 'var(--text-2)' }}>{c.libelle}</span>)}
      </div>
    </div>

    <div style={panneau}>
      <h3 style={{ marginTop: 0, fontSize: 15 }}>Vos questions</h3>
      {champs.length ? <div style={{ display: 'grid', gap: 12 }}>
        {champs.map((c, i) => <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--surface-2)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 2fr) minmax(150px, 1fr) auto', gap: 10, alignItems: 'center' }}>
            <input value={c.libelle} placeholder="Intitulé de la question" onChange={(e) => modifier(i, { libelle: e.target.value })} style={champ} />
            <select value={c.type} onChange={(e) => modifier(i, { type: e.target.value })} style={champ}>
              {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" style={discret} title="Monter" onClick={() => deplacer(i, -1)}>↑</button>
              <button type="button" style={discret} title="Descendre" onClick={() => deplacer(i, 1)}>↓</button>
              <button type="button" style={discret} title="Retirer" onClick={() => retirer(i)}>✕</button>
            </div>
          </div>
          <input
            value={c.aide || ''}
            placeholder="Précision affichée sous la question (facultatif)"
            onChange={(e) => modifier(i, { aide: e.target.value })}
            style={{ ...champ, marginTop: 9 }}
          />
          {c.type === 'liste' && <textarea
            value={(c.options || []).join('\n')}
            placeholder="Une réponse possible par ligne"
            onChange={(e) => modifier(i, { options: e.target.value.split('\n') })}
            rows={4}
            style={{ ...champ, marginTop: 9, resize: 'vertical' }}
          />}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={Boolean(c.obligatoire)} onChange={(e) => modifier(i, { obligatoire: e.target.checked })} />
            Réponse obligatoire
          </label>
        </div>)}
      </div> : <p style={attenue}>Aucune question. Le formulaire ne demandera que l’identité.</p>}
      <button type="button" style={{ ...discret, marginTop: 12 }} onClick={ajouter}>Ajouter une question</button>
    </div>

    <div style={panneau}>
      <h3 style={{ marginTop: 0, fontSize: 15 }}>Une fois le formulaire envoyé</h3>
      <p style={{ ...attenue, marginTop: 0, maxWidth: 700 }}>
        Le formulaire recueille le besoin, mais il ne remplace pas l’échange quand le dossier le mérite.
        Proposez le rendez-vous ici, tant que la personne est devant son écran : c’est là qu’elle le prend.
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        <label style={{ display: 'grid', gap: 5, fontSize: 12.5, color: 'var(--text-3)' }}>Message de confirmation
          <textarea rows={2} value={suite.message || ''} onChange={(e) => setSuite((s) => ({ ...s, message: e.target.value }))} style={{ ...champ, resize: 'vertical' }} />
        </label>
        <label style={{ display: 'grid', gap: 5, fontSize: 12.5, color: 'var(--text-3)' }}>Lien de prise de rendez-vous (Calendly ou autre, en https)
          <input value={suite.lienRdv || ''} placeholder="https://calendly.com/…" onChange={(e) => setSuite((s) => ({ ...s, lienRdv: e.target.value }))} style={champ} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          <label style={{ display: 'grid', gap: 5, fontSize: 12.5, color: 'var(--text-3)' }}>Texte d’accompagnement
            <input value={suite.texteRdv || ''} onChange={(e) => setSuite((s) => ({ ...s, texteRdv: e.target.value }))} style={champ} />
          </label>
          <label style={{ display: 'grid', gap: 5, fontSize: 12.5, color: 'var(--text-3)' }}>Libellé du bouton
            <input value={suite.libelleRdv || ''} onChange={(e) => setSuite((s) => ({ ...s, libelleRdv: e.target.value }))} style={champ} />
          </label>
        </div>
      </div>
    </div>
  </div>;
}
