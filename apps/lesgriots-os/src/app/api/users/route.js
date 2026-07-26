// GET /api/users — List all users (admin only)
// POST /api/users — Invite a new user (admin only)
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { createInvitation } from '@/lib/auth';
import { withGuard, badRequest } from '@/lib/api-guard';

export const GET = withGuard('users:read', async (request) => {
  const db = getDb();
  const users = db.prepare(`
    SELECT id, email, name, avatar_url, role, is_active, last_login, created_at
    FROM users ORDER BY created_at DESC
  `).all();

  const invitations = db.prepare(`
    SELECT id, email, role, used, expires_at, created_at
    FROM invitations ORDER BY created_at DESC
  `).all();

  return NextResponse.json({ users, invitations });
});

export const POST = withGuard('users:create', async (request, ctx, session) => {
  const body = await request.json();
  const { email, role = 'collaborateur' } = body;

  if (!email || typeof email !== 'string' || email.length > 320) {
    return badRequest('Email requis');
  }

  if (!['admin', 'manager', 'collaborateur'].includes(role)) {
    return badRequest('Rôle invalide');
  }

  // Check if user already exists
  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return NextResponse.json({ error: 'Cet utilisateur existe déjà' }, { status: 409 });
  }

  // Create invitation
  const invitation = createInvitation(email, role, session.userId);

  return NextResponse.json({
    ok: true,
    invitation: {
      id: invitation.id,
      email,
      role,
      link: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login?invite=${invitation.token}`,
      expiresAt: invitation.expiresAt,
    },
  });
});
