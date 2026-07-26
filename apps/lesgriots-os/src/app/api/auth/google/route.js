// GET /api/auth/google — Redirect to Google OAuth
// GET /api/auth/google?code=xxx — Handle callback
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { createSession } from '@/lib/auth';
import crypto from 'crypto';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const REDIRECT_URI = `${BASE_URL}/api/auth/google`;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  // Step 1: No code → redirect to Google
  if (!code) {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });
    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  }

  // Step 2: Exchange code for tokens
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      console.error('Google token exchange failed:', await tokenRes.text());
      return NextResponse.redirect(`${BASE_URL}/login?error=google_token_failed`);
    }

    const tokens = await tokenRes.json();

    // Step 3: Get user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const googleUser = await userRes.json();

    // Step 4: Find or reject user
    const db = getDb();
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(googleUser.email);

    if (!user) {
      // Check if there's a pending invitation
      const invitation = db.prepare(`
        SELECT * FROM invitations WHERE email = ? AND used = 0 AND expires_at > datetime('now')
      `).get(googleUser.email);

      if (invitation) {
        // Create user from invitation
        const userId = `usr_${crypto.randomUUID().slice(0, 8)}`;
        db.prepare(`INSERT INTO users (id, email, name, avatar_url, role) VALUES (?, ?, ?, ?, ?)`).run(
          userId, googleUser.email, googleUser.name || '', googleUser.picture || '', invitation.role
        );
        db.prepare(`UPDATE invitations SET used = 1 WHERE id = ?`).run(invitation.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      } else {
        // No user, no invitation → access denied
        return NextResponse.redirect(`${BASE_URL}/login?error=not_authorized`);
      }
    }

    if (!user.is_active) {
      return NextResponse.redirect(`${BASE_URL}/login?error=account_disabled`);
    }

    // Update avatar if changed
    if (googleUser.picture && googleUser.picture !== user.avatar_url) {
      db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(googleUser.picture, user.id);
    }

    // Step 5: Create session
    const session = createSession(user.id);

    // Step 6: Redirect to app with cookie
    const response = NextResponse.redirect(`${BASE_URL}/`);
    response.cookies.set('griot_session', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (err) {
    console.error('Google auth error:', err);
    return NextResponse.redirect(`${BASE_URL}/login?error=auth_failed`);
  }
}
