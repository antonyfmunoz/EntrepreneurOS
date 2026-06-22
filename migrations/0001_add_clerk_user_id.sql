-- Add clerk_user_id column to users table for Clerk authentication
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clerk_user_id" text UNIQUE;
