/*
  # Add Username Column to Users Table

  ## Overview
  Adds a username column to the users table to support username-based authentication
  instead of email-based authentication.

  ## Changes Made

  1. **Schema Changes**
     - Add username column to users table
     - Set username as unique
     - Populate username from existing email addresses
     - Set default usernames for existing users

  2. **Data Migration**
     - admin@school.com → username: "admin"
     - superadmin@school.com → username: "superadmin"
     - Other users → username from email prefix

  ## Security Notes
  - Username must be unique
  - Username is required for authentication
*/

-- Add username column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'username'
  ) THEN
    ALTER TABLE users ADD COLUMN username text;
  END IF;
END $$;

-- Populate username from email for existing users
UPDATE users
SET username = CASE
  WHEN email = 'admin@school.com' THEN 'admin'
  WHEN email = 'superadmin@school.com' THEN 'superadmin'
  ELSE SPLIT_PART(email, '@', 1)
END
WHERE username IS NULL;

-- Make username required and unique
ALTER TABLE users ALTER COLUMN username SET NOT NULL;

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_username_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
  END IF;
END $$;
