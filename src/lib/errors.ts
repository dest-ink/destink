/**
 * Maps caught errors to user-facing actionable messages.
 * Per user decision: no generic "Internal server error" — every error tells
 * the user what happened and what to do about it.
 */
export function apiError(operation: string, err: unknown): { message: string; status: number } {
  const e = err instanceof Error ? err : new Error(String(err));

  // Database connection errors
  if (e.message.includes('ECONNREFUSED') || e.message.includes('connection'))
    return { message: `Failed to ${operation} — database connection lost. Check that PostgreSQL is running.`, status: 503 };

  // Unique constraint violations
  if (e.message.includes('unique') || e.message.includes('duplicate'))
    return { message: `Failed to ${operation} — a record with these details already exists.`, status: 409 };

  // Foreign key violations
  if (e.message.includes('foreign key') || e.message.includes('violates'))
    return { message: `Failed to ${operation} — the referenced record no longer exists. Try refreshing the page.`, status: 409 };

  // Timeout
  if (e.message.includes('timeout') || e.message.includes('ETIMEDOUT'))
    return { message: `Failed to ${operation} — the request timed out. Try again in a moment.`, status: 504 };

  // AI/external API errors (for research, voice, publishing)
  if (e.message.includes('API') || e.message.includes('rate limit') || e.message.includes('429'))
    return { message: `Failed to ${operation} — external API rate limit hit. Wait a minute and retry.`, status: 429 };

  if (e.message.includes('API key') || e.message.includes('unauthorized') || e.message.includes('401'))
    return { message: `Failed to ${operation} — API key is invalid or expired. Check your configuration.`, status: 502 };

  // Default: still actionable, includes the operation context
  return { message: `Failed to ${operation} — an unexpected error occurred. Check the server logs for details.`, status: 500 };
}
