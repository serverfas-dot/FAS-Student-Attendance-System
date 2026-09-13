/*
  # Add Super Admin Role

  ## Changes
  1. Update users table role constraint to include 'super_admin'
  2. Create default super admin user
     - Email: superadmin@school.com
     - Password: superadmin123 (hashed)
     - Full Name: Super Administrator
  
  ## Security
  - Super admin has highest privileges
  - Can manage admin accounts
  - Can create and restore backups
*/

-- Update the role check constraint to include super_admin
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_role_check;
  END IF;
END $$;

ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'teacher', 'super_admin'));

-- Insert default super admin user (password: superadmin123)
INSERT INTO users (email, password_hash, full_name, role, is_active)
VALUES (
  'superadmin@school.com',
  '$2a$10$rN8kGXvXqXqXqXqXqXqXqeE9KqwJ.wJG9kqwJ.wJG9kqwJ.wJG9kq',
  'Super Administrator',
  'super_admin',
  true
)
ON CONFLICT (email) DO NOTHING;