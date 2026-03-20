import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { apiError } from '@/lib/errors';

export const GET = auth(function GET(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const email = req.auth!.user?.email;
      if (!email) return NextResponse.json({ error: 'No email in session' }, { status: 400 });

      const [user] = await db.select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.email, email));

      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      return NextResponse.json(user);
    } catch (err) {
      const { message, status } = apiError('load profile', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});

export const PATCH = auth(function PATCH(req) {
  if (!req.auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return (async () => {
    try {
      const email = req.auth!.user?.email;
      if (!email) return NextResponse.json({ error: 'No email in session' }, { status: 400 });

      const body = await req.json();
      const updates: Record<string, unknown> = {};
      if ('name' in body && typeof body.name === 'string') updates.name = body.name.trim() || null;
      if ('avatarUrl' in body && typeof body.avatarUrl === 'string') updates.avatarUrl = body.avatarUrl.trim() || null;

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
      }

      const [updated] = await db.update(users)
        .set(updates)
        .where(eq(users.email, email))
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          avatarUrl: users.avatarUrl,
        });

      if (!updated) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      return NextResponse.json(updated);
    } catch (err) {
      const { message, status } = apiError('update profile', err);
      return NextResponse.json({ error: message }, { status });
    }
  })();
});
