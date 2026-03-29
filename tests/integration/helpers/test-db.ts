import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

// Use a separate connection for test transactions — never share with app db
const testSql = postgres(process.env.DATABASE_URL as string);

/**
 * Unique sentinel class — prevents accidental catch-and-swallow of the rollback signal.
 * Using a class (not a string) means only this module can trigger it (Pitfall 3).
 */
class RollbackSentinel extends Error {
  constructor() {
    super("ROLLBACK_SENTINEL");
    this.name = "RollbackSentinel";
  }
}

/**
 * Wrap test code in a transaction that is always rolled back on completion.
 *
 * Per D-13: every integration test that writes to the DB wraps its test body
 * in this helper. The transaction is started, test code runs, then a forced
 * rollback is triggered via RollbackSentinel — ensuring no test leaves DB state.
 *
 * Returns undefined if the callback completed (rollback happened).
 * Re-throws any non-sentinel errors from inside the callback.
 */
export async function withTestTransaction<T>(
  fn: (db: ReturnType<typeof drizzle>) => Promise<T>
): Promise<T | undefined> {
  try {
    return await testSql.begin(async (txSql) => {
      const txDb = drizzle(txSql);
      const result = await fn(txDb);
      // Force rollback by throwing the sentinel — sql.begin catches all throws and rolls back
      throw new RollbackSentinel();
    });
  } catch (err) {
    if (err instanceof RollbackSentinel) return undefined;
    throw err;
  }
}

/**
 * Close the test database connection pool.
 * Call this in afterAll() to avoid test hangs from open connections.
 */
export async function closeTestConnection(): Promise<void> {
  await testSql.end();
}
