import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Extract the user ID from a NextAuth session object.
 * Works with both email-based and sub-based JWT tokens.
 */
export async function getUserId(auth: { user?: { email?: string | null }; token?: { sub?: string } } | null | undefined): Promise<string | null> {
  if (!auth) return null;

  const email = auth.user?.email;
  const sub = (auth as unknown as { token?: { sub?: string } })?.token?.sub;

  if (email) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    return user?.id ?? null;
  }

  if (sub) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, sub));
    return user?.id ?? null;
  }

  return null;
}
