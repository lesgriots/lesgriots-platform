/**
 * /api/griotheque/financeurs — qui paie les formations.
 *
 * L'information existe déjà, mais éparpillée et écrite à la main : le
 * dispositif est saisi en texte libre sur l'inscription ET sur l'apprenant
 * (« OPCO », « Prise en charge par un OPCO », « OPCO ATLAS »…), tandis que
 * l'organisme précis vit dans deux colonnes séparées, `orga_opco` et `faf`.
 *
 * On ne réécrit rien en base. On regroupe à la lecture : les variantes d'un
 * même dispositif tombent dans la même famille, et les organismes nommés
 * (AFDAS, ATLAS, L'OPCOMMERCE, AGEFICE…) remontent avec leurs apprenants et
 * le montant réellement engagé.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

const sansAccent = (t) => String(t || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const FAMILLES = [
  { cle: 'cpf',           label: 'CPF',                  test: (t) => t.includes('cpf') },
  { cle: 'opco',          label: 'OPCO',                 test: (t) => t.includes('opco') },
  { cle: 'fifpl',         label: 'FIF PL',               test: (t) => t.includes('fifpl') || t.includes('fif pl') },
  { cle: 'faf',           label: 'FAF',                  test: (t) => t.includes('faf') || t.includes('agefice') },
  { cle: 'entreprise',    label: 'Entreprise',           test: (t) => t.includes('entreprise') },
  { cle: 'personnel',     label: 'Financement personnel', test: (t) => t.includes('personnel') || t.includes('auto') },
];

function famille(texte) {
  const t = sansAccent(texte);
  if (!t) return { cle: 'non_renseigne', label: 'Non renseigné' };
  const f = FAMILLES.find((x) => x.test(t));
  return f ? { cle: f.cle, label: f.label } : { cle: 'autre', label: texte };
}

async function _GET() {
  try {
    const db = getDb();

    const lignes = db.prepare(`
      SELECT a.id, a.first_name, a.last_name, a.company,
             a.financement AS fin_apprenant, a.orga_opco, a.faf,
             i.financement AS fin_inscription,
             COALESCE(i.price_ht, 0) AS montant,
             i.session_id
      FROM apprenants a
      LEFT JOIN inscriptions i ON i.apprenant_id = a.id
    `).all();

    // ── Par dispositif ────────────────────────────────────────────────
    const parFamille = new Map();
    const vusParFamille = new Map();     // pour ne pas compter deux fois un apprenant

    for (const l of lignes) {
      // L'inscription fait foi ; l'apprenant sert de repli.
      const f = famille(l.fin_inscription || l.fin_apprenant);
      if (!parFamille.has(f.cle)) {
        parFamille.set(f.cle, { cle: f.cle, label: f.label, apprenants: 0, inscriptions: 0, montant: 0 });
        vusParFamille.set(f.cle, new Set());
      }
      const e = parFamille.get(f.cle);
      if (l.session_id) { e.inscriptions += 1; e.montant += Number(l.montant) || 0; }
      const vus = vusParFamille.get(f.cle);
      if (!vus.has(l.id)) { vus.add(l.id); e.apprenants += 1; }
    }

    // ── Organismes nommés ─────────────────────────────────────────────
    const organismes = new Map();
    for (const l of lignes) {
      for (const [nom, type] of [[l.orga_opco, 'OPCO'], [l.faf, 'FAF']]) {
        const propre = String(nom || '').trim();
        if (!propre) continue;
        const cle = type + '·' + propre.toUpperCase();
        if (!organismes.has(cle)) {
          organismes.set(cle, { nom: propre, type, montant: 0, apprenants: [], _vus: new Set() });
        }
        const o = organismes.get(cle);
        if (l.session_id) o.montant += Number(l.montant) || 0;
        if (!o._vus.has(l.id)) {
          o._vus.add(l.id);
          o.apprenants.push({
            id: l.id,
            nom: [l.first_name, l.last_name].filter(Boolean).join(' ') || 'Sans nom',
            entreprise: l.company || '',
          });
        }
      }
    }

    const listeOrganismes = [...organismes.values()]
      .map(({ _vus, ...o }) => ({ ...o, nb: o.apprenants.length }))
      .sort((a, b) => b.nb - a.nb || a.nom.localeCompare(b.nom));

    const listeFamilles = [...parFamille.values()]
      .sort((a, b) => b.montant - a.montant || b.apprenants - a.apprenants);

    const priseEnCharge = listeFamilles
      .filter((f) => !['non_renseigne', 'personnel'].includes(f.cle))
      .reduce((t, f) => t + f.montant, 0);

    return NextResponse.json({
      familles: listeFamilles,
      organismes: listeOrganismes,
      total_pris_en_charge: priseEnCharge,
      non_renseigne: (parFamille.get('non_renseigne') || {}).apprenants || 0,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('formations:read', _GET);
