'use client';

/**
 * /sessions/nouvelle — la fiche de création d'une session.
 *
 * Elle remplace la petite fenêtre à quatre champs qui s'ouvrait depuis
 * l'agenda. Quatre champs suffisent à poser une date au calendrier ; ils ne
 * suffisent pas à tenir un organisme de formation.
 *
 * Trois de ces champs, le type d'action, la spécialité et la sous-traitance,
 * se retrouvent tels quels dans le bilan pédagogique et financier. Les saisir
 * au moment où l'on sait de quoi il s'agit coûte trente secondes. Les
 * retrouver un an plus tard, session par session, coûte une journée.
 *
 * Tout le reste garde une valeur par défaut raisonnable : on peut créer une
 * session en remplissant seulement le programme et les dates.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import { Card } from '@/components/ui';
import {
  TYPES_ACTION, SPECIALITES, DIPLOMES, FUSEAUX, TYPES_SESSION,
} from '@/lib/formation-officiel';

const champ = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 9,
  border: '1px solid var(--border-2)', background: 'var(--surface)', color: 'var(--text)',
  fontSize: 13.5, fontFamily: 'inherit',
};
const etiquette = {
  display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
  marginBottom: 5, letterSpacing: '0.02em',
};
const aide = { margin: '5px 0 0', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.45 };
const grille = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 };
const titreBloc = { fontSize: 15, fontWeight: 700, margin: '0 0 4px' };

const bouton = (principal = true) => ({
  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 18px',
  borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
  background: principal ? 'var(--gold)' : 'var(--surface)',
  color: principal ? 'var(--gold-ink)' : 'var(--text)',
  border: `1.5px solid ${principal ? 'var(--gold)' : 'var(--border-2)'}`,
});

function Champ({ label, note, children }) {
  return (
    <div>
      <label style={etiquette}>{label}</label>
      {children}
      {note && <p style={aide}>{note}</p>}
    </div>
  );
}

/** Une case à cocher qui dit ce qu'elle change, pas seulement son nom. */
function Case({ coche, sur, titre, explication }) {
  return (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={coche}
        onChange={(e) => sur(e.target.checked)}
        style={{ marginTop: 2, width: 16, height: 16, accentColor: 'var(--gold)', flexShrink: 0 }}
      />
      <span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{titre}</span>
        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.45 }}>
          {explication}
        </span>
      </span>
    </label>
  );
}

const AUTRE = '__autre__';

