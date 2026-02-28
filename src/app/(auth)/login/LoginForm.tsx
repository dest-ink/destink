'use client';

import { useActionState } from 'react';
import { loginUser, type LoginState } from './actions';

export function LoginForm() {
  const [state, action, isPending] = useActionState<LoginState, FormData>(
    loginUser,
    null
  );

  return (
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
          autoComplete="current-password"
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
        {isPending ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
