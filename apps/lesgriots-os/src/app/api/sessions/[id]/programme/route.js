/**
 * /api/sessions/:id/programme — le programme de la session, en PDF.
 *
 * Cette route servait encore l'ancien générateur Python, alors que la
 * maquette maison existait ailleurs. Une convocation partait donc avec un
 * programme d'une génération précédente, sans que rien ne le signale.
 *
 * Elle appelle désormais la fabrique unique, comme toutes les autres portes.
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.mjs';
import { withGuard } from '@/lib/api-guard';
import { rendreDocumentSession } from '@/lib/documents-session.mjs';

async function _GET(req, { params }) {
  try {
    const { id } = await params;
    const { pdf, nom } = await rendreDocumentSession(getDb(), 'programme', id);
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nom}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = withGuard('sessions:read', _GET);
