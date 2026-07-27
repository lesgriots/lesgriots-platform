/**
 * /api/auth/motdepasse — entrer sans dépendre de personne.
 *
 * POST : se connecter avec son email et son mot de passe. Public par
 *        nécessité, avec limite d'essais par adresse.
 * PUT  : définir ou changer son propre mot de passe. Exige une session, donc
 *        on ne peut pas se l'attribuer depuis l'extérieur.
 *
 * Cette voie existe parce que les trois autres supposent quelque chose :
 * le lien à usage unique suppose un accès au serveur, le code suppose un
 * appareil déjà connecté, le lien par email suppose une boîte configurée.
 * Le mot de passe ne suppose rien.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import {
  createSession, empreinteMotDePasse, verifierMotDePasse, motDePasseAcceptable,
} from '@/lib/auth';

// Ralentisseur en mémoire : remis à zéro au redémarrage, suffisant pour
// décourager un script. Ce n'est pas un pare-feu.
const essais = new Map();
const MAX = 8;
const FENETRE = 15 * 60000;

function tropDEssais(cle) {
  const t = Date.now();
  const liste = (essais.get(cle) || []).filter((x) => t - x < FENETRE);
  liste.push(t);
  essais.set(cle, liste);
  return liste.length > MAX;
}

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'inconnue';
    const { email, motdepasse } = await request.json();
    const adresse = String(email || '').trim().toLowerCase();

    if (tropDEssais(ip + '|' + adresse)) {
      return NextResponse.json({ error: 'Trop de tentatives. Réessaie dans un quart d’heure.' }, { status: 429 });
    }
    if (!adresse || !motdepasse) {
      return NextResponse.json({ error: 'Email et mot de passe requis.' }, { status: 400 });
    }

    const db = getDb();
    const u = db.prepare('SELECT id, password_hash, is_active FROM users WHERE lower(email) = ?').get(adresse);

    // Réponse identique dans tous les cas : on ne dit pas si le compte existe.
    if (!u || !u.is_active || !verifierMotDePasse(motdepasse, u.password_hash)) {
      return NextResponse.json({ error: 'Email ou mot de passe incorrect.' }, { status: 401 });
    }

    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(u.id);
    const session = createSession(u.id);
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
    console.error('[auth/motdepasse]', e);
    return NextResponse.json({ error: 'Connexion impossible.' }, { status: 500 });
  }
}

async function _PUT(request, ctx, session) {
  try {
    const { motdepasse } = await request.json();
    const refus = motDePasseAcceptable(motdepasse);
    if (refus) return NextResponse.json({ error: refus }, { status: 400 });

    const db = getDb();
    db.prepare("UPDATE users SET password_hash = ?, password_set_at = datetime('now') WHERE id = ?")
      .run(empreinteMotDePasse(motdepasse), session.userId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function _GET(request, ctx, session) {
  const db = getDb();
  const u = db.prepare('SELECT password_set_at FROM users WHERE id = ?').get(session.userId);
  return NextResponse.json({ defini: Boolean(u && u.password_set_at) });
}

export const GET = withGuard(null, _GET);
export const PUT = withGuard(null, _PUT);
