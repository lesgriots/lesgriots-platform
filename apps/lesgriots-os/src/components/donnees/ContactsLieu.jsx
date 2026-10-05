'use client';
/**
 * Les contacts d'un lieu de formation.
 *
 * Un lieu a rarement un seul interlocuteur : celui qui réserve la salle,
 * celui qui ouvre la porte le jour J, celui qui a négocié le prêt. Chacun
 * porte un rôle, pour savoir qui appeler pour quoi.
 */
import { useCallback, useEffect, useState } from 'react';
import { bouton, styleCarte as carte, styleAttenue as attenue, styleTitre as titre } from '@/components/donnees/FicheEntite';

const ROLES = [
  'Réservation de la salle',
  'Accueil sur place',
  'Décisionnaire / partenariat',
  'Technique',
  'Facturation',
  'Autre',
];

const champ = {
  width: '100%', boxSizing: 'border-box', padding: '9px 10px',
  border: '1px solid var(--border-2)', borderRadius: 8,
  background: 'var(--surface-2)', color: 'var(--text)', font: 'inherit', fontSize: 13,
};
const etiquette = { ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 };

/** Défini hors du parent, sinon le champ perd le focus à chaque lettre tapée. */
function Formulaire({ valeur, onChange, onValider, onAnnuler, occupe }) {
  const maj = (cle) => (e) => onChange({ ...valeur, [cle]: e.target.value });
  return (
    <div style={{ padding: 14, border: '1.5px solid color-mix(in srgb, var(--gold) 45%, transparent)', borderRadius: 10, background: 'var(--gold-soft)', display: 'grid', gap: 11 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 11 }}>
        {[['firstName', 'Prénom'], ['lastName', 'Nom'], ['organisation', 'Structure'], ['email', 'E-mail'], ['phone', 'Téléphone']].map(([cle, lib]) => (
          <label key={cle} style={{ display: 'grid', gap: 4 }}>
            <span style={etiquette}>{lib}</span>
            <input value={valeur[cle] || ''} onChange={maj(cle)} style={champ} />
          </label>
        ))}
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={etiquette}>Rôle</span>
          <input list="roles-contact-lieu" value={valeur.role || ''} onChange={maj('role')} style={champ} placeholder="Choisir ou écrire" />
          <datalist id="roles-contact-lieu">{ROLES.map((r) => <option key={r} value={r} />)}</datalist>
        </label>
      </div>
      <label style={{ display: 'grid', gap: 4 }}>
        <span style={etiquette}>Notes</span>
        <textarea rows={2} value={valeur.notes || ''} onChange={maj('notes')} style={{ ...champ, resize: 'vertical' }} />
      </label>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
        <button type="button" disabled={occupe} onClick={onValider} style={bouton(false, occupe)}>{occupe ? 'Enregistrement…' : 'Enregistrer le contact'}</button>
        <button type="button" onClick={onAnnuler} style={bouton(true)}>Annuler</button>
      </div>
    </div>
  );
}

export default function ContactsLieu({ lieuId }) {
  const vide = { firstName: '', lastName: '', organisation: '', role: '', email: '', phone: '', notes: '' };
  const [contacts, setContacts] = useState([]);
  const [ajout, setAjout] = useState(null);
  const [edition, setEdition] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    const r = await fetch(`/api/lieux-formation/${lieuId}/contacts`);
    const d = r.ok ? await r.json() : [];
    setContacts(Array.isArray(d) ? d : []);
  }, [lieuId]);
  useEffect(() => { charger(); }, [charger]);

  const enregistrer = async (c) => {
    if (!String(c.lastName || '').trim() && !String(c.firstName || '').trim()) { setErreur('Un contact a besoin d’un nom.'); return; }
    setOccupe(true); setErreur('');
    try {
      const url = c.id ? `/api/lieux-formation/${lieuId}/contacts/${c.id}` : `/api/lieux-formation/${lieuId}/contacts`;
      const r = await fetch(url, { method: c.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
      if (!r.ok) throw new Error('Enregistrement impossible');
      setAjout(null); setEdition(null);
      await charger();
    } catch (e) { setErreur(e.message); } finally { setOccupe(false); }
  };

  const retirer = async (c) => {
    setOccupe(true); setErreur('');
    try {
      const r = await fetch(`/api/lieux-formation/${lieuId}/contacts/${c.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Suppression impossible');
      await charger();
    } catch (e) { setErreur(e.message); } finally { setOccupe(false); }
  };

  return <section style={carte}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'start' }}>
      <div>
        <h2 style={titre}>Contacts du lieu</h2>
        <p style={{ ...attenue, margin: '6px 0 0', maxWidth: 620 }}>
          Qui appeler pour quoi : réserver la salle, ouvrir la porte le jour J, renégocier les conditions.
        </p>
      </div>
      {!ajout && <button type="button" onClick={() => { setAjout({ ...vide }); setEdition(null); }} style={bouton(false)}>+ Ajouter un contact</button>}
    </div>

    {erreur && <div style={{ marginTop: 12, padding: '10px 13px', borderRadius: 9, background: 'var(--danger-soft)', border: '1.5px solid color-mix(in srgb, var(--danger) 40%, transparent)', fontSize: 12.5, fontWeight: 700 }}>{erreur}</div>}

    <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
      {ajout && <Formulaire valeur={ajout} onChange={setAjout} occupe={occupe} onValider={() => enregistrer(ajout)} onAnnuler={() => { setAjout(null); setErreur(''); }} />}

      {contacts.map((c) => edition?.id === c.id
        ? <Formulaire key={c.id} valeur={edition} onChange={setEdition} occupe={occupe} onValider={() => enregistrer(edition)} onAnnuler={() => { setEdition(null); setErreur(''); }} />
        : <div key={c.id} style={{ padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface-2)', display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <b style={{ fontSize: 13.5 }}>{[c.firstName, c.lastName].filter(Boolean).join(' ') || 'Sans nom'}</b>
                {c.organisation && <span style={{ ...attenue, marginLeft: 8 }}>{c.organisation}</span>}
                <div style={{ marginTop: 4 }}>
                  <span style={{
                    display: 'inline-block', padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                    background: c.role ? 'var(--gold-soft)' : 'var(--surface-3)', color: c.role ? 'var(--text)' : 'var(--text-3)',
                    border: `1px solid ${c.role ? 'color-mix(in srgb, var(--gold) 40%, transparent)' : 'var(--border)'}`,
                  }}>{c.role || 'Rôle à définir'}</span>
                </div>
              </div>
              <div style={{ ...attenue, textAlign: 'right', minWidth: 0 }}>
                {c.email ? <a href={`mailto:${c.email}`} style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>{c.email}</a> : 'Sans e-mail'}
                <br />{c.phone ? <a href={`tel:${c.phone.replace(/\s/g, '')}`} style={{ color: 'inherit', textDecoration: 'none' }}>{c.phone}</a> : ''}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => { setEdition({ ...c }); setAjout(null); }} style={bouton(true)}>Modifier</button>
                <button type="button" disabled={occupe} onClick={() => retirer(c)} style={{ ...bouton(true, occupe), color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)' }}>Retirer</button>
              </div>
            </div>
            {c.notes && <div style={{ ...attenue, fontSize: 12 }}>{c.notes}</div>}
          </div>)}

      {!contacts.length && !ajout && <p style={{ ...attenue, margin: 0 }}>Aucun contact enregistré pour ce lieu.</p>}
    </div>
  </section>;
}
