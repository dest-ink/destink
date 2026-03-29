import { NextResponse } from 'next/server';
import { auth } from '@/auth';

/**
 * GET /api/linkedin/status
 *
 * Returns whether LinkedIn OAuth is available (i.e. LINKEDIN_CLIENT_ID is configured).
 */
export const GET = auth(function GET(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({ available: !!process.env.LINKEDIN_CLIENT_ID });
});
