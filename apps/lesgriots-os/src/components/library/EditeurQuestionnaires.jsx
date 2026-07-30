'use client';

/**
 * L'éditeur de questionnaires d'un programme.
 *
 * Il montre en permanence ce qui est imposé et ce qui t'appartient, parce
 * que la règle n'est pas la même selon le moment :
 *
 *   Positionnement  tes questions remplacent les génériques. Demander
 *                   « évaluez votre niveau » à quelqu'un qui vient
 *                   apprendre à filmer n'apprend rien.
 *   À chaud, à froid  le tronc commun reste, tes questions s'ajoutent après.
 *                   C'est ce qui garde ta satisfaction moyenne comparable
 *                   d'une formation à l'autre.
 */

import { useEffect, useState } from 'react';

const panneau = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 };
const attenue = { color: 'var(--text-3)', fontSize: 12, lineHeight: 1.5 };
const champ = {
  width: '100%', boxSizing: 'border-box', padding: '9px 10px',
  border: '1px solid var(--border-2)', borderRadius: 8,
  background: 'var(--surface-2)', color: 'var(--text)', font: 'inherit', fontSize: 13,
};
function bouton(secondaire, desactive = false) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 13px', borderRadius: 9,
    fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit', cursor: desactive ? 'not-allowed' : 'pointer',
    opacity: desactive ? .45 : 1, whiteSpace: 'nowrap',
    background: secondaire ? 'var(--surface)' : 'var(--gold)',
    color: secondaire ? 'var(--text)' : 'var(--gold-ink)',
    border: `1.5px solid ${secondaire ? 'var(--border-2)' : 'var(--gold)'}`,
  };
}

const AVEC_OPTIONS = ['choice', 'multi'];

