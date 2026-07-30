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
 *
 * Écran repris sur les primitives : il déclarait son bouton, son champ, son
 * étiquette et sa grille. Il n'en déclare plus aucun.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/layout/TopBar';
import {
  Bloc, Pile, Page, Bouton, Champ, Saisie, Choix, Case, Grille,
} from '@/components/ui';
import {
  TYPES_ACTION, SPECIALITES, DIPLOMES, FUSEAUX, TYPES_SESSION,
} from '@/lib/formation-officiel';

const AUTRE = '__autre__';

export default function NouvelleSessionPage() {
  const router = useRouter();
  const aujourdhui = new Date().toISOString().slice(0, 10);

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
    start_date: aujourdhui,
    end_date: aujourdhui,
  });
  const maj = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));
  const cocher = (k) => (b) => setF((v) => ({ ...v, [k]: b }));

  // La date cliquée dans l'agenda arrive par l'URL. On la lit après le montage
  // plutôt qu'avec useSearchParams : sinon toute la page devient dynamique, et
  // Next refuse de la prérendre sans frontière de suspension.
  useEffect(() => {
    const jour = new URLSearchParams(window.location.search).get('date');
    if (jour) setF((v) => ({ ...v, start_date: jour, end_date: jour }));
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/formations').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/lieux-formation').then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch('/api/team').then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([fo, li, membres, moi]) => {
      setFormations(Array.isArray(fo) ? fo : fo?.items || []);
      const liste = Array.isArray(li) ? li : li?.items || [];
      setLieux(liste.filter((l) => l.active !== 0));
      const noms = (Array.isArray(membres) ? membres : membres?.items || [])
        .map((m) => m.name || m.nom).filter(Boolean);
      setEquipe(noms);
      // Le gestionnaire par défaut, c'est celui qui crée la session. Pas le
      // premier nom de l'équipe par ordre alphabétique.
      const soi = moi?.name || moi?.nom || moi?.email || noms[0] || '';
      setF((v) => ({ ...v, gestionnaire_1: v.gestionnaire_1 || soi }));
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

  const datesInversees = f.start_date > f.end_date;
  const valide = f.formation_id && f.start_date && f.end_date && !datesInversees
    && (f.specialite_formation !== AUTRE || f.specialite_libre.trim());

  const enregistrer = async () => {
    setErreur('');
    if (!valide) {
      setErreur(datesInversees
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
          location: f.formation_a_distance
            ? 'À distance'
            : (lieu ? `${lieu.nom}${lieu.ville ? `, ${lieu.ville}` : ''}` : ''),
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

  const actions = (
    <>
      <Bouton occupe={occupe} disabled={!valide} onClick={enregistrer}>
        {occupe ? 'Création…' : 'Créer la session'}
      </Bouton>
      <Bouton discret onClick={() => router.push('/sessions-list')}>Annuler</Bouton>
    </>
  );

  return (
    <>
      <TopBar title="Créer une session" subtitle="Ce qui est saisi ici ne sera pas à retrouver au moment du BPF" right={actions} />

      <Page>
        <Pile>
          {erreur && <Bloc><p style={{ color: 'var(--danger)', margin: 0, fontSize: 13 }}>{erreur}</p></Bloc>}

          <Bloc
            titre="Informations générales"
            chapeau="Le programme et les dates suffisent à créer la session. Le reste peut attendre."
          >
            <Pile gap={18}>
              <Champ label="Programme" aide="La session hérite des modules du programme choisi." requis>
                <Choix
                  options={formations.map((p) => [p.id, p.title])}
                  vide="Choisir un programme"
                  value={f.formation_id}
                  onChange={maj('formation_id')}
                />
              </Champ>

              <Champ label="Nom de la session" aide="Proposé d’après le programme, modifiable.">
                <Saisie
                  value={f.session_name}
                  onChange={(e) => { setNomTouche(true); setF((v) => ({ ...v, session_name: e.target.value })); }}
                  placeholder="Ma session de formation"
                />
              </Champ>

              <Grille>
                <Champ label="Début" requis>
                  <Saisie type="date" value={f.start_date} onChange={maj('start_date')} faux={datesInversees} />
                </Champ>
                <Champ
                  label="Fin"
                  requis
                  erreur={datesInversees ? 'La fin ne peut pas précéder le début.' : ''}
                >
                  <Saisie type="date" value={f.end_date} onChange={maj('end_date')} faux={datesInversees} />
                </Champ>
                <Champ label="Type de session" aide="Inter : plusieurs entreprises. Intra : une seule.">
                  <Choix options={TYPES_SESSION} value={f.type_session} onChange={maj('type_session')} />
                </Champ>
                <Champ label="Code interne" aide="Laissé vide, il se génère : AF26001, AF26002…">
                  <Saisie value={f.code_interne} onChange={maj('code_interne')} placeholder="Automatique" />
                </Champ>
                <Champ label="Gestionnaire n° 1">
                  <Saisie value={f.gestionnaire_1} onChange={maj('gestionnaire_1')} list="equipe-os" />
                </Champ>
                <Champ label="Gestionnaire n° 2">
                  <Saisie value={f.gestionnaire_2} onChange={maj('gestionnaire_2')} list="equipe-os" placeholder="Facultatif" />
                </Champ>
                <Champ label="Fuseau horaire" aide="Sert aux heures des modules et aux convocations.">
                  <Choix options={FUSEAUX} value={f.fuseau_horaire} onChange={maj('fuseau_horaire')} />
                </Champ>
              </Grille>
              <datalist id="equipe-os">
                {equipe.map((n) => <option key={n} value={n} />)}
              </datalist>

              <Grille min={280}>
                <Case
                  coche={f.exclure_catalogue}
                  sur={cocher('exclure_catalogue')}
                  titre="Exclure du catalogue en ligne"
                  aide="La session existe, mais personne ne peut s’y inscrire depuis le site."
                />
                <Case
                  coche={f.sous_traitance}
                  sur={cocher('sous_traitance')}
                  titre="Réalisée en sous-traitance d’un autre organisme"
                  aide="Ligne distincte au bilan pédagogique et financier : le chiffre d’affaires n’est pas déclaré au même endroit."
                />
              </Grille>
            </Pile>
          </Bloc>

          <Bloc
            titre="Formation professionnelle"
            chapeau="Ces trois lignes partent telles quelles dans le bilan pédagogique et financier."
          >
            <Grille>
              <Champ label="Type d’action de formation" aide="Article L.6313-1 du code du travail.">
                <Choix options={TYPES_ACTION} value={f.type_action_formation} onChange={maj('type_action_formation')} />
              </Champ>

              <Champ label="Spécialité de formation" aide="Nomenclature NSF.">
                <Choix options={SPECIALITES} value={f.specialite_formation} onChange={maj('specialite_formation')}>
                  <option value={AUTRE}>Autre spécialité (saisir le code)</option>
                </Choix>
              </Champ>

              {f.specialite_formation === AUTRE && (
                <Champ label="Code et libellé NSF" aide="Format « 123 - Libellé de la spécialité »." requis>
                  <Saisie value={f.specialite_libre} onChange={maj('specialite_libre')} placeholder="326 - Informatique…" />
                </Champ>
              )}

              <Champ label="Diplôme visé">
                <Choix options={DIPLOMES} value={f.diplome_vise} onChange={maj('diplome_vise')} />
              </Champ>

              {f.diplome_vise !== 'Aucun' && (
                <Champ label="Nom du titre visé" aide="Tel qu’il figure au répertoire.">
                  <Saisie value={f.nom_titre_vise} onChange={maj('nom_titre_vise')} />
                </Champ>
              )}
            </Grille>
          </Bloc>

          <Bloc
            titre="Lieu de formation"
            chapeau="Le lieu par défaut des modules. Il reste modifiable créneau par créneau, et se retrouve sur la convocation comme sur l’agenda."
          >
            <Pile gap={18}>
              <Case
                coche={f.formation_a_distance}
                sur={cocher('formation_a_distance')}
                titre="Formation à distance"
                aide="Aucune adresse ne sera imprimée sur les documents."
              />

              {!f.formation_a_distance && (
                <Champ
                  label="Lieu"
                  aide={lieux.length
                    ? 'Choisi ici, il sert de valeur par défaut à tous les modules.'
                    : 'Aucun lieu enregistré pour l’instant : créez-en un depuis Données · Lieux de formation.'}
                >
                  <Choix
                    options={lieux.map((l) => [l.id, `${l.nom}${l.ville ? ` — ${l.ville}` : ''}`])}
                    vide="À définir plus tard"
                    value={f.lieu_formation_id}
                    onChange={maj('lieu_formation_id')}
                  />
                </Champ>
              )}
            </Pile>
          </Bloc>

          <div style={{ display: 'flex', gap: 10 }}>
            <Bouton grand occupe={occupe} disabled={!valide} onClick={enregistrer}>
              {occupe ? 'Création…' : 'Créer la session'}
            </Bouton>
          </div>
        </Pile>
      </Page>
    </>
  );
}
