import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { SetupForm } from './SetupForm';

export default async function SetupPage() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);

  if (count > 0) {
    redirect('/login');
  }

  return <SetupForm />;
}
