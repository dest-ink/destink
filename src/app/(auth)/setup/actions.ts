'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { signIn } from '@/auth';

const setupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
});

export type SetupState = {
  error?: string;
} | null;

export async function setupFirstUser(
  _prevState: SetupState,
  formData: FormData
): Promise<SetupState> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  };

  const parsed = setupSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }

  const { email, password, confirmPassword } = parsed.data;

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' };
  }

  // Check if any users already exist
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);

  if (count > 0) {
    return { error: 'Setup already complete' };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await db.insert(users).values({ email, passwordHash });
  } catch (err: unknown) {
    // Handle unique constraint violation
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('unique') || message.includes('duplicate')) {
      return { error: 'Setup already complete' };
    }
    return { error: 'Failed to create account' };
  }

  // Sign in and redirect
  await signIn('credentials', { email, password, redirectTo: '/get-started' });

  // signIn throws a redirect, so this line is unreachable
  return null;
}
