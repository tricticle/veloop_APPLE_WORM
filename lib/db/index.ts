import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForPg = globalThis as typeof globalThis & { pgPool?: Pool }

export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL)

function createMockPool(): Pool {
  const mockPool = {
    query: async () => ({ rows: [], rowCount: 0 }),
    connect: async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => {},
    }),
    on: () => mockPool,
    end: async () => {},
  }
  return mockPool as unknown as Pool
}

type DbInstance = ReturnType<typeof drizzle<typeof schema>>

function createMockDb(): DbInstance {
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d: { data?: unknown }) => d?.data ?? {},
    update: async (d: { data?: unknown }) => d?.data ?? {},
    delete: async () => ({}),
  }

  const createMockQuery = (): unknown =>
    new Proxy(() => Promise.resolve([]), {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (value: unknown[]) => void, reject?: (reason: unknown) => void) =>
            Promise.resolve([]).then(resolve, reject)
        }
        if (prop === 'catch') {
          return (reject: (reason: unknown) => void) => Promise.resolve([]).catch(reject)
        }
        if (prop === 'finally') {
          return (cb: () => void) => Promise.resolve([]).finally(cb)
        }
        if (prop === 'transaction') {
          return async (fn: (tx: DbInstance) => Promise<unknown>) => fn(mockDb)
        }
        if (prop === 'query') {
          return new Proxy({}, { get: () => noOp })
        }
        return (..._args: unknown[]) => createMockQuery()
      },
      apply() {
        return createMockQuery()
      },
    })

  const mockDb = createMockQuery() as DbInstance
  return mockDb
}

let pool: Pool
let db: DbInstance

if (!process.env.DATABASE_URL) {
  console.warn('[AI Studio] DATABASE_URL not set — using in-memory database mock')
  pool = createMockPool()
  db = createMockDb()
} else {
  try {
    pool =
      globalForPg.pgPool ??
      new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 5,
      })
    pool.on('error', (err) => {
      console.warn('[AI Studio] Postgres pool error:', err.message)
    })
    if (process.env.NODE_ENV !== 'production') globalForPg.pgPool = pool
    db = drizzle(pool, { schema })
  } catch (err) {
    console.warn('[AI Studio] Database not connected — using mock:', err)
    pool = createMockPool()
    db = createMockDb()
  }
}

let extendedSchemaPromise: Promise<void> | null = null

export async function ensureExtendedSchema(): Promise<void> {
  if (!isDatabaseConfigured) return
  if (!extendedSchemaPromise) {
    extendedSchemaPromise = (async () => {
      try {
        await pool.query(`
          ALTER TABLE "game_profiles"
            ADD COLUMN IF NOT EXISTS "noUndoClears" integer NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "birdsRescued" integer NOT NULL DEFAULT 0;
          ALTER TABLE "level_progress"
            ADD COLUMN IF NOT EXISTS "bestRouteType" text DEFAULT 'STANDARD',
            ADD COLUMN IF NOT EXISTS "noUndoClear" boolean NOT NULL DEFAULT false;
          ALTER TABLE "game_sessions"
            ADD COLUMN IF NOT EXISTS "usedUndo" boolean NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS "starsEarned" integer;
        `)
      } catch {
        // Ignore if database is offline or read-only; downstream try/catch handles gracefully.
      }
    })()
  }
  await extendedSchemaPromise
}

export { pool, db }

