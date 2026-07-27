/**
 * /api/auth/appareil — connecter un autre appareil, depuis un appareil déjà
 * connecté.
 *
 * Le problème : Google OAuth n'est pas configuré, et le lien à usage unique se
 * génère en SSH sur le serveur. Sur un téléphone, il n'y avait donc aucune
 * façon d'entrer. Ici, on émet un code court, lisible et tapable à la main,
 * valable dix minutes et une seule fois.
 *
 * Un code de huit caractères pris dans un alphabet de 32 vaut mille milliards
 * de combinaisons : assez pour dix minutes de validité, et l'émission exige
 * déjà une session valide.
 */
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';

// Sans I, O, 0, 1 : personne ne doit hésiter en recopiant.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function codeLisible() {
  const octets = crypto.randomBytes(8);
  const lettres = [...octets].map((o) => ALPHABET[o % ALPHABET.length]).join('');
  return lettres.slice(0, 4) + '-' + lettres.slice(4, 8);
}

async function _POST(request, ctx, session) {
  try {
    const db = getDb();
    const code = codeLisible();
    const expire = new Date(Date.now() + 10 * 60000).toISOString();

    db.prepare(`
      INSERT INTO login_links (id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `).run('lnk_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
           session.userId, code, expire);

    return NextResponse.json({ code, expire_le: expire });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const POST = withGuard(null, _POST);
