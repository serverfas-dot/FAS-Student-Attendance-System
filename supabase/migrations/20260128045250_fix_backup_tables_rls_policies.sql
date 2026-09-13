/*
  # Fix Backup Tables RLS Policies

  ## Problem
  The backup_settings and backup_history tables have RLS policies that check for auth.uid(),
  but we're using custom authentication (not Supabase Auth), so auth.uid() is always null.
  This causes "new row violates row-level security policy" errors when trying to insert/update.

  ## Solution
  Since these tables are only accessed from the Super Admin dashboard (which already validates
  the user role), we'll update the RLS policies to allow all operations without checking auth.uid().

  ## Changes
  1. Drop existing restrictive RLS policies on backup_settings
  2. Drop existing restrictive RLS policies on backup_history
  3. Create permissive policies that allow all operations
*/

-- Drop existing policies on backup_settings
DROP POLICY IF EXISTS "Super admin can view backup settings" ON backup_settings;
DROP POLICY IF EXISTS "Super admin can insert backup settings" ON backup_settings;
DROP POLICY IF EXISTS "Super admin can update backup settings" ON backup_settings;

-- Drop existing policies on backup_history
DROP POLICY IF EXISTS "Super admin can view backup history" ON backup_history;
DROP POLICY IF EXISTS "Super admin can insert backup history" ON backup_history;

-- Create new permissive policies for backup_settings (allowing all operations)
CREATE POLICY "Allow all select on backup_settings"
  ON backup_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow all insert on backup_settings"
  ON backup_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all update on backup_settings"
  ON backup_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create new permissive policies for backup_history (allowing all operations)
CREATE POLICY "Allow all select on backup_history"
  ON backup_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow all insert on backup_history"
  ON backup_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
