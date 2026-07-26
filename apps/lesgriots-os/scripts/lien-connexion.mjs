#!/usr/bin/env node
/**
 * Génère un lien de connexion à usage unique pour LES GRIOTHÈQUE OS.
 *
 * Sert quand Google OAuth n'est pas (encore) configuré : le lien est affiché
 * dans le terminal et remis de la main à la main — aucun email requis.
 *
 * Usage, depuis apps/lesgriots-os/ sur le serveur :
 *   sudo -u deployment node scripts/lien-connexion.mjs
 *   sudo -u deployment node scripts/lien-connexion.mjs autre@email.com 60
 *
 * Arguments : [email] [durée en minutes, défaut 20]
 * L'email doit correspondre à un utilisateur existant et actif.
 */
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const EMAIL_PAR_DEFAUT = 'moos.coulibaly@gmail.com';
const email = (process.argv[2] || EMAIL_PAR_DEFAUT).toLowerCase().trim();
const minutes = Math.min(Math.max(parseInt(process.argv[3] || '20', 10) || 20, 1), 240);

const db = new Database(path.join(process.cwd(), 'data', 'lesgriots.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const user = db.prepare('SELECT id, email, name, role, is_active FROM users WHERE lower(email) = ?').get(email);
if (!user) {
  console.error(`✗ Aucun utilisateur avec l'email ${email}.`);
  console.error('  Comptes existants :');
  for (const u of db.prepare('SELECT email, role, is_active FROM users').all()) {
    console.error(`    · ${u.email} (${u.role}${u.is_active ? '' : ', désactivé'})`);
  }
  process.exit(1);
}
if (!user.is_active) {
  console.error(`✗ Le compte ${email} est désactivé.`);
  process.exit(1);
}

// Ménage : les liens périmés ou déjà utilisés n'ont aucune raison de rester.
db.prepare("DELETE FROM login_links WHERE used_at IS NOT NULL OR expires_at < datetime('now')").run();

const token = crypto.randomBytes(32).toString('hex');
const id = `lnk_${crypto.randomUUID().slice(0, 8)}`;
const expires = new Date(Date.now() + minutes * 60_000).toISOString();

db.prepare('INSERT INTO login_links (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)')
  .run(id, user.id, token, expires);

const base = process.env.NEXTAUTH_URL || 'https://app.lagriotheque.com';

console.log('');
console.log(`  Compte  : ${user.email} (${user.role})`);
console.log(`  Validité: ${minutes} min — usage unique`);
console.log('');
console.log(`  ${base}/api/auth/lien?token=${token}`);
console.log('');
console.log('  À ouvrir dans le navigateur. Le lien devient inutilisable après le premier clic.');
console.log('');
