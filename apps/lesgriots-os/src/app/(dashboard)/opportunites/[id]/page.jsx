'use client';

/**
 * /opportunites/[id] — la fiche d'une affaire.
 *
 * Le reproche fondateur : « quand je bouge un truc dans le pipeline, je veux
 * pouvoir cliquer et entrer dans l'outil ». Une carte qu'on déplace sans
 * pouvoir l'ouvrir ne fait que décorer. Cette fiche est la porte.
 *
 * Elle tient deux promesses. D'abord tout ce qui décide de l'affaire est là :
 * le client, le montant, l'étape, le contact, le bon de commande. Ensuite,
 * chaque bouton mène quelque part de réel : la session se crée depuis ici,
 * le devis et la facture se génèrent, la fiche entreprise s'ouvre, et le
 * journal garde la trace de chaque déplacement, avec sa date.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/layout/TopBar';
import { bouton, styleCarte as carte, styleAttenue as attenue, styleTitre as titre } from '@/components/donnees/FicheEntite';

const ETAPES = [
  ['prospect', 'Prospect'],
  ['besoin', 'Besoin identifié'],
  ['devis_envoye', 'Devis envoyé'],
  ['convention_signee', 'Convention signée'],
  ['financement_valide', 'Financement validé'],
  ['session_planifiee', 'Session planifiée'],
  ['perdu', 'Perdue'],
];
const ETAPE_LIBELLE = Object.fromEntries(ETAPES);

const euros = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const dateFr = (v) => {
  if (!v) return '—';
  const d = new Date(String(v).includes('T') ? v : `${String(v).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};
const dateHeureFr = (v) => {
  if (!v) return '';
  const d = new Date(String(v).includes('T') ? v : `${String(v).replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const saisie = {
  width: '100%', boxSizing: 'border-box', padding: '10px 11px',
  border: '1px solid var(--border-2)', borderRadius: 9,
  background: 'var(--surface-2)', color: 'var(--text)', font: 'inherit', fontSize: 13,
};

function Trio({ libelle, valeur, lien }) {
  const contenu = <><div style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800 }}>{libelle}</div>
    <div style={{ fontSize: 14, fontWeight: 700, color: lien ? 'var(--gold)' : 'var(--text)', marginTop: 3 }}>{valeur}</div></>;
  return lien
    ? <Link href={lien} style={{ textDecoration: 'none', flex: '1 1 180px' }}>{contenu}</Link>
    : <div style={{ flex: '1 1 180px' }}>{contenu}</div>;
}

export default function FicheOpportunitePage() {
  const params = useParams();
  const routeur = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [aff, setAff] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [clients, setClients] = useState([]);
  const [onglet, setOnglet] = useState('infos');
  const [bonCommande, setBonCommande] = useState('');
  const [note, setNote] = useState('');
  const [rattacher, setRattacher] = useState('');
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState('');

  const charger = async () => {
    try {
      const [o, ss, cs] = await Promise.all([
        fetch(`/api/formation-opportunities/${id}`).then((r) => r.ok ? r.json() : Promise.reject(new Error('Opportunité introuvable'))),
        fetch('/api/sessions').then((r) => r.ok ? r.json() : []),
        fetch('/api/clients').then((r) => r.ok ? r.json() : []),
      ]);
      setAff(o); setBonCommande(o.bon_commande || '');
      setSessions(Array.isArray(ss) ? ss : (ss.items || []));
      setClients(Array.isArray(cs) ? cs : (cs.items || []));
    } catch (e) { setErreur(e.message); }
  };
  useEffect(() => { charger(); }, [id]);

  const majuscule = async (patch, texte) => {
    setOccupe('maj'); setErreur(''); setMessage('');
    try {
      const r = await fetch(`/api/formation-opportunities/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Mise à jour impossible');
      await charger();
      if (texte) setMessage(texte);
    } catch (e) { setErreur(e.message); } finally { setOccupe(''); }
  };

  /** Créer la session de formation à partir de cette affaire. */
  const creerSession = async () => {
    if (!aff.formation_id) { setErreur('Rattache d’abord un programme du catalogue à cette opportunité.'); return; }
    const debut = aff.date_session_prevue || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    setOccupe('session'); setErreur(''); setMessage('');
    try {
      const r = await fetch('/api/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formation_id: aff.formation_id, start_date: debut, end_date: debut,
          tarif: Number(aff.revenue) || 0, client_id: aff.client_id || null,
          type_session: aff.company ? 'INTRA' : 'INTER', status: 'planned',
        }),
      });
      const s = await r.json();
      if (!r.ok) throw new Error(s.error || 'Création impossible');
      await majuscule({ session_id: s.id, stage: 'session_planifiee' });
      routeur.push(`/sessions/${s.id}`);
    } catch (e) { setErreur(e.message); setOccupe(''); }
  };

  const ajouterNote = async () => {
    if (!note.trim()) return;
    setOccupe('note');
    try {
      await fetch(`/api/formation-opportunities/${id}/evenements`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texte: note.trim() }),
      });
      setNote(''); await charger();
    } finally { setOccupe(''); }
  };

  const entreprise = useMemo(
    () => clients.find((c) => c.id === aff?.client_id)
      || clients.find((c) => (c.company || '').toLowerCase() === String(aff?.company || '').toLowerCase() && aff?.company),
    [clients, aff],
  );

  if (!aff) return <><TopBar title="Opportunité" /><div style={{ padding: 24, ...attenue }}>{erreur || 'Chargement…'}</div></>;

  const sessionsLibres = sessions.filter((s) => !s.archived);

  return <>
    <TopBar title={aff.company || aff.client_name || 'Opportunité'} subtitle={aff.formation_title || 'Programme à rattacher'} />
    <div style={{ padding: '0 24px 48px', maxWidth: 1100, width: '100%', boxSizing: 'border-box', display: 'grid', gap: 16 }}>
      <Link href="/pipeline-formations" style={{ ...attenue, textDecoration: 'none' }}>← Tunnel de vente</Link>

      <div role="tablist" style={{ display: 'inline-flex', gap: 4, padding: 4, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, alignSelf: 'start' }}>
        {[['infos', 'Informations et session'], ['suivi', 'Suivi de l’opportunité']].map(([cle, lib]) => (
          <button key={cle} type="button" role="tab" aria-selected={onglet === cle} onClick={() => setOnglet(cle)} style={{
            border: `1.5px solid ${onglet === cle ? 'var(--gold)' : 'transparent'}`,
            background: onglet === cle ? 'var(--gold)' : 'transparent',
            color: onglet === cle ? 'var(--gold-ink)' : 'var(--text-2)',
            padding: '9px 15px', borderRadius: 9, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}>{lib}</button>
        ))}
      </div>

      {message && <div style={{ padding: '11px 14px', borderRadius: 10, background: 'var(--success-soft)', border: '1.5px solid color-mix(in srgb, var(--success) 40%, transparent)', fontSize: 13, fontWeight: 700 }}>{message}</div>}
      {erreur && <div style={{ padding: '11px 14px', borderRadius: 10, background: 'var(--danger-soft)', border: '1.5px solid color-mix(in srgb, var(--danger) 40%, transparent)', fontSize: 13, fontWeight: 700 }}>{erreur}</div>}

      {onglet === 'infos' ? <>

        <section style={{ ...carte, display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <Trio libelle="Montant" valeur={euros(aff.revenue)} />
          <Trio libelle="Financement" valeur={aff.financement || 'À définir'} />
          <Trio libelle="Entreprise" valeur={entreprise ? (entreprise.company || 'Fiche client') : (aff.company || 'Particulier')} lien={entreprise ? `/entreprises/${entreprise.id}` : undefined} />
          <label style={{ display: 'grid', gap: 5, flex: '1 1 220px' }}>
            <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800 }}>Étape</span>
            <select value={aff.stage || ''} onChange={(e) => majuscule({ stage: e.target.value }, `Affaire déplacée en « ${ETAPE_LIBELLE[e.target.value]} ».`)} style={saisie}>
              {ETAPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
        </section>

        <section style={carte}>
          <h2 style={titre}>Contact</h2>
          <p style={{ ...attenue, margin: '6px 0 14px' }}>La personne qui décide. Sans son e-mail, ni devis ni convention ne partent.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 14 }}>
            {[['contact_name', 'Nom du contact'], ['client_email', 'E-mail'], ['client_phone', 'Téléphone']].map(([cle, lib]) => (
              <label key={cle} style={{ display: 'grid', gap: 5 }}>
                <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>{lib}</span>
                <input value={aff[cle] || ''} onChange={(e) => setAff((c) => ({ ...c, [cle]: e.target.value }))} onBlur={() => majuscule({ [cle]: aff[cle] })} style={saisie} />
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 14 }}>
            {aff.client_email && <a href={`mailto:${aff.client_email}`} style={bouton(true)}>✉ Écrire au contact</a>}
            {entreprise && <Link href={`/entreprises/${entreprise.id}`} style={bouton(true)}>Ouvrir la fiche entreprise →</Link>}
          </div>
        </section>

        <section style={carte}>
          <h2 style={titre}>Session de formation</h2>
          {aff.session ? <>
            <p style={{ ...attenue, margin: '6px 0 14px' }}>
              Session du {dateFr(aff.session.start_date)} · {aff.session.inscrits} inscrit(s) · {euros(aff.session.tarif)}
            </p>
            <Link href={`/sessions/${aff.session.id}`} style={bouton(false)}>Ouvrir la session →</Link>
          </> : <>
            <p style={{ ...attenue, margin: '6px 0 14px' }}>
              Aucune session n’est encore rattachée. Crée-la depuis ici : le programme, le tarif et le client sont repris automatiquement.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 14, marginBottom: 14 }}>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>Date visée</span>
                <input type="date" value={aff.date_session_prevue || ''} onChange={(e) => setAff((c) => ({ ...c, date_session_prevue: e.target.value }))} onBlur={() => majuscule({ date_session_prevue: aff.date_session_prevue })} style={saisie} />
              </label>
              <label style={{ display: 'grid', gap: 5 }}>
                <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>Ou rattacher à une session existante</span>
                <select value={rattacher} onChange={(e) => setRattacher(e.target.value)} style={saisie}>
                  <option value="">Choisir une session</option>
                  {sessionsLibres.map((s) => <option key={s.id} value={s.id}>{s.formation_title || s.session_name || s.id} · {dateFr(s.start_date)}</option>)}
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <button type="button" onClick={creerSession} disabled={occupe === 'session'} style={bouton(false, occupe === 'session')}>
                {occupe === 'session' ? 'Création…' : 'Créer la session'}
              </button>
              <button type="button" disabled={!rattacher || occupe === 'maj'} onClick={() => majuscule({ session_id: rattacher }, 'Session rattachée à cette opportunité.')} style={bouton(true, !rattacher || occupe === 'maj')}>
                Rattacher la session choisie
              </button>
            </div>
          </>}
        </section>

        <section style={carte}>
          <h2 style={titre}>Devis et facture</h2>
          <p style={{ ...attenue, margin: '6px 0 14px' }}>
            {aff.session
              ? 'Les pièces se génèrent depuis la session, avec ses apprenants et son programme.'
              : 'Le devis et la facture ont besoin d’une session : elle porte le programme, les dates et les apprenants.'}
          </p>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <Link href={aff.session ? `/sessions/${aff.session.id}` : '#'} style={bouton(false, !aff.session)} aria-disabled={!aff.session}>Générer le devis</Link>
            <Link href="/facturation" style={bouton(true)}>Ouvrir la facturation →</Link>
          </div>
        </section>

        <section style={carte}>
          <h2 style={titre}>Bon de commande</h2>
          <p style={{ ...attenue, margin: '6px 0 14px' }}>
            Beaucoup de grands comptes rejettent automatiquement une facture qui ne porte pas leur référence. Note-la dès qu’elle arrive.
          </p>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={bonCommande} onChange={(e) => setBonCommande(e.target.value)} placeholder="Numéro de bon de commande" style={{ ...saisie, maxWidth: 320 }} />
            <button type="button" disabled={bonCommande === (aff.bon_commande || '')} onClick={() => majuscule({ bon_commande: bonCommande }, 'Bon de commande enregistré.')} style={bouton(false, bonCommande === (aff.bon_commande || ''))}>Enregistrer</button>
          </div>
        </section>
      </> : <>

        <section style={carte}>
          <h2 style={titre}>Ajouter une note</h2>
          <p style={{ ...attenue, margin: '6px 0 12px' }}>Ce qui s’est dit au téléphone, ce qu’on attend, la relance prévue.</p>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Relancé le contact, il attend la validation de son OPCO." style={{ ...saisie, resize: 'vertical', flex: '1 1 320px' }} />
            <button type="button" disabled={!note.trim() || occupe === 'note'} onClick={ajouterNote} style={bouton(false, !note.trim() || occupe === 'note')}>Ajouter</button>
          </div>
        </section>

        <section style={carte}>
          <h2 style={titre}>Journal de l’affaire</h2>
          <p style={{ ...attenue, margin: '6px 0 14px' }}>Chaque déplacement d’étape s’inscrit tout seul, avec sa date.</p>
          {aff.evenements?.length ? <div style={{ display: 'grid', gap: 0 }}>
            {aff.evenements.map((e, i) => <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '26px minmax(0, 1fr)', gap: 12 }}>
              <span style={{ display: 'grid', gridTemplateRows: '26px 1fr', justifyItems: 'center' }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', background: e.type === 'etape' ? 'var(--gold)' : 'var(--surface-2)', color: e.type === 'etape' ? 'var(--gold-ink)' : 'var(--text-3)', border: '1px solid var(--border-2)', fontSize: 12, fontWeight: 900 }}>
                  {e.type === 'etape' ? '↗' : e.type === 'session' ? '✦' : '·'}
                </span>
                {i < aff.evenements.length - 1 && <span style={{ width: 2, background: 'var(--border)', minHeight: 22 }} />}
              </span>
              <span style={{ paddingBottom: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{e.texte}</div>
                <div style={attenue}>{dateHeureFr(e.created_at)}{e.auteur ? ` · ${e.auteur}` : ''}</div>
              </span>
            </div>)}
          </div> : <p style={{ ...attenue, margin: 0 }}>Rien encore. Le journal se remplira au premier déplacement d’étape.</p>}
        </section>
      </>}
    </div>
  </>;
}
