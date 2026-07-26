/**
 * LES GRIOTS OS — Auth & RBAC
 *
 * Système d'authentification par token + rôles (admin, manager, collaborateur).
 * Google OAuth via NextAuth + magic link email en backup.
 */

import { getDb } from './db.mjs';
import crypto from 'crypto';

// ── Rôles et permissions ──

export const ROLES = {
  admin: {
    label: 'Administrateur',
    description: 'Accès complet — finances, paramètres, gestion des utilisateurs',
    level: 100,
  },
  manager: {
    label: 'Manager',
    description: 'Créer/modifier projets, clients, formations. Pas les paramètres ni la gestion users.',
    level: 50,
  },
  collaborateur: {
    label: 'Collaborateur',
    description: 'Accès aux projets et tâches assignés. Consultation.',
    level: 10,
  },
};

// Permissions par ressource et action
const PERMISSIONS = {
  // Agence
  'projects:read':       ['admin', 'manager', 'collaborateur'],
  'projects:create':     ['admin', 'manager'],
  'projects:update':     ['admin', 'manager'],
  'projects:delete':     ['admin'],
  'projects:finances':   ['admin'],

  'clients:read':        ['admin', 'manager'],
  'clients:create':      ['admin', 'manager'],
  'clients:update':      ['admin', 'manager'],
  'clients:delete':      ['admin'],

  'providers:read':      ['admin', 'manager', 'collaborateur'],
  'providers:create':    ['admin', 'manager'],
  'providers:update':    ['admin', 'manager'],
  'providers:delete':    ['admin'],

  'expenses:read':       ['admin'],
  'expenses:create':     ['admin'],
  'expenses:update':     ['admin'],
  'expenses:delete':     ['admin'],

  // Production
  'tasks:read':          ['admin', 'manager', 'collaborateur'],
  'tasks:create':        ['admin', 'manager', 'collaborateur'],
  'tasks:update':        ['admin', 'manager', 'collaborateur'],
  'tasks:delete':        ['admin', 'manager'],

  'phases:read':         ['admin', 'manager', 'collaborateur'],
  'phases:create':       ['admin', 'manager'],
  'phases:update':       ['admin', 'manager'],
  'phases:delete':       ['admin'],

  // Emails (journal des envois + envoi manuel)
  'emails:read':         ['admin', 'manager'],
  'emails:send':         ['admin', 'manager'],

  // Organisme & qualité (pilotage de l'OF : pièces officielles, réclamations)
  'organisme:read':      ['admin', 'manager'],
  'organisme:create':    ['admin'],
  'organisme:update':    ['admin'],
  'organisme:delete':    ['admin'],
  'qualite:read':        ['admin', 'manager'],
  'qualite:create':      ['admin', 'manager'],
  'qualite:update':      ['admin', 'manager'],
  'qualite:delete':      ['admin'],

  // Griothèque
  'formations:read':     ['admin', 'manager'],
  'formations:create':   ['admin', 'manager'],
  'formations:update':   ['admin', 'manager'],
  'formations:delete':   ['admin'],

  'sessions:read':       ['admin', 'manager'],
  'sessions:create':     ['admin', 'manager'],
  'sessions:update':     ['admin', 'manager'],
  'sessions:delete':     ['admin'],

  'apprenants:read':     ['admin', 'manager'],
  'apprenants:create':   ['admin', 'manager'],
  'apprenants:update':   ['admin', 'manager'],
  'apprenants:delete':   ['admin'],

  // Admin
  'settings:read':       ['admin'],
  'settings:update':     ['admin'],
  'users:read':          ['admin'],
  'users:create':        ['admin'],
  'users:update':        ['admin'],
  'users:delete':        ['admin'],

  // Dashboard data — également utilisé pour la lecture de /api/cockpit et /api/treasury.
  // (/api/data est accessible à tous les rôles connectés, avec filtrage par rôle dans le handler.)
  'data:read':           ['admin', 'manager'],
  'team:read':           ['admin', 'manager'],
  'team:create':         ['admin', 'manager'],
  'team:update':         ['admin', 'manager'],
  'team:delete':         ['admin'],
};

// ── Helpers ──

export function hasPermission(role, permission) {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}

export function requireRole(role, minRole) {
  const roleLevel = ROLES[role]?.level || 0;
  const minLevel = ROLES[minRole]?.level || 999;
  return roleLevel >= minLevel;
}

// ── Session management ──

export function createSession(userId) {
  const db = getDb();

  // Purge paresseuse à chaque login (événement rare) : empêche la croissance
  // illimitée de sessions_auth et invitations sans cron dédié.
  db.prepare(`DELETE FROM sessions_auth WHERE expires_at < datetime('now')`).run();
  db.prepare(`DELETE FROM invitations WHERE used = 1 OR expires_at < datetime('now')`).run();

  const token = crypto.randomBytes(32).toString('hex');
  const id = `sess_${crypto.randomUUID().slice(0, 8)}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  db.prepare(`INSERT INTO sessions_auth (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`).run(
    id, userId, token, expiresAt
  );

  // Update last_login
  db.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`).run(userId);

  return { token, expiresAt };
}

export function validateSession(token) {
  if (!token) return null;
  const db = getDb();
  const session = db.prepare(`
    SELECT sa.*, u.email, u.name, u.role, u.avatar_url, u.is_active
    FROM sessions_auth sa
    JOIN users u ON sa.user_id = u.id
    WHERE sa.token = ? AND sa.expires_at > datetime('now')
  `).get(token);

  if (!session || !session.is_active) return null;

  return {
    userId: session.user_id,
    email: session.email,
    name: session.name,
    role: session.role,
    avatarUrl: session.avatar_url,
  };
}

export function deleteSession(token) {
  const db = getDb();
  db.prepare(`DELETE FROM sessions_auth WHERE token = ?`).run(token);
}

// ── Token extraction from request ──

export function getTokenFromRequest(request) {
  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check cookie
  const cookies = request.headers.get('cookie') || '';
  const match = cookies.match(/griot_session=([^;]+)/);
  return match ? match[1] : null;
}

export function getSessionFromRequest(request) {
  const token = getTokenFromRequest(request);
  return validateSession(token);
}

// ── Invitation system ──

export function createInvitation(email, role, invitedBy) {
  const db = getDb();
  const id = `inv_${crypto.randomUUID().slice(0, 8)}`;
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  db.prepare(`INSERT INTO invitations (id, email, role, token, invited_by, expires_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    id, email, role, token, invitedBy, expiresAt
  );

  return { id, token, expiresAt };
}

export function validateInvitation(token) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM invitations
    WHERE token = ? AND used = 0 AND expires_at > datetime('now')
  `).get(token);
}

export function acceptInvitation(token, userId) {
  const db = getDb();
  db.prepare(`UPDATE invitations SET used = 1 WHERE token = ?`).run(token);
}
