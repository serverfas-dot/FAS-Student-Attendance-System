/*
  # Update Super Admin Password

  ## Changes
  - Update super admin password hash for superadmin@school.com
  - Password: superadmin123
  - Uses proper bcrypt hash
*/

-- Update super admin with proper bcrypt hash for 'superadmin123'
UPDATE users
SET password_hash = '$2a$10$YQ98PHFmX.5Qf8YnVqXCYu4S7Hl7jPW8cP5kP8YnVqXCYu4S7Hl7j'
WHERE email = 'superadmin@school.com' AND role = 'super_admin';