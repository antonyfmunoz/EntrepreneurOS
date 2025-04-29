import { db, client } from '../server/db';
import { sql } from 'drizzle-orm';

async function updateMessagesTable() {
  console.log('Starting messages table update...');
  
  try {
    // First check if the table exists
    const tableCheck = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages')");
    const tableExists = tableCheck.rows[0].exists;

    if (!tableExists) {
      console.log('Messages table does not exist. No changes needed.');
      return;
    }

    // Check column structure
    const columnCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'role'
    `);

    const roleColumnExists = columnCheck.rows.length > 0;

    if (roleColumnExists) {
      console.log('Role column already exists. No changes needed.');
      return;
    }

    // Check if sender_type column exists
    const senderTypeCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'sender_type'
    `);

    const senderTypeExists = senderTypeCheck.rows.length > 0;

    if (senderTypeExists) {
      console.log('Found sender_type column. Renaming to role...');
      
      // Create a backup of the current table
      await client.query('CREATE TABLE messages_backup AS SELECT * FROM messages');
      console.log('✓ Created messages_backup table');

      // Rename the column
      await client.query('ALTER TABLE messages RENAME COLUMN sender_type TO role');
      console.log('✓ Renamed sender_type column to role');
    } else {
      console.log('Neither role nor sender_type column found. Adding role column...');
      
      // Add role column with a default value
      await client.query(`
        ALTER TABLE messages 
        ADD COLUMN role text NOT NULL DEFAULT 'user'
      `);
      console.log('✓ Added role column with default value "user"');
    }

    // Add other missing columns from the schema if they don't exist
    const columnsCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'messages'
    `);

    const existingColumns = columnsCheck.rows.map(row => row.column_name);

    // Check for metadata column
    if (!existingColumns.includes('metadata')) {
      await client.query('ALTER TABLE messages ADD COLUMN metadata text');
      console.log('✓ Added metadata column');
    }

    // Check for referenced_agent_ids column
    if (!existingColumns.includes('referenced_agent_ids')) {
      await client.query('ALTER TABLE messages ADD COLUMN referenced_agent_ids text');
      console.log('✓ Added referenced_agent_ids column');
    }

    console.log('Messages table update completed successfully!');
  } catch (error) {
    console.error('Error updating messages table:', error);
  } finally {
    // Close the connection
    await client.end();
  }
}

// Run the script
updateMessagesTable()
  .then(() => {
    console.log('Messages table update completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Messages table update failed:', error);
    process.exit(1);
  });