import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  try {
    // Create portfolios table
    await sql`
      CREATE TABLE IF NOT EXISTS portfolios (
        id SERIAL PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log("Created portfolios table");

    // Add portfolio_id column to companies
    await sql`
      ALTER TABLE companies
      ADD COLUMN IF NOT EXISTS portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE SET NULL
    `;
    console.log("Added portfolio_id column to companies table");

    // Helpful index for portfolio -> companies lookups
    await sql`
      CREATE INDEX IF NOT EXISTS companies_portfolio_id_idx ON companies(portfolio_id)
    `;
    console.log("Created companies_portfolio_id_idx");

    console.log("Migration complete.");
  } catch (err: any) {
    console.error("Migration error:", err.message);
    process.exitCode = 1;
  }
  await sql.end();
}
main();
