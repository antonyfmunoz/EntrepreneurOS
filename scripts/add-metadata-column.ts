import { db } from "../server/db";
import { sql } from "drizzle-orm";

/**
 * This script adds a metadata JSONB column to the users table
 * to track notification preferences and other user-specific settings.
 */
async function addMetadataColumn() {
  try {
    console.log("Starting migration: Adding metadata column to users table...");
    
    // Check if the column already exists to avoid errors
    const checkColumnQuery = sql`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'metadata';
    `;
    
    const result = await db.execute(checkColumnQuery);
    if (result.rows.length > 0) {
      console.log("Column 'metadata' already exists in users table, skipping...");
      return;
    }
    
    // Add the metadata column
    const addColumnQuery = sql`
      ALTER TABLE users
      ADD COLUMN metadata JSONB;
    `;
    
    await db.execute(addColumnQuery);
    console.log("Successfully added metadata column to users table!");
    
  } catch (error) {
    console.error("Error adding metadata column:", error);
    throw error;
  }
}

// Run the migration
addMetadataColumn()
  .then(() => {
    console.log("Migration completed successfully!");
    process.exit(0);
  })
  .catch(error => {
    console.error("Migration failed:", error);
    process.exit(1);
  });