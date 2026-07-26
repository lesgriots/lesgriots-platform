'use client';

/**
 * /organisme — pilotage de l'organisme de formation lui-même.
 *
 * Deux registres que l'auditeur Qualiopi demande et que l'OS ne couvrait pas :
 *
 *   1. Les pièces officielles de l'OF (Kbis, déclaration d'activité, certificat
 *      Qualiopi, assurance RC pro, attestation URSSAF…) avec leur date de fin de
 *      validité — pour être prévenu AVANT la péremption, pas après.
 *   2. Le registre des réclamations, incidents et suggestions (indicateur 31 du
 *      RNQ). Un registre vide mais tenu est recevable ; un registre inexistant
 *      ne l'est pas.
 *
 * L'identité administrative (SIREN, NDA, adresse, représentant) reste dans
 * Réglages : elle ne bouge presque jamais, alors que ces deux registres vivent.
 */

import { useEffect, useState, useCallback } from 'react';
import TopBar from '@/components/layout/TopBar';
import { Card, Badge, Button, Skeleton, EmptyState, SectionTitle } from '@/components/ui';

const TYPES_DOC = [
  { v: 'kbis',                l: 'Kbis' },
  { v: 'nda',                 l: 'Déclaration d’activité (NDA)' },
  { v: 'qualiopi',            l: 'Certificat Qualiopi' },
  { v: 'assurance_rc',        l: 'Assurance RC pro' },
  { v: 'urssaf',              l: 'Attestation URSSAF' },
  { v: 'certification',       l: 'Certification (RS/RNCP)' },
  { v: 'reglement_interieur', l: 'Règlement intérieur' },
  { v: 'cgv',                 l: 'CGV' },
  { v: 'autre',               l: 'Autre' },
];

const NATURES  = [
  { v: 'reclamation', l: 'Réclamation' },
  { v: 'incident',    l: 'Incident' },
  { v: 'suggestion',  l: 'Suggestion' },
];
const ORIGINES = [
  { v: 'apprenant',  l: 'Apprenant' },  { v: 'client',     l: 'Client' },
  { v: 'formateur',  l: 'Formateur' },  { v: 'financeur',  l: 'Financeur' },
  { v: 'partenaire', l: 'Partenaire' }, { v: 'interne',    l: 'Interne' },
  { v: 'autre',      l: 'Autre' },
];
const GRAVITES = [
  { v: 'mineure',  l: 'Mineure' },
  { v: 'majeure',  l: 'Majeure' },
  { v: 'critique', l: 'Critique' },
];
const STATUTS  = [
  { v: 'ouverte',  l: 'Ouverte' },
  { v: 'en_cours', l: 'En cours' },
  { v: 'resolue',  l: 'Résolue' },
  { v: 'classee',  l: 'Classée sans suite' },
];

const libelle = (liste, v) => liste.find((o) => o.v === v)?.l || v || '—';

const dateFr = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) : '—';

// Une pièce sans date de fin est « permanente » (ex. règlement intérieur).
function tonDoc(statut) {
  if (statut === 'expire')  return { tone: 'danger',  label: 'Expiré' };
  if (statut === 'bientot') return { tone: 'warning', label: 'À renouveler' };
  if (statut === 'valide')  return { tone: 'success', label: 'Valide' };
  return { tone: 'neutral', label: 'Permanent' };
}

const CHAMP = {
  width: '100%', padding: '8px 10px', border: '1px solid var(--border)',
  borderRadius: 6, background: 'var(--bg)', color: 'var(--text)',
  fontFamily: 'inherit', fontSize: 13,
};
const LABEL = {
  display: 'block', fontSize: 11, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 4,
};