export default function NouvelleSessionPage() {
  const router = useRouter();
  const params = useSearchParams();
  const dateProposee = params.get('date') || new Date().toISOString().slice(0, 10);

  const [formations, setFormations] = useState([]);
  const [lieux, setLieux] = useState([]);
  const [equipe, setEquipe] = useState([]);
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);

  const [f, setF] = useState({
    session_name: '',
    formation_id: '',
    code_interne: '',
    type_session: 'INTER',
    gestionnaire_1: '',
    gestionnaire_2: '',
    exclure_catalogue: false,
    sous_traitance: false,
    fuseau_horaire: 'Europe/Paris',
    type_action_formation: TYPES_ACTION[0],
    specialite_formation: SPECIALITES[0],
    specialite_libre: '',
    diplome_vise: 'Aucun',
    nom_titre_vise: '',
    formation_a_distance: false,
    lieu_formation_id: '',
    start_date: dateProposee,
    end_date: dateProposee,
  });
  const maj = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));
  const cocher = (k) => (b) => setF((v) => ({ ...v, [k]: b }));

  useEffect(() => {
    Promise.all([
      fetch('/api/formations').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/lieux-formation').then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch('/api/team').then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([fo, li, membres]) => {
      setFormations(Array.isArray(fo) ? fo : fo?.items || []);
      const liste = Array.isArray(li) ? li : li?.items || [];
      setLieux(liste.filter((l) => l.active !== 0));
      const noms = (Array.isArray(membres) ? membres : membres?.items || [])
        .map((m) => m.name || m.nom).filter(Boolean);
      const equipeFinale = noms.length ? noms : ['COULIBALY Moustapha'];
      setEquipe(equipeFinale);
      setF((v) => ({ ...v, gestionnaire_1: v.gestionnaire_1 || equipeFinale[0] }));
    }).catch(() => setErreur('Chargement impossible.'));
  }, []);

  // Le nom se propose tout seul à partir du programme, tant qu'on n'y a pas touché.
  const programme = useMemo(
    () => formations.find((x) => x.id === f.formation_id),
    [formations, f.formation_id],
  );
  const [nomTouche, setNomTouche] = useState(false);
  useEffect(() => {
    if (nomTouche || !programme) return;
    setF((v) => ({ ...v, session_name: programme.title || '' }));
  }, [programme, nomTouche]);

  const specialiteFinale = f.specialite_formation === AUTRE
    ? f.specialite_libre.trim()
    : f.specialite_formation;

  const valide = f.formation_id && f.start_date && f.end_date
    && f.start_date <= f.end_date
    && (f.specialite_formation !== AUTRE || f.specialite_libre.trim());

  const enregistrer = async () => {
    setErreur('');
    if (!valide) {
      setErreur(f.start_date > f.end_date
        ? 'La fin ne peut pas précéder le début.'
        : 'Il manque le programme, les dates, ou la spécialité.');
      return;
    }
    setOccupe(true);
    try {
      const lieu = lieux.find((l) => l.id === f.lieu_formation_id);
      const r = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formation_id: f.formation_id,
          start_date: f.start_date,
          end_date: f.end_date,
          session_name: f.session_name,
          code_interne: f.code_interne,
          type_session: f.type_session,
          inter_entreprise: f.type_session === 'INTER' ? 1 : 0,
          gestionnaire_1: f.gestionnaire_1,
          gestionnaire_2: f.gestionnaire_2,
          exclure_catalogue: f.exclure_catalogue ? 1 : 0,
          sous_traitance: f.sous_traitance ? 1 : 0,
          fuseau_horaire: f.fuseau_horaire,
          type_action_formation: f.type_action_formation,
          specialite_formation: specialiteFinale,
          diplome_vise: f.diplome_vise,
          nom_titre_vise: f.nom_titre_vise,
          formation_a_distance: f.formation_a_distance ? 1 : 0,
          lieu_formation_id: f.formation_a_distance ? null : (f.lieu_formation_id || null),
          modality: f.formation_a_distance ? 'distanciel' : 'presentiel',
          location: f.formation_a_distance ? 'À distance' : (lieu ? `${lieu.nom}${lieu.ville ? `, ${lieu.ville}` : ''}` : ''),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(d.error || 'La création a échoué.'); return; }
      router.push(`/sessions/${d.id}`);
    } catch {
      setErreur('La création a échoué.');
    } finally {
      setOccupe(false);
    }
  };

  return (
    <>
      <TopBar title="Créer une session" subtitle="Ce qui est saisi ici ne sera pas à retrouver au moment du BPF" />

      <div style={{ padding: '0 24px 56px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" style={bouton()} disabled={occupe || !valide} onClick={enregistrer}>
            {occupe ? 'Création…' : 'Créer la session'}
          </button>
          <button type="button" style={bouton(false)} onClick={() => router.push('/sessions-list')}>
            Annuler
          </button>
        </div>

        {erreur && <Card><p style={{ color: 'var(--danger)', margin: 0, fontSize: 13 }}>{erreur}</p></Card>}

        {/* ── Informations générales ──────────────────────────────────── */}
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <h2 style={titreBloc}>Informations générales</h2>
              <p style={{ ...aide, margin: 0 }}>Le programme et les dates suffisent à créer la session. Le reste peut attendre.</p>
            </div>

            <Champ label="Programme" note="La session hérite des modules du programme choisi.">
              <select style={champ} value={f.formation_id} onChange={maj('formation_id')}>
                <option value="">Choisir un programme</option>
                {formations.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </Champ>

            <Champ label="Nom de la session" note="Proposé d'après le programme, modifiable.">
              <input
                style={champ}
                value={f.session_name}
                onChange={(e) => { setNomTouche(true); setF((v) => ({ ...v, session_name: e.target.value })); }}
                placeholder="Ma session de formation"
              />
            </Champ>

            <div style={grille}>
              <Champ label="Début">
                <input type="date" style={champ} value={f.start_date} onChange={maj('start_date')} />
              </Champ>
              <Champ label="Fin">
                <input type="date" style={champ} value={f.end_date} onChange={maj('end_date')} />
              </Champ>
              <Champ label="Type de session" note="Inter : plusieurs entreprises. Intra : une seule.">
                <select style={champ} value={f.type_session} onChange={maj('type_session')}>
                  {TYPES_SESSION.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Champ>
              <Champ label="Code interne" note="Laissé vide, il se génère : AF26001, AF26002…">
                <input style={champ} value={f.code_interne} onChange={maj('code_interne')} placeholder="Automatique" />
              </Champ>
              <Champ label="Gestionnaire n° 1">
                <input style={champ} value={f.gestionnaire_1} onChange={maj('gestionnaire_1')} list="equipe-os" />
              </Champ>
              <Champ label="Gestionnaire n° 2">
                <input style={champ} value={f.gestionnaire_2} onChange={maj('gestionnaire_2')} list="equipe-os" placeholder="Facultatif" />
              </Champ>
              <Champ label="Fuseau horaire" note="Sert aux heures des modules et aux convocations.">
                <select style={champ} value={f.fuseau_horaire} onChange={maj('fuseau_horaire')}>
                  {FUSEAUX.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Champ>
            </div>
            <datalist id="equipe-os">
              {equipe.map((n) => <option key={n} value={n} />)}
            </datalist>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <Case
                coche={f.exclure_catalogue}
                sur={cocher('exclure_catalogue')}
                titre="Exclure du catalogue en ligne"
                explication="La session existe, mais personne ne peut s’y inscrire depuis le site."
              />
              <Case
                coche={f.sous_traitance}
                sur={cocher('sous_traitance')}
                titre="Réalisée en sous-traitance d’un autre organisme"
                explication="Ligne distincte au bilan pédagogique et financier : le chiffre d’affaires n’est pas déclaré au même endroit."
              />
            </div>
          </div>
        </Card>

        {/* ── Formation professionnelle ───────────────────────────────── */}
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <h2 style={titreBloc}>Formation professionnelle</h2>
              <p style={{ ...aide, margin: 0 }}>
                Ces trois lignes partent telles quelles dans le bilan pédagogique et financier.
              </p>
            </div>

            <div style={grille}>
              <Champ label="Type d’action de formation" note="Article L.6313-1 du code du travail.">
                <select style={champ} value={f.type_action_formation} onChange={maj('type_action_formation')}>
                  {TYPES_ACTION.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Champ>

              <Champ label="Spécialité de formation" note="Nomenclature NSF.">
                <select style={champ} value={f.specialite_formation} onChange={maj('specialite_formation')}>
                  {SPECIALITES.map((s) => <option key={s} value={s}>{s}</option>)}
                  <option value={AUTRE}>Autre spécialité (saisir le code)</option>
                </select>
              </Champ>

              {f.specialite_formation === AUTRE && (
                <Champ label="Code et libellé NSF" note="Format « 123 - Libellé de la spécialité ».">
                  <input style={champ} value={f.specialite_libre} onChange={maj('specialite_libre')} placeholder="326 - Informatique…" />
                </Champ>
              )}

              <Champ label="Diplôme visé">
                <select style={champ} value={f.diplome_vise} onChange={maj('diplome_vise')}>
                  {DIPLOMES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Champ>

              {f.diplome_vise !== 'Aucun' && (
                <Champ label="Nom du titre visé" note="Tel qu’il figure au répertoire.">
                  <input style={champ} value={f.nom_titre_vise} onChange={maj('nom_titre_vise')} />
                </Champ>
              )}
            </div>
          </div>
        </Card>

        {/* ── Lieu de formation ───────────────────────────────────────── */}
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <h2 style={titreBloc}>Lieu de formation</h2>
              <p style={{ ...aide, margin: 0 }}>
                Le lieu par défaut des modules. Il reste modifiable créneau par créneau, et
                se retrouve sur la convocation comme sur l’agenda.
              </p>
            </div>

            <Case
              coche={f.formation_a_distance}
              sur={cocher('formation_a_distance')}
              titre="Formation à distance"
              explication="Aucune adresse ne sera imprimée sur les documents."
            />

            {!f.formation_a_distance && (
              <Champ
                label="Lieu"
                note={lieux.length
                  ? 'Choisi ici, il sert de valeur par défaut à tous les modules.'
                  : 'Aucun lieu enregistré pour l’instant : créez-en un depuis Données · Lieux de formation.'}
              >
                <select style={champ} value={f.lieu_formation_id} onChange={maj('lieu_formation_id')}>
                  <option value="">À définir plus tard</option>
                  {lieux.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nom}{l.ville ? ` — ${l.ville}` : ''}
                    </option>
                  ))}
                </select>
              </Champ>
            )}
          </div>
        </Card>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" style={bouton()} disabled={occupe || !valide} onClick={enregistrer}>
            {occupe ? 'Création…' : 'Créer la session'}
          </button>
        </div>
      </div>
    </>
  );
}
