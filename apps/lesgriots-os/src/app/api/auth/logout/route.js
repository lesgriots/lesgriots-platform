// POST /api/auth/logout — Destroy session
import { NextResponse } from 'next/server';
import { getTokenFromRequest, deleteSession } from '@/lib/auth';

export async function POST(request) {
  const token = getTokenFromRequest(request);
  if (token) deleteSession(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.set('griot_session', '', { maxAge: 0, path: '/' });
  return response;
}
