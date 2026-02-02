-- Migration: Add User Active Status
-- Description: เพิ่มสถานะ is_active ให้ user เพื่อให้ Admin สามารถระงับการใช้งานรายบุคคลได้

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN profiles.is_active IS 'สถานะการใช้งาน User (True=ปกติ, False=ถูกระงับ)';
