import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  try {
    // Rename the legacy constraint to match the current schema.
    // The column was renamed from firebase_uid → clerk_user_id in a prior
    // migration, but the constraint name was left behind. Drizzle-kit push
    // sees this as drift every time and prompts to add a "new" constraint
    // that already logically exists.
    await sql`
      ALTER TABLE users
      RENAME CONSTRAINT users_firebase_uid_unique TO users_clerk_user_id_unique
    `;
    console.log("Renamed constraint: users_firebase_uid_unique → users_clerk_user_id_unique");
  } catch (err: any) {
    if (err.code === "42704") {
      console.log("Constraint users_firebase_uid_unique does not exist — nothing to rename.");
    } else {
      console.error("Migration error:", err.message);
      process.exitCode = 1;
    }
  }
  await sql.end();
}
main();
