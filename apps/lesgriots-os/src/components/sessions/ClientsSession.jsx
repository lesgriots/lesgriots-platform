'use client';

/**
 * Les clients d'une session, et ce qu'ils déclenchent.
 *
 * Une session n'a pas un client, elle en a autant qu'il y a de payeurs.
 * Jusqu'ici la session portait un seul client et un seul tarif : toute
 * session inter-entreprises était donc fausse, et le devis aussi.
 *
 * Le bloc Financement mérite un mot. Ces quatre cases ne sont pas des
 * préférences : elles décident dans quelle ligne du Cerfa l'argent de ce
 * client tombera au moment du BPF. Une case cochée par confort, c'est une
 * déclaration fausse à la DREETS. Chacune porte donc son explication.
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
    opacity: desactive ? .45 : 1, whiteSpace: 'nowrap',
    background: secondaire ? 'var(--surface)' : 'var(--gold)',
    color: secondaire ? 'var(--text)' : 'var(--gold-ink)',
    border: `1.5px solid ${secondaire ? 'var(--border-2)' : 'var(--gold)'}`,
  };
}

/** Les quatre cases du Cerfa, avec ce qu'elles font réellement. */
const CASES_BPF = [
  {
    cle: 'sous_traitance', libelle: 'Situation de sous-traitance',
    aide: 'Un autre organisme de formation te sous-traite cette action. Le montant part alors en ligne 5 du cadre C, « d’autres organismes de formation », et non en ligne 1.',
  },
  {
    cle: 'dispositif_recherche_emploi', libelle: 'Dispositif pour personnes en recherche d’emploi',
    aide: 'France Travail, Région, conseil départemental. Le montant bascule vers la ligne 3, « des pouvoirs publics ».',
  },
  {
    cle: 'bpf_autres_produits', libelle: 'Ligne autres produits (11) du cadre C',
    aide: 'Le cas des clients étrangers et des produits qui n’entrent dans aucune ligne standard.',
  },
  {
    cle: 'bpf_autres_apprenants', libelle: 'Ligne autres apprenants (e) du cadre F1',
    aide: 'Financement inconnu en sous-traitance, ou apprenants qui ne sont pas salariés du client entreprise.',
  },
];

const TYPES_PRIX = ['Formation & frais pédagogiques', 'Frais de déplacement', 'Hébergement et restauration', 'Support et matériel', 'Autre'];
const MODES = ['Par client', 'Par apprenant', 'Forfait session'];

const euros = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(n) || 0);

