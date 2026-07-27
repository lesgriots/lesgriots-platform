/**
 * /api/auth/code — entrer avec le code affiché sur un appareil déjà connecté.
 *
 * Public par nécessité : c'est une porte d'entrée. Le code EST
 * l'authentification, donc mêmes garde-fous que le lien à usage unique —
 * validité de dix minutes, usage unique, utilisateur actif — plus une limite
 * d'essais par adresse, pour qu'une machine ne puisse pas tenter sa chance.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { createSession } from '@/lib/auth';

// Mémoire de processus : suffisant pour freiner un script, et remis à zéro au
// redémarrage. Ce n'est pas un pare-feu, c'est un ralentisseur.
const essais = new Map();
const MAX_ESSAIS = 10;
const FENETRE = 10 * 60000;

function tropDEssais(ip) {
  const maintenant = Date.now();
  const liste = (essais.get(ip) || []).filter((t) => maintenant - t < FENETRE);
  liste.push(maintenant);
  essais.set(ip, liste);
  return liste.length > MAX_ESSAIS;
}

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'inconnue';
    if (tropDEssais(ip)) {
      return NextResponse.json({ error: 'Trop de tentatives. Réessaie dans dix minutes.' }, { status: 429 });
    }

    const { code } = await request.json();
    const propre = String(code || '').trim().toUpperCase().replace(/\s/g, '');
    if (!propre) return NextResponse.json({ error: 'Code manquant' }, { status: 400 });

    const db = getDb();
    const lien = db.prepare(`
      SELECT l.*, u.is_active FROM login_links l
      JOIN users u ON u.id = l.user_id
      WHERE l.token = ?
    `).get(propre);

    // Réponse identique dans tous les cas d'échec : on ne dit pas si le code
    // existe, s'il a expiré ou s'il a déjà servi.
    const invalide = !lien || lien.used_at || !lien.is_active
      || new Date(lien.expires_at) < new Date();
    if (invalide) {
      return NextResponse.json({ error: 'Code invalide ou expiré.' }, { status: 401 });
    }

    db.prepare(`UPDATE login_links SET used_at = datetime('now') WHERE id = ?`).run(lien.id);
    db.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`).run(lien.user_id);

    const session = createSession(lien.user_id);
    const reponse = NextResponse.json({ ok: true });
    reponse.cookies.set('griot_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    return reponse;
  } catch (e) {
    console.error('[auth/code]', e);
    return NextResponse.json({ error: 'Connexion impossible.' }, { status: 500 });
  }
}
