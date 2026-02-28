'use server';

import { AuthError } from 'next-auth';
import { signIn } from '@/auth';

export type LoginState = {
  error?: string;
} | null;

export async function loginUser(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  try {
    await signIn('credentials', formData);
    return null;
  } catch (err) {
    if (err instanceof AuthError) {
      switch (err.type) {
        case 'CredentialsSignin':
          return { error: 'Invalid email or password' };
        default:
          return { error: 'Something went wrong. Please try again.' };
      }
    }
    // Re-throw non-AuthError (allows Next.js redirect handling)
    throw err;
  }
}
