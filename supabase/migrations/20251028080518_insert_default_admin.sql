/*
  # Insert Default Admin Account

  1. Changes
    - Insert a default admin account with email: admin@school.com
    - Password: admin123 (hashed with bcrypt)
    - This account should be changed immediately after first login in production

  2. Security Note
    - The password hash is generated using bcrypt with salt rounds of 10
    - Users should change this password immediately after first login
*/

-- Insert default admin account
-- Password: admin123
INSERT INTO users (email, password_hash, full_name, role, is_active)
VALUES (
  'admin@school.com',
  '$2a$10$YQ98PmHj3D/zKZvvQ0kKvu5Y8PoH7b8WvYvPZJx.xJd2TcJqK0Emu',
  'System Administrator',
  'admin',
  true
)
ON CONFLICT (email) DO NOTHING;