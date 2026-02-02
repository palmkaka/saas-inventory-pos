-- Fix profiles schema: Add missing columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Optional: Update existing profiles with data from auth.users (if available)
-- This tries to pull metadata from the auth system to fill the profile
UPDATE profiles
SET
  first_name = COALESCE(profiles.first_name, (auth.users.raw_user_meta_data->>'first_name')::text),
  last_name = COALESCE(profiles.last_name, (auth.users.raw_user_meta_data->>'last_name')::text),
  email = COALESCE(profiles.email, auth.users.email)
FROM auth.users
WHERE profiles.id = auth.users.id;
