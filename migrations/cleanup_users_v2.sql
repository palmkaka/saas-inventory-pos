-- Cleanup Zombie Users (Version 2 - Using IDs)
-- Description: ลบข้อมูลที่ค้างอยู่ในระบบ (Profiles) โดยใช้ User ID
-- Date: 2026-01-31

-- 1. ลบ Profiles ของ User ID ตามรูปภาพที่ส่งมา
DELETE FROM profiles 
WHERE id IN (
  '1a573481-d0d6-40d1-9b72-bbb540492036', -- UID 1
  'ef8da7f8-2dba-4dc1-b1bd-55a124160980'  -- UID 2
);

-- หลังจากรันคำสั่งนี้แล้ว ให้กลับไปที่ Supabase Dashboard > Authentication > Users แล้วกด Delete อีกครั้ง
