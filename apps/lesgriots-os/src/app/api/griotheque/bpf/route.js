/**
 * /api/griotheque/bpf — la déclaration annuelle, calculée puis complétée.
 *
 * GET  : renvoie le calcul de l'exercice, fusionné avec les corrections déjà
 *        saisies. PUT : enregistre ces corrections dans les réglages, sous la
 *        clé bpf_<année>, sans jamais toucher aux données d'origine.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { calculerBpf, LIGNES_PRODUITS } from './calcul.mjs';

const reglage = (db, cle, defaut = '') => {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(cle);
  return r ? r.value : defaut;
};

async function _GET(request) {
  try {
    const db = getDb();
    const params = new URL(request.url).searchParams;
    const annee = Number(params.get('annee')) || new Date().getFullYear() - 1;

    const calcul = calculerBpf(db, annee);

    let saisi = {};
    try { saisi = JSON.parse(reglage(db, `bpf_${annee}`, '{}')) || {}; } catch { saisi = {}; }

    // Les années pour lesquelles il existe au moins une session.
    const annees = db.prepare(`
      SELECT DISTINCT substr(start_date, 1, 4) AS a FROM sessions
      WHERE start_date <> '' ORDER BY a DESC
    `).all().map((r) => Number(r.a)).filter(Boolean);

    return NextResponse.json({
      ...calcul,
      lignes: LIGNES_PRODUITS,
      saisi,
      annees_disponibles: annees.length ? annees : [new Date().getFullYear()],
      organisme: {
        raison_sociale: reglage(db, 'company_name', 'LES GRIOTS'),
        siret: reglage(db, 'siret'),
        nda: reglage(db, 'nda') || reglage(db, 'numero_declaration'),
        adresse: reglage(db, 'address') || reglage(db, 'adresse'),
        code_postal: reglage(db, 'postal_code') || reglage(db, 'code_postal'),
        ville: reglage(db, 'city') || reglage(db, 'ville'),
        email: reglage(db, 'email'),
        telephone: reglage(db, 'phone') || reglage(db, 'telephone'),
        forme_juridique: reglage(db, 'forme_juridique', 'Société par actions simplifiée unipersonnelle (SASU)'),
        representant: reglage(db, 'representant_name'),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _PUT(request) {
  try {
    const db = getDb();
    const corps = await request.json();
    const annee = Number(corps.annee);
    if (!annee) return NextResponse.json({ error: 'Année manquante' }, { status: 400 });

    db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(`bpf_${annee}`, JSON.stringify(corps.saisi || {}));

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('formations:read', _GET);
export const PUT = withGuard('formations:update', _PUT);
