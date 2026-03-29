import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);

  if (count === 0) {
    redirect('/setup');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="font-mono text-sm font-semibold tracking-widest uppercase text-primary">
            Destink
          </span>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-lg shadow p-6">
          <h1 className="text-base font-semibold mb-5">Welcome back</h1>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
