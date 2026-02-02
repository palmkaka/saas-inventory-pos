-- Cleanup Zombie Users
-- Description: ลบข้อมูลที่ค้างอยู่ในระบบ (Profiles) เพื่อให้สามารถลบ User จาก Supabase Dashboard ได้
-- Emails: phuwaratnan@gmail.com, phuwaratnan7607@gmail.com

-- 1. ลบ Profiles ของอีเมลที่ต้องการลบ
DELETE FROM profiles 
WHERE email IN ('phuwaratnan@gmail.com', 'phuwaratnan7607@gmail.com');

-- หลังจากรันคำสั่งนี้แล้ว ให้กลับไปที่ Supabase Dashboard > Authentication > Users แล้วกด Delete อีกครั้ง