export default function OrganismePage() {
  const [docs, setDocs]   = useState([]);
  const [docStats, setDocStats] = useState({ total: 0, expires: 0, bientot: 0 });
  const [recs, setRecs]   = useState([]);
  const [recStats, setRecStats] = useState({ total: 0, en_cours: 0, critiques: 0 });
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur]   = useState('');
  const [ongletDoc, setOngletDoc] = useState(false);
  const [ongletRec, setOngletRec] = useState(false);

  const charger = useCallback(() => {
    setErreur('');
    Promise.all([
      fetch('/api/organisme-documents').then((r) => r.json()),
      fetch('/api/reclamations').then((r) => r.json()),
    ])
      .then(([d, r]) => {
        setDocs(d.items || []);      setDocStats(d.stats || {});
        setRecs(r.items || []);      setRecStats(r.stats || {});
        setLoading(false);
      })
      .catch((e) => {
        console.warn('[Organisme] Chargement échoué :', e);
        setErreur('Chargement impossible.');
        setLoading(false);
      });
  }, []);

  useEffect(() => { charger(); }, [charger]);

  async function creerDoc(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const res = await fetch('/api/organisme-documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(f)),
    });
    if (res.ok) { e.target.reset(); setOngletDoc(false); charger(); }
    else setErreur((await res.json()).error || 'Erreur');
  }

  async function creerRec(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const res = await fetch('/api/reclamations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(f)),
    });
    if (res.ok) { e.target.reset(); setOngletRec(false); charger(); }
    else setErreur((await res.json()).error || 'Erreur');
  }

  async function majRec(id, patch) {
    await fetch(`/api/reclamations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    charger();
  }

  async function archiverDoc(id) {
    await fetch(`/api/organisme-documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: 1 }),
    });
    charger();
  }

  const alertes = (docStats.expires || 0) + (docStats.bientot || 0) + (recStats.critiques || 0);

  return (
    <>
      <TopBar
        title="Organisme"
        subtitle="Pièces officielles et registre des réclamations"
      />

      <div style={{ padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {erreur && (
          <Card><p style={{ color: 'var(--danger)', margin: 0 }}>{erreur}</p></Card>
        )}

        {/* ── Bandeau d'alertes : ce qui exige une action maintenant ── */}
        {!loading && alertes > 0 && (
          <Card style={{ borderLeft: '3px solid var(--gold)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
              {docStats.expires > 0 && (
                <span><strong>{docStats.expires}</strong> pièce{docStats.expires > 1 ? 's' : ''} expirée{docStats.expires > 1 ? 's' : ''}</span>
              )}
              {docStats.bientot > 0 && (
                <span><strong>{docStats.bientot}</strong> à renouveler sous 60 jours</span>
              )}
              {recStats.critiques > 0 && (
                <span><strong>{recStats.critiques}</strong> réclamation{recStats.critiques > 1 ? 's' : ''} critique{recStats.critiques > 1 ? 's' : ''} non traitée{recStats.critiques > 1 ? 's' : ''}</span>
              )}
            </div>
          </Card>
        )}

        {/* ══════════ PIÈCES DE L'ORGANISME ══════════ */}
        <section>
          <SectionTitle
            title="Pièces de l’organisme"
            subtitle="Alerte automatique 60 jours avant la fin de validité"
            right={
              <Button onClick={() => setOngletDoc((v) => !v)}>
                {ongletDoc ? 'Annuler' : '+ Ajouter une pièce'}
              </Button>
            }
          />

          {ongletDoc && (
            <Card style={{ marginTop: 12 }}>
              <form onSubmit={creerDoc} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
                <div>
                  <label style={LABEL}>Type</label>
                  <select name="type" style={CHAMP} defaultValue="kbis">
                    {TYPES_DOC.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LABEL}>Libellé *</label>
                  <input name="libelle" required style={CHAMP} placeholder="Certificat Qualiopi 2026" />
                </div>
                <div>
                  <label style={LABEL}>Référence / numéro</label>
                  <input name="reference" style={CHAMP} />
                </div>
                <div>
                  <label style={LABEL}>Émis le</label>
                  <input name="emis_le" type="date" style={CHAMP} />
                </div>
                <div>
                  <label style={LABEL}>Expire le</label>
                  <input name="expire_le" type="date" style={CHAMP} />
                </div>
                <div>
                  <label style={LABEL}>Émetteur</label>
                  <input name="emetteur" style={CHAMP} placeholder="AFNOR, DREETS, URSSAF…" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={LABEL}>Fichier (chemin ou lien)</label>
                  <input name="fichier" style={CHAMP} placeholder="Drive, coffre-fort, chemin local…" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={LABEL}>Notes</label>
                  <input name="notes" style={CHAMP} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Button type="submit">Enregistrer</Button>
                </div>
              </form>
            </Card>
          )}

          <div style={{ marginTop: 12 }}>
            {loading ? <Skeleton /> : docs.length === 0 ? (
              <EmptyState
                title="Aucune pièce enregistrée"
                message="Kbis, déclaration d’activité, certificat Qualiopi, assurance RC pro, attestation URSSAF : ce sont les pièces que l’auditeur demande en premier."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {docs.map((d) => {
                  const t = tonDoc(d.statut);
                  return (
                    <Card key={d.id}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <strong>{d.libelle}</strong>
                            <Badge tone={t.tone}>{t.label}</Badge>
                            <span style={{ fontSize: 12, opacity: 0.6 }}>{libelle(TYPES_DOC, d.type)}</span>
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
                            {d.reference && <>Réf. {d.reference} · </>}
                            {d.emetteur && <>{d.emetteur} · </>}
                            {d.expire_le
                              ? <>Valide jusqu’au {dateFr(d.expire_le)}
                                  {d.jours_restants !== null && d.jours_restants >= 0 && <> ({d.jours_restants} j)</>}
                                </>
                              : <>Sans date de fin</>}
                          </div>
                        </div>
                        <Button variant="ghost" onClick={() => archiverDoc(d.id)}>Archiver</Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ══════════ RÉCLAMATIONS ══════════ */}
        <section>
          <SectionTitle
            title="Réclamations, incidents et suggestions"
            subtitle={
              recStats.total > 0
                ? `${recStats.en_cours} en cours sur ${recStats.total} · indicateur 31 du RNQ`
                : 'Indicateur 31 du RNQ — traitement des aléas et réclamations'
            }
            right={
              <Button onClick={() => setOngletRec((v) => !v)}>
                {ongletRec ? 'Annuler' : '+ Enregistrer une entrée'}
              </Button>
            }
          />

          {ongletRec && (
            <Card style={{ marginTop: 12 }}>
              <form onSubmit={creerRec} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14 }}>
                <div>
                  <label style={LABEL}>Nature</label>
                  <select name="nature" style={CHAMP} defaultValue="reclamation">
                    {NATURES.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LABEL}>Origine</label>
                  <select name="origine" style={CHAMP} defaultValue="apprenant">
                    {ORIGINES.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LABEL}>Gravité</label>
                  <select name="gravite" style={CHAMP} defaultValue="mineure">
                    {GRAVITES.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LABEL}>Reçue le</label>
                  <input name="recue_le" type="date" style={CHAMP} />
                </div>
                <div>
                  <label style={LABEL}>Auteur</label>
                  <input name="auteur_nom" style={CHAMP} />
                </div>
                <div>
                  <label style={LABEL}>Email</label>
                  <input name="auteur_email" type="email" style={CHAMP} />
                </div>
                <div>
                  <label style={LABEL}>Canal</label>
                  <input name="canal" style={CHAMP} placeholder="Email, téléphone, en séance…" />
                </div>
                <div>
                  <label style={LABEL}>Responsable du traitement</label>
                  <input name="responsable" style={CHAMP} placeholder="Moos Coulibaly" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={LABEL}>Objet *</label>
                  <input name="objet" required style={CHAMP} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={LABEL}>Description</label>
                  <textarea name="description" rows={3} style={{ ...CHAMP, resize: 'vertical' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Button type="submit">Enregistrer</Button>
                </div>
              </form>
            </Card>
          )}

          <div style={{ marginTop: 12 }}>
            {loading ? <Skeleton /> : recs.length === 0 ? (
              <EmptyState
                title="Registre vide"
                message="C’est une bonne nouvelle, et c’est recevable en audit tant que le registre existe et qu’il est tenu. Une entrée s’enregistre en quelques secondes le jour où ça arrive."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recs.map((r) => (
                  <Card key={r.id}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, opacity: 0.55 }}>{r.reference}</span>
                          <strong>{r.objet}</strong>
                          <Badge tone={r.gravite === 'critique' ? 'danger' : r.gravite === 'majeure' ? 'warning' : 'neutral'}>
                            {libelle(GRAVITES, r.gravite)}
                          </Badge>
                          <Badge tone={['resolue', 'classee'].includes(r.statut) ? 'success' : 'warning'}>
                            {libelle(STATUTS, r.statut)}
                          </Badge>
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
                          {libelle(NATURES, r.nature)} · {libelle(ORIGINES, r.origine)}
                          {r.auteur_nom && <> · {r.auteur_nom}</>}
                          {' · Reçue le '}{dateFr(r.recue_le)}
                          {r.resolue_le && <> · Clôturée le {dateFr(r.resolue_le)}</>}
                        </div>
                        {r.description && (
                          <p style={{ fontSize: 13, marginTop: 8, marginBottom: 0, whiteSpace: 'pre-line' }}>{r.description}</p>
                        )}
                        {r.action_corrective && (
                          <p style={{ fontSize: 13, marginTop: 6, marginBottom: 0, opacity: 0.8 }}>
                            <strong>Action corrective :</strong> {r.action_corrective}
                          </p>
                        )}
                      </div>
                      <select
                        value={r.statut}
                        onChange={(e) => majRec(r.id, { statut: e.target.value })}
                        style={{ ...CHAMP, width: 'auto' }}
                        aria-label="Statut"
                      >
                        {STATUTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>

      </div>
    </>
  );
}
