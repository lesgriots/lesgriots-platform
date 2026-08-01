'use client';

/**
 * Les mentions que la loi attend sur un programme de formation.
 *
 * Ces quatre-là n'existaient nulle part dans l'interface. Les colonnes
 * étaient en base, l'API les acceptait, le PDF du programme et l'annexe de la
 * convention savaient les imprimer : personne n'avait jamais pu les taper.
 * D'où quinze programmes refusés à la publication pour les mêmes quatre
 * manques.
 *
 * Elles décrivent la maison et non le programme : le même texte vaut d'une
 * formation à l'autre. D'où le bouton qui recopie ce qui a déjà été écrit
 * ailleurs, plutôt que de retaper quinze fois la même chose et de laisser les
 * versions diverger.
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
const discret = { border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px', background: 'var(--surface-2)', color: 'var(--text)', fontWeight: 650, cursor: 'pointer' };

const MENTIONS = [
  {
    cle: 'modalites_pedagogiques',
    titre: 'Méthodes pédagogiques',
    aide: 'Comment vous enseignez : alternance, taille du groupe, travail sur le projet du participant.',
    lignes: 6,
  },
  {
    cle: 'moyens_materiels',
    titre: 'Moyens techniques et pédagogiques',
    aide: 'La salle, le matériel, ce que le participant apporte, et le support remis à la fin.',
    lignes: 6,
  },
  {
    cle: 'accessibility',
    titre: 'Accessibilité et situation de handicap',
    aide: 'La marche à suivre pour être accueilli, et le nom de votre référent handicap. Il en faut un, nommément.',
    lignes: 6,
  },
  {
    cle: 'delais_acces',
    titre: 'Délais d’accès',
    aide: 'Le temps entre la demande et l’entrée en formation, et ce qu’il devient quand un OPCO ou le CPF instruit le dossier.',
    lignes: 5,
  },
];

export default function MentionsObligatoires({ formationId, formation, onEnregistre }) {
  const [brouillon, setBrouillon] = useState({});
  const [etat, setEtat] = useState('pret');
  const [avis, setAvis] = useState('');
  const [ailleurs, setAilleurs] = useState(null);

  useEffect(() => {
    setBrouillon(Object.fromEntries(MENTIONS.map((m) => [m.cle, formation?.[m.cle] || ''])));
  }, [formation]);

  // Ce que d'autres programmes ont déjà écrit : la mention la plus récente
  // fait référence, puisque le texte est censé être le même partout.
  useEffect(() => {
    let vivant = true;
    fetch('/api/formations')
      .then((r) => r.json())
      .then((liste) => {
        if (!vivant || !Array.isArray(liste)) return;
        const trouve = {};
        for (const m of MENTIONS) {
          const source = liste.find((f) => f.id !== formationId && String(f[m.cle] || '').trim());
          if (source) trouve[m.cle] = String(source[m.cle]).trim();
        }
        setAilleurs(Object.keys(trouve).length ? trouve : null);
      })
      .catch(() => {});
    return () => { vivant = false; };
  }, [formationId]);

  const manquantes = MENTIONS.filter((m) => !String(brouillon[m.cle] || '').trim());

  const enregistrer = async () => {
    setEtat('envoi'); setAvis('');
    try {
      const r = await fetch(`/api/formations/${formationId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brouillon),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Enregistrement refusé');
      setAvis('Mentions enregistrées. Elles apparaissent dans le programme et dans l’annexe de la convention.');
      onEnregistre?.(d);
    } catch (e) { setAvis(e.message); }
    finally { setEtat('pret'); }
  };

  return <div style={panneau}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ marginTop: 0, marginBottom: 4 }}>Mentions obligatoires</h2>
        <p style={{ ...attenue, margin: 0, maxWidth: 700 }}>
          Sans elles, le programme ne peut pas être publié : le générateur refuse de produire un
          document incomplet. Écrites ici, elles s’impriment sur le programme et dans l’annexe de
          la convention, sans rien saisir ailleurs.
        </p>
      </div>
      <button type="button" style={primaire} onClick={enregistrer} disabled={etat === 'envoi'}>
        {etat === 'envoi' ? 'Enregistrement…' : 'Enregistrer les mentions'}
      </button>
    </div>

    <p style={{ ...attenue, marginTop: 12, color: manquantes.length ? 'var(--gold)' : 'var(--success)', fontWeight: 700 }}>
      {manquantes.length
        ? `${manquantes.length} mention(s) encore vide(s) : ${manquantes.map((m) => m.titre).join(', ')}.`
        : 'Les quatre mentions sont renseignées.'}
    </p>

    {ailleurs && <div style={{ marginTop: 4, marginBottom: 14 }}>
      <button
        type="button"
        style={discret}
        onClick={() => setBrouillon((b) => ({ ...ailleurs, ...Object.fromEntries(Object.entries(b).filter(([, v]) => String(v || '').trim())) }))}
      >
        Reprendre les textes d’un autre programme
      </button>
      <span style={{ ...attenue, marginLeft: 10 }}>Ne remplace que les mentions restées vides ici.</span>
    </div>}

    {avis && <p role="status" style={{ background: 'var(--surface-2)', padding: 11, borderRadius: 8, color: 'var(--text-2)', fontSize: 13 }}>{avis}</p>}

    <div style={{ display: 'grid', gap: 16, marginTop: 8 }}>
      {MENTIONS.map((m) => <label key={m.cle} style={{ display: 'grid', gap: 5 }}>
        <span style={{ fontSize: 13.5, fontWeight: 750, color: 'var(--text)' }}>{m.titre}</span>
        <span style={attenue}>{m.aide}</span>
        <textarea
          rows={m.lignes}
          value={brouillon[m.cle] || ''}
          onChange={(e) => setBrouillon((b) => ({ ...b, [m.cle]: e.target.value }))}
          style={zone}
        />
      </label>)}
    </div>
  </div>;
}
