import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  try {
    await sql`ALTER TABLE users RENAME COLUMN firebase_uid TO clerk_user_id`;
    console.log("Column renamed: firebase_uid -> clerk_user_id");
  } catch (err: any) {
    if (err.message?.includes("does not exist")) {
      console.log("Column firebase_uid does not exist — already renamed or never existed.");
    } else {
      console.error("Error:", err.message);
    }
  }
  await sql.end();
}

main();
