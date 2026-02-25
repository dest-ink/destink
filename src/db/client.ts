import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// Prevent connection pool exhaustion during Next.js hot-reload in development
const globalForPg = globalThis as typeof globalThis & { pool?: Pool };

const pool =
  globalForPg.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPg.pool = pool;
}

export const db = drizzle(pool, { schema });
export type DB = typeof db;
