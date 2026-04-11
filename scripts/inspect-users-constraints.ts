import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  const cons = await sql`
    SELECT tc.constraint_name, tc.constraint_type, kcu.column_name
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_name = kcu.table_name
    WHERE tc.table_name = 'users' AND tc.constraint_type IN ('UNIQUE','PRIMARY KEY')
    ORDER BY tc.constraint_name, kcu.ordinal_position
  `;
  console.log("users constraints:");
  for (const c of cons as any[]) {
    console.log(`  ${c.constraint_name}  [${c.constraint_type}]  column=${c.column_name}`);
  }

  const cols = await sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position
  `;
  console.log("\nusers columns:");
  for (const c of cols as any[]) {
    console.log(`  ${c.column_name}  ${c.data_type}  nullable=${c.is_nullable}`);
  }

  // Check if clerk_user_id has duplicate NULLs or values
  const dupes = await sql`
    SELECT clerk_user_id, COUNT(*) as cnt
    FROM users
    GROUP BY clerk_user_id
    HAVING COUNT(*) > 1
  `;
  console.log("\nclerk_user_id duplicates:");
  for (const d of dupes as any[]) {
    console.log(`  value=${d.clerk_user_id ?? "NULL"}  count=${d.cnt}`);
  }

  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
