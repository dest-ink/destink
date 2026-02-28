/**
 * Next.js instrumentation hook — runs once when the Node.js server starts.
 *
 * In Next.js 15+ this hook is stable (no experimental flag required).
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Dynamic imports are used inside the function body (rather than top-level
 * imports) so the server-only registry modules are never evaluated in
 * Edge runtime contexts.
 */
export async function register() {
  // Only run in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initRegistries } = await import('@/lib/bootstrap');
    await initRegistries();
  }
}
