import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

/**
 * GET /api/sirene?q=nom+entreprise&code_postal=75010&limit=5
 * Proxy vers l'API Sirene (recherche-entreprises.api.gouv.fr)
 * Retourne les résultats formatés pour pré-remplir un formulaire client.
 */
async function _GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  if (!q) {
    return NextResponse.json({ error: 'Paramètre "q" requis' }, { status: 400 });
  }

  const params = new URLSearchParams({
    q,
    per_page: searchParams.get('limit') || '5',
  });
  if (searchParams.get('code_postal')) {
    params.set('code_postal', searchParams.get('code_postal'));
  }

  try {
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?${params}`,
      { next: { revalidate: 3600 } } // cache 1h
    );
    if (!res.ok) {
      return NextResponse.json({ error: `API Sirene: ${res.status}` }, { status: 502 });
    }
    const data = await res.json();

    const results = (data.results || []).map(e => {
      const s = e.siege || {};
      const adresseComplete = [
        s.numero_voie, s.type_voie, s.libelle_voie
      ].filter(Boolean).join(' ');

      return {
        siren: e.siren || '',
        siret: s.siret || '',
        nom_complet: e.nom_complet || e.nom_raison_sociale || '',
        sigle: e.sigle || '',
        nature_juridique: e.nature_juridique || '',
        activite: e.activite_principale || '',
        section_activite: e.section_activite_principale || '',
        date_creation: e.date_creation || '',
        etat: e.etat_administratif === 'A' ? 'Active' : 'Fermée',
        adresse: adresseComplete,
        complement_adresse: s.complement_adresse || '',
        code_postal: s.code_postal || '',
        commune: s.libelle_commune || s.commune || '',
        dirigeants: (e.dirigeants || []).map(d => ({
          nom: d.nom || '',
          prenom: d.prenoms || '',
          qualite: d.qualite || '',
        })),
        est_organisme_formation: e.complements?.est_organisme_formation || false,
        est_qualiopi: e.complements?.est_qualiopi || false,
      };
    });

    return NextResponse.json({ results, total: data.total_results || 0 });
  } catch (err) {
    console.error('[sirene] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Exports protégés (auth + permissions — voir src/lib/api-guard.js) ──
export const GET = withGuard('clients:read', _GET);
