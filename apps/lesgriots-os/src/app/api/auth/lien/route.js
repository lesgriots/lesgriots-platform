/**
 * /api/auth/lien?token=… — connexion par lien à usage unique.
 *
 * Voie d'entrée de secours quand Google OAuth n'est pas configuré. Le lien est
 * généré côté serveur (`node scripts/lien-connexion.mjs`) et remis de la main à
 * la main : aucun envoi d'email n'est nécessaire.
 *
 * Garde-fous : token de 32 octets, validité courte, usage unique (used_at),
 * utilisateur devant exister et être actif. Le lien vaut mot de passe le temps
 * d'un clic — il ne doit pas être partagé ni laissé dans un historique.
 */
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { createSession } from '@/lib/auth';

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

export async function GET(request) {
  try {
    const token = new URL(request.url).searchParams.get('token') || '';
    if (!token) return NextResponse.redirect(`${BASE_URL}/login?error=lien_absent`);

    const db = getDb();
    const lien = db.prepare(`
      SELECT l.*, u.is_active
      FROM login_links l
      JOIN users u ON u.id = l.user_id
      WHERE l.token = ?
    `).get(token);

    // Message volontairement identique dans tous les cas d'échec : on ne dit
    // pas à un curieux si le token existe, s'il a expiré ou s'il a servi.
    const invalide = !lien
      || lien.used_at
      || !lien.is_active
      || new Date(lien.expires_at) < new Date();
    if (invalide) return NextResponse.redirect(`${BASE_URL}/login?error=lien_invalide`);

    db.prepare(`UPDATE login_links SET used_at = datetime('now') WHERE id = ?`).run(lien.id);
    db.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`).run(lien.user_id);

    const session = createSession(lien.user_id);
    const response = NextResponse.redirect(`${BASE_URL}/`);
    response.cookies.set('griot_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    return response;
  } catch (e) {
    console.error('[auth/lien]', e);
    return NextResponse.redirect(`${BASE_URL}/login?error=lien_invalide`);
  }
}
