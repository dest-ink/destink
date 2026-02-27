import { db, pool } from '@/db/client';
import { researchRuns, drafts, publishQueue } from '@/db/schema';
import { and, eq, gte, count } from 'drizzle-orm';

async function main(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const [researchResult] = await db
      .select({ count: count() })
      .from(researchRuns)
      .where(gte(researchRuns.runAt, cutoff));

    const [draftResult] = await db
      .select({ count: count() })
      .from(drafts)
      .where(gte(drafts.createdAt, cutoff));

    const [publishedResult] = await db
      .select({ count: count() })
      .from(publishQueue)
      .where(
        and(
          eq(publishQueue.status, 'published'),
          gte(publishQueue.publishedAt, cutoff),
        ),
      );

    const [failedResult] = await db
      .select({ count: count() })
      .from(publishQueue)
      .where(
        and(
          eq(publishQueue.status, 'failed'),
          gte(publishQueue.createdAt, cutoff),
        ),
      );

    // Use Number() defensively — Drizzle's count() may return string in some versions
    const now = new Date().toISOString();
    console.log(`[job:daily-summary] ${now}`);
    console.log(`[job:daily-summary] Research runs (24h): ${Number(researchResult.count)}`);
    console.log(`[job:daily-summary] Drafts generated (24h): ${Number(draftResult.count)}`);
    console.log(`[job:daily-summary] Items published (24h): ${Number(publishedResult.count)}`);
    console.log(`[job:daily-summary] Items failed (24h): ${Number(failedResult.count)}`);
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error('[job:daily-summary] Unhandled error:', err);
  process.exit(1);
});
