'use client';

import { useActionState } from 'react';
import { setupFirstUser, type SetupState } from './actions';

export function SetupForm() {
  const [state, action, isPending] = useActionState<SetupState, FormData>(
    setupFirstUser,
    null
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="font-mono text-sm font-semibold tracking-widest uppercase text-primary">
            Orbitl
          </span>
          <p className="mt-2 text-sm text-muted-foreground">Create your account to get started</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-lg shadow p-6">
          <h1 className="text-base font-semibold mb-5">Set up your account</h1>

          <form action={action} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
                className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                className="h-9 px-3 rounded-md border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
