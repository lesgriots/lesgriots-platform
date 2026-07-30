'use client';

/**
 * Les envois automatiques d'une session.
 *
 * Quatre moments du cycle, quatre interrupteurs. Les deux enquêtes ne sont
 * pas du confort : l'indicateur 30 du référentiel demande de recueillir les
 * appréciations des apprenants, et rien ne le remplira tant que l'envoi
 * reste manuel.
 *
 * Tout est désarmé par défaut. Une automatisation qu'on n'a pas choisie est
 * une automatisation qui surprend, et un interrupteur qui ment est pire
 * qu'un interrupteur absent : chaque ligne dit donc, en clair, la date à
 * laquelle le prochain envoi partira pour cette session.
 */

import { useEffect, useState } from 'react';

const carte = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 };
const attenue = { color: 'var(--text-3)', fontSize: 12, lineHeight: 1.5 };
const titre = { margin: 0, fontSize: 16, letterSpacing: '-.02em', color: 'var(--text)' };
const champ = {
  width: 78, boxSizing: 'border-box', padding: '9px 10px',
  border: '1px solid var(--border-2)', borderRadius: 8,
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

const CAMPAGNES = [
  {
    cle: 'convocation', libelle: 'Convocation',
    champActif: 'convocation_auto_enabled', champJours: 'convocation_lead_days', defaut: 4,
    sens: 'avant', ancre: 'debut',
    aide: 'Dates, lieu, horaires, programme joint et lien vers son espace. Part une fois par apprenant.',
  },
  {
    cle: 'rappel', libelle: 'Rappel avant la session',
    champActif: 'rappel_auto_enabled', champJours: 'rappel_lead_days', defaut: 7,
    sens: 'avant', ancre: 'debut',
    aide: 'Le message court qui fait baisser les absences : on rappelle l’heure, l’adresse et ce qu’il faut apporter.',
  },
  {
    cle: 'chaud', libelle: 'Enquête à chaud',
    champActif: 'chaud_auto_enabled', champJours: 'chaud_delai_jours', defaut: 1,
    sens: 'apres', ancre: 'fin',
    aide: 'Indicateur 30 du référentiel. Envoyée à froid elle ne revient jamais : le lendemain est le bon moment.',
  },
  {
    cle: 'froid', libelle: 'Enquête à froid',
    champActif: 'froid_auto_enabled', champJours: 'froid_delai_jours', defaut: 90,
    sens: 'apres', ancre: 'fin',
    aide: 'Mesure l’impact réel de la formation quelques mois après. C’est elle qui prouve que tu évalues au-delà de la satisfaction.',
  },
];

const dateFr = (v) => {
  if (!v) return null;
  const d = new Date(`${String(v).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};
const decale = (date, jours) => {
  if (!date) return null;
  const d = new Date(`${String(date).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + jours);
  return d.toISOString().slice(0, 10);
};

export default function EnvoisAutomatiques({ sessionId, session, onNotice, onRecharger }) {
  const [etat, setEtat] = useState({});
  const [initial, setInitial] = useState('');
  const [occupe, setOccupe] = useState('');
  const [essai, setEssai] = useState(null);

  useEffect(() => {
    const e = {};
    for (const c of CAMPAGNES) {
      e[c.champActif] = Number(session?.[c.champActif] ?? 0) === 1;
      e[c.champJours] = Number(session?.[c.champJours] ?? c.defaut);
    }
    setEtat(e);
    setInitial(JSON.stringify(e));
  }, [session?.id, ...CAMPAGNES.flatMap((c) => [session?.[c.champActif], session?.[c.champJours]])]);

  const modifie = initial !== JSON.stringify(etat);

  const enregistrer = async () => {
    setOccupe('enregistrement');
    try {
      const corps = {};
      for (const c of CAMPAGNES) {
        corps[c.champActif] = etat[c.champActif] ? 1 : 0;
        corps[c.champJours] = Number(etat[c.champJours]) || c.defaut;
      }
      const r = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps),
      });
      if (!r.ok) throw new Error('Enregistrement impossible');
      onNotice?.('Envois automatiques enregistrés. Le serveur les traitera demain matin à 7 h 30.');
      await onRecharger?.();
    } catch (e) { onNotice?.(e.message); } finally { setOccupe(''); }
  };

  const essayer = async () => {
    setOccupe('essai');
    try {
      const r = await fetch('/api/griotheque/envois-auto');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Essai impossible');
      setEssai((d.traces || []).filter((t) => t.session_id === sessionId));
    } catch (e) { onNotice?.(e.message); } finally { setOccupe(''); }
  };

  /** La date à laquelle cette campagne partira pour cette session. */
  const dateEnvoi = (c) => {
    const jours = Number(etat[c.champJours]) || c.defaut;
    const ancre = c.ancre === 'fin' ? (session?.end_date || session?.start_date) : session?.start_date;
    return dateFr(decale(ancre, c.sens === 'avant' ? -jours : jours));
  };

  return <div style={{ display: 'grid', gap: 14 }}>

    <section style={carte}>
      <h2 style={titre}>Envois automatiques</h2>
      <p style={{ ...attenue, margin: '6px 0 0', maxWidth: 660 }}>
        Un travail tourne sur le serveur chaque matin à 7 h 30, heure de Paris. Il envoie ce qui est armé ci-dessous,
        une seule fois par apprenant, et jamais deux fois : le journal des e-mails fait foi. Tout est désarmé par défaut.
      </p>
    </section>

    <section style={carte}>
      <div style={{ display: 'grid', gap: 18 }}>
        {CAMPAGNES.map((c) => {
          const arme = Boolean(etat[c.champActif]);
          const quand = dateEnvoi(c);
          return (
            <div key={c.cle} style={{
              padding: 14, borderRadius: 11,
              border: `1.5px solid ${arme ? 'color-mix(in srgb, var(--success) 40%, transparent)' : 'var(--border)'}`,
              background: arme ? 'var(--success-soft)' : 'var(--surface-2)',
            }}>
              <label style={{ display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr)', gap: 12, cursor: 'pointer', alignItems: 'start' }}>
                <button type="button" role="switch" aria-checked={arme} aria-label={c.libelle}
                  onClick={() => setEtat((e) => ({ ...e, [c.champActif]: !arme }))}
                  style={{ width: 40, height: 23, padding: 3, border: '1px solid var(--border-2)', borderRadius: 99, background: arme ? 'var(--gold)' : 'var(--surface)', cursor: 'pointer', marginTop: 2 }}>
                  <span style={{ display: 'block', width: 15, height: 15, borderRadius: '50%', background: arme ? 'var(--gold-ink)' : 'var(--text-3)', transform: arme ? 'translateX(17px)' : 'translateX(0)', transition: 'transform .16s ease' }} />
                </button>
                <span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{c.libelle}</span>
                  <span style={{ ...attenue, display: 'block', marginTop: 3 }}>{c.aide}</span>
                </span>
              </label>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12, paddingLeft: 56 }}>
                <input type="number" min="0" value={etat[c.champJours] ?? c.defaut}
                  onChange={(e) => setEtat((x) => ({ ...x, [c.champJours]: e.target.value }))} style={champ} />
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  jour(s) {c.sens === 'avant' ? 'avant le début' : 'après la fin'} de la session
                </span>
              </div>

              {quand && (
                <div style={{ ...attenue, marginTop: 8, paddingLeft: 56, color: arme ? 'var(--text)' : 'var(--text-3)', fontWeight: arme ? 700 : 400 }}>
                  {arme ? `Partira le ${quand}.` : `Partirait le ${quand} si tu l’armais.`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <button type="button" onClick={enregistrer} disabled={!modifie || occupe === 'enregistrement'} style={bouton(false, !modifie || occupe === 'enregistrement')}>
          {occupe === 'enregistrement' ? 'Enregistrement…' : modifie ? 'Enregistrer' : 'Réglages à jour'}
        </button>
        <button type="button" onClick={essayer} disabled={occupe === 'essai'} style={bouton(true, occupe === 'essai')}>
          {occupe === 'essai' ? 'Essai…' : 'Voir ce qui partirait aujourd’hui'}
        </button>
      </div>

      {essai && <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12.5, lineHeight: 1.6 }}>
        {essai.length === 0
          ? 'Rien ne partirait pour cette session aujourd’hui. Soit rien n’est armé, soit aucune fenêtre n’est ouverte, soit tout le monde a déjà reçu son message.'
          : essai.map((t) => (
              <div key={t.campagne} style={{ marginBottom: 6 }}>
                <b>{t.libelle}</b> · {t.a_convoquer.length} envoi(s){t.a_convoquer.length ? ` à ${t.a_convoquer.join(', ')}` : ''}
                {t.sans_email > 0 ? ` · ${t.sans_email} sans adresse, ignoré(s)` : ''}
              </div>
            ))}
        {essai.length > 0 && <div style={{ ...attenue, marginTop: 6 }}>Aucun e-mail n’a été envoyé : c’est un essai à blanc.</div>}
      </div>}
    </section>
  </div>;
}