export default function ClientsSession({ sessionId, onNotice }) {
  const [lignes, setLignes] = useState(null);
  const [entreprises, setEntreprises] = useState([]);
  const [financeurs, setFinanceurs] = useState([]);
  const [occupe, setOccupe] = useState('');
  const [erreur, setErreur] = useState('');

  const charger = async () => {
    try {
      const [l, e, f] = await Promise.all([
        fetch(`/api/sessions/${sessionId}/clients`).then((r) => r.ok ? r.json() : []),
        fetch('/api/clients').then((r) => r.ok ? r.json() : []),
        fetch('/api/financeurs').then((r) => r.ok ? r.json() : []),
      ]);
      setLignes(Array.isArray(l) ? l : []);
      setEntreprises(Array.isArray(e) ? e : (e.items || []));
      setFinanceurs((Array.isArray(f) ? f : []).filter((x) => x.actif !== 0));
    } catch { setErreur('Chargement impossible.'); }
  };
  useEffect(() => { charger(); }, [sessionId]);

  const ajouter = async () => {
    setOccupe('ajout');
    try {
      const r = await fetch(`/api/sessions/${sessionId}/clients`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nb_apprenants_devis: 1, mode_facturation: 'Par client' }),
      });
      if (!r.ok) throw new Error('Ajout impossible');
      await charger();
    } catch (e) { setErreur(e.message); } finally { setOccupe(''); }
  };

  const majuscule = async (cid, patch) => {
    setLignes((c) => c.map((l) => l.id === cid ? { ...l, ...patch } : l));
    try {
      const r = await fetch(`/api/sessions/${sessionId}/clients/${cid}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error('Enregistrement impossible');
    } catch (e) { setErreur(e.message); await charger(); }
  };

  const retirer = async (cid) => {
    setOccupe(cid);
    try {
      await fetch(`/api/sessions/${sessionId}/clients/${cid}`, { method: 'DELETE' });
      await charger();
      onNotice?.('Client retiré de la session.');
    } finally { setOccupe(''); }
  };

  if (!lignes) return <section style={carte}><p style={{ ...attenue, margin: 0 }}>Chargement des clients…</p></section>;

  const total = lignes.reduce((t, l) => t + (Number(l.prix) || 0), 0);
  const apprenantsDevis = lignes.reduce((t, l) => t + (Number(l.nb_apprenants_devis) || 0), 0);

  return <div style={{ display: 'grid', gap: 14 }}>

    <section style={{ ...carte, display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'start' }}>
      <div style={{ maxWidth: 640 }}>
        <h2 style={titre}>Clients de la session</h2>
        <p style={{ ...attenue, margin: '6px 0 0' }}>
          Une session inter-entreprises a plusieurs payeurs. Chacun a son prix, son bon de commande et ses cases de BPF.
          {lignes.length > 0 && <> Aujourd’hui : {lignes.length} client(s), {apprenantsDevis} apprenant(s) au devis, {euros(total)} au total.</>}
        </p>
      </div>
      <button type="button" onClick={ajouter} disabled={occupe === 'ajout'} style={bouton(false, occupe === 'ajout')}>+ Ajouter un client</button>
    </section>

    {erreur && <div style={{ padding: '11px 14px', borderRadius: 10, background: 'var(--danger-soft)', border: '1.5px solid color-mix(in srgb, var(--danger) 40%, transparent)', fontSize: 13, fontWeight: 700 }}>{erreur}</div>}

    {lignes.length === 0 && <section style={{ ...carte, borderStyle: 'dashed', textAlign: 'center', ...attenue, padding: '30px 16px' }}>
      Aucun client rattaché. Sans client, ni devis ni facture, et la session ne compte pas dans le BPF.
    </section>}

    {lignes.map((l) => <section key={l.id} style={carte}>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <b style={{ fontSize: 15 }}>{l.client_nom || 'Client à choisir'}</b>
        <button type="button" disabled={occupe === l.id} onClick={() => retirer(l.id)} style={{ ...bouton(true, occupe === l.id), color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)' }}>Retirer</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 14 }}>
        <label style={{ display: 'grid', gap: 5 }}>
          <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>Entreprise</span>
          <select value={l.client_id || ''} onChange={(e) => majuscule(l.id, { client_id: e.target.value })} style={champ}>
            <option value="">Choisir une entreprise</option>
            {entreprises.map((c) => <option key={c.id} value={c.id}>{c.company || `${c.first_name} ${c.last_name}`}</option>)}
          </select>
          {l.client_id && <a href={`/entreprises/${l.client_id}`} style={{ ...attenue, fontSize: 11.5, color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>Ouvrir sa fiche →</a>}
        </label>
        <label style={{ display: 'grid', gap: 5 }}>
          <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>Commercial</span>
          <input value={l.commercial || ''} onChange={(e) => majuscule(l.id, { commercial: e.target.value })} style={champ} />
        </label>
        <label style={{ display: 'grid', gap: 5 }}>
          <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>Apprenants comptés au devis</span>
          <input type="number" min="0" value={l.nb_apprenants_devis ?? 0} onChange={(e) => majuscule(l.id, { nb_apprenants_devis: Number(e.target.value) })} style={champ} />
        </label>
      </div>

      {/* ── Prix ── */}
      <div style={{ marginTop: 18, padding: 14, borderRadius: 11, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 14 }}>
          <label style={{ display: 'grid', gap: 5 }}>
            <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>Type de prix</span>
            <select value={l.type_prix || TYPES_PRIX[0]} onChange={(e) => majuscule(l.id, { type_prix: e.target.value })} style={champ}>
              {TYPES_PRIX.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 5 }}>
            <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>Mode de facturation</span>
            <select value={l.mode_facturation || MODES[0]} onChange={(e) => majuscule(l.id, { mode_facturation: e.target.value })} style={champ}>
              {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 5 }}>
            <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>Prix HT</span>
            <input type="number" min="0" step="0.01" value={l.prix ?? 0} onChange={(e) => majuscule(l.id, { prix: Number(e.target.value) })} style={champ} />
          </label>
          <label style={{ display: 'grid', gap: 5 }}>
            <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>TVA %</span>
            <input type="number" min="0" step="0.1" value={l.tva ?? 0} onChange={(e) => majuscule(l.id, { tva: Number(e.target.value) })} style={champ} />
            <span style={{ ...attenue, fontSize: 11 }}>0 % si tu es exonéré au titre de la formation professionnelle.</span>
          </label>
        </div>
        <label style={{ display: 'grid', gap: 5, marginTop: 12 }}>
          <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>Description sur le devis</span>
          <input value={l.description_prix || ''} onChange={(e) => majuscule(l.id, { description_prix: e.target.value })} placeholder="Formation" style={champ} />
        </label>
        <div style={{ marginTop: 12, textAlign: 'right', fontSize: 14, fontWeight: 800 }}>
          Total {euros((Number(l.prix) || 0) * (1 + (Number(l.tva) || 0) / 100))} TTC
        </div>
      </div>

      {/* ── Références comptables ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 14, marginTop: 16 }}>
        <label style={{ display: 'grid', gap: 5 }}>
          <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>Code client comptable</span>
          <input value={l.code_client_comptable || ''} onChange={(e) => majuscule(l.id, { code_client_comptable: e.target.value })} style={champ} />
          <span style={{ ...attenue, fontSize: 11 }}>Laisse vide pour reprendre celui de la fiche entreprise.</span>
        </label>
        <label style={{ display: 'grid', gap: 5 }}>
          <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>Numéro de bon de commande</span>
          <input value={l.bon_commande || ''} onChange={(e) => majuscule(l.id, { bon_commande: e.target.value })} style={champ} />
          <span style={{ ...attenue, fontSize: 11 }}>Beaucoup de grands comptes rejettent une facture sans lui.</span>
        </label>
      </div>

      {/* ── Financeur externe ── */}
      <div style={{ marginTop: 18 }}>
        <b style={{ fontSize: 13.5 }}>Financeur externe</b>
        <p style={{ ...attenue, margin: '4px 0 12px' }}>
          Quand un organisme paie à la place du client. Avec subrogation, il te règle en direct ; sans elle, tu factures le client, qui se fait rembourser de son côté.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 14 }}>
          <label style={{ display: 'grid', gap: 5 }}>
            <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>Financeur</span>
            <select value={l.financeur_id || ''} onChange={(e) => majuscule(l.id, { financeur_id: e.target.value })} style={champ}>
              <option value="">Aucun</option>
              {financeurs.map((f) => <option key={f.id} value={f.id}>{f.nom}{f.type ? ` · ${f.type}` : ''}</option>)}
            </select>
            {!financeurs.length && <span style={{ ...attenue, fontSize: 11 }}>Aucune fiche financeur. Crée-les dans Données puis Financeurs.</span>}
          </label>
          <label style={{ display: 'grid', gap: 5 }}>
            <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>Montant pris en charge</span>
            <input type="number" min="0" step="0.01" value={l.montant_finance ?? 0} onChange={(e) => majuscule(l.id, { montant_finance: Number(e.target.value) })} style={champ} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, alignSelf: 'end', paddingBottom: 6 }}>
            <input type="checkbox" checked={Boolean(l.subrogation)} onChange={(e) => majuscule(l.id, { subrogation: e.target.checked ? 1 : 0 })} style={{ width: 17, height: 17, accentColor: 'var(--gold)' }} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Subrogation de paiement</span>
          </label>
        </div>
      </div>

      {/* ── Les cases qui décident du BPF ── */}
      <div style={{ marginTop: 18, padding: 14, borderRadius: 11, border: '1.5px solid color-mix(in srgb, var(--gold) 40%, transparent)', background: 'var(--gold-soft)' }}>
        <b style={{ fontSize: 13.5 }}>Financement et BPF</b>
        <p style={{ ...attenue, margin: '4px 0 12px', color: 'var(--text)' }}>
          Ces cases décident de la ligne du Cerfa où tombera l’argent de ce client. Une case cochée par confort, c’est une déclaration fausse à la DREETS.
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          {CASES_BPF.map((c) => <label key={c.cle} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0, 1fr)', gap: 11, cursor: 'pointer' }}>
            <input type="checkbox" checked={Boolean(l[c.cle])} onChange={(e) => majuscule(l.id, { [c.cle]: e.target.checked ? 1 : 0 })} style={{ width: 17, height: 17, marginTop: 2, accentColor: 'var(--gold)' }} />
            <span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{c.libelle}</span>
              <span style={{ ...attenue, display: 'block', marginTop: 2 }}>{c.aide}</span>
            </span>
          </label>)}
        </div>
      </div>
    </section>)}
  </div>;
}
