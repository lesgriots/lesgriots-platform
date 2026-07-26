// GET /api/auth/me — Get current user info
import { NextResponse } from 'next/server';
import { withGuard } from '@/lib/api-guard';

// Session simple : pas de permission requise, juste être authentifié.
export const GET = withGuard(null, async (request, ctx, session) => {
  return NextResponse.json(session);
});