export default function EditeurQuestionnaires({ formationId }) {
  const [donnees, setDonnees] = useState(null);
  const [brouillons, setBrouillons] = useState({});
  const [ouvert, setOuvert] = useState('positionnement');
  const [occupe, setOccupe] = useState('');
  const [message, setMessage] = useState('');

  const charger = async () => {
    const d = await fetch(`/api/formations/${formationId}/questionnaires`).then((r) => r.json());
    setDonnees(d);
    const b = {};
    for (const m of d.moments || []) b[m.moment] = m.propres.map((q) => ({ ...q }));
    setBrouillons(b);
  };
  useEffect(() => { charger(); }, [formationId]);

  if (!donnees) return <p style={attenue}>Chargement des questionnaires…</p>;

  const majQuestion = (moment, i, patch) => setBrouillons((b) => ({
    ...b, [moment]: b[moment].map((q, j) => j === i ? { ...q, ...patch } : q),
  }));
  const ajouter = (moment) => setBrouillons((b) => ({
    ...b, [moment]: [...(b[moment] || []), { key: `q${(b[moment] || []).length + 1}`, label: '', type: 'text', required: false, options: [] }],
  }));
  const retirer = (moment, i) => setBrouillons((b) => ({ ...b, [moment]: b[moment].filter((_, j) => j !== i) }));
  const deplacer = (moment, i, sens) => setBrouillons((b) => {
    const l = [...b[moment]]; const j = i + sens;
    if (j < 0 || j >= l.length) return b;
    [l[i], l[j]] = [l[j], l[i]];
    return { ...b, [moment]: l };
  });

  const enregistrer = async (moment) => {
    setOccupe(moment); setMessage('');
    try {
      const r = await fetch(`/api/formations/${formationId}/questionnaires`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moment, questions: brouillons[moment] || [] }),
      });
      if (!r.ok) throw new Error('Enregistrement impossible');
      setMessage('Questionnaire enregistré. Les prochaines sessions de ce programme l’utiliseront.');
      await charger();
    } catch (e) { setMessage(e.message); } finally { setOccupe(''); }
  };

  return <div style={{ display: 'grid', gap: 14 }}>

    <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, alignSelf: 'start', flexWrap: 'wrap' }}>
      {donnees.moments.map((m) => (
        <button key={m.moment} type="button" onClick={() => setOuvert(m.moment)} style={{
          border: `1.5px solid ${ouvert === m.moment ? 'var(--gold)' : 'transparent'}`,
          background: ouvert === m.moment ? 'var(--gold)' : 'transparent',
          color: ouvert === m.moment ? 'var(--gold-ink)' : 'var(--text-2)',
          padding: '8px 13px', borderRadius: 9, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
        }}>{m.libelle}{(brouillons[m.moment] || []).length > 0 ? ` · ${brouillons[m.moment].length}` : ''}</button>
      ))}
    </div>

    {message && <div style={{ padding: '10px 13px', borderRadius: 9, background: 'var(--gold-soft)', border: '1.5px solid color-mix(in srgb, var(--gold) 45%, transparent)', fontSize: 12.5, fontWeight: 700 }}>{message}</div>}

    {donnees.moments.filter((m) => m.moment === ouvert).map((m) => (
      <div key={m.moment} style={{ display: 'grid', gap: 14 }}>

        <section style={panneau}>
          <b style={{ fontSize: 13.5 }}>
            {m.regle === 'remplace' ? 'Tes questions remplacent le questionnaire générique' : 'Tes questions s’ajoutent après le tronc commun'}
          </b>
          <p style={{ ...attenue, margin: '5px 0 0' }}>
            {m.regle === 'remplace'
              ? 'Dès que tu écris une question ici, le questionnaire générique n’est plus servi. Seule la question sur les besoins d’aménagement reste ajoutée d’office : c’est la preuve de l’indicateur 26.'
              : 'Le tronc commun est identique pour toutes tes formations : c’est ce qui permet de dire « ma satisfaction moyenne est de 4,6 ». Tes questions arrivent après, et ne changent pas ce chiffre.'}
          </p>
          {m.regle === 'ajoute' && (
            <details style={{ marginTop: 10 }}>
              <summary style={{ ...attenue, cursor: 'pointer', fontWeight: 700 }}>Voir le tronc commun ({m.tronc.length} questions)</summary>
              <ol style={{ ...attenue, margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.7 }}>
                {m.tronc.map((q) => <li key={q.key}>{q.label}</li>)}
              </ol>
            </details>
          )}
        </section>

        <div style={{ display: 'grid', gap: 10 }}>
          {(brouillons[m.moment] || []).map((q, i) => (
            <section key={i} style={{ ...panneau, background: 'var(--surface-2)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <span style={{ ...attenue, fontWeight: 800, minWidth: 22 }}>{i + 1}</span>
                <button type="button" onClick={() => deplacer(m.moment, i, -1)} disabled={i === 0} style={bouton(true, i === 0)}>↑</button>
                <button type="button" onClick={() => deplacer(m.moment, i, 1)} disabled={i === (brouillons[m.moment].length - 1)} style={bouton(true, i === (brouillons[m.moment].length - 1))}>↓</button>
                <span style={{ flex: 1 }} />
                <button type="button" onClick={() => retirer(m.moment, i)} style={{ ...bouton(true), color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)' }}>Retirer</button>
              </div>

              <label style={{ display: 'grid', gap: 5, marginBottom: 10 }}>
                <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>Question</span>
                <input value={q.label} onChange={(e) => majQuestion(m.moment, i, { label: e.target.value })}
                  placeholder="Avec quel téléphone filmes-tu ?" style={champ} />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 10 }}>
                <label style={{ display: 'grid', gap: 5 }}>
                  <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>Type de réponse</span>
                  <select value={q.type} onChange={(e) => majQuestion(m.moment, i, { type: e.target.value })} style={champ}>
                    {donnees.types.map((t) => <option key={t.cle} value={t.cle}>{t.libelle}</option>)}
                  </select>
                  <span style={{ ...attenue, fontSize: 11 }}>{donnees.types.find((t) => t.cle === q.type)?.aide}</span>
                </label>
                {q.type !== 'section' && (
                  <label style={{ display: 'flex', gap: 9, alignItems: 'center', alignSelf: 'end', paddingBottom: 8 }}>
                    <input type="checkbox" checked={Boolean(q.required)} onChange={(e) => majQuestion(m.moment, i, { required: e.target.checked })} style={{ width: 16, height: 16, accentColor: 'var(--gold)' }} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Réponse obligatoire</span>
                  </label>
                )}
              </div>

              {AVEC_OPTIONS.includes(q.type) && (
                <label style={{ display: 'grid', gap: 5, marginTop: 10 }}>
                  <span style={{ ...attenue, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800 }}>Réponses proposées</span>
                  <input value={(q.options || []).join(', ')}
                    onChange={(e) => majQuestion(m.moment, i, { options: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
                    placeholder="iPhone, Android, Je n’en ai pas" style={champ} />
                  <span style={{ ...attenue, fontSize: 11 }}>Séparées par des virgules.</span>
                </label>
              )}
            </section>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => ajouter(m.moment)} style={bouton(true)}>+ Ajouter une question</button>
          <button type="button" onClick={() => enregistrer(m.moment)} disabled={occupe === m.moment} style={bouton(false, occupe === m.moment)}>
            {occupe === m.moment ? 'Enregistrement…' : 'Enregistrer ce questionnaire'}
          </button>
        </div>

        {(brouillons[m.moment] || []).length === 0 && (
          <p style={{ ...attenue, margin: 0 }}>
            Aucune question propre à ce programme : {m.regle === 'remplace' ? 'le questionnaire générique est servi tel quel.' : 'seul le tronc commun est posé.'}
          </p>
        )}
      </div>
    ))}
  </div>;
}
