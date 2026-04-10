import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  try {
    await sql`ALTER TABLE companies ADD COLUMN IF NOT EXISTS org_id TEXT`;
    console.log("Added org_id column to companies table");
  } catch (err: any) {
    console.error("Migration error:", err.message);
  }
  await sql.end();
}
main();
