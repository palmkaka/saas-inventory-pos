-- Migration: Fix Signup RLS
-- Description: แก้ไข RLS Policy ให้สามารถสมัครสมาชิกใหม่ได้
-- Created: 2026-01-31

-- ============================================
-- 1. แก้ไข Policy ของ organizations
-- ============================================

-- ลบ Policy เดิมที่อาจจะเข้มงวดเกินไป
DROP POLICY IF EXISTS "Users can insert organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create their own organization" ON organizations;

-- สร้าง Policy ใหม่: อนุญาตให้ authenticated users สร้าง organization ได้
CREATE POLICY "Users can create organizations"
ON organizations FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================
-- 2. แก้ไข Policy ของ profiles
-- ============================================

-- ลบ Policy เดิม
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- สร้าง Policy ใหม่: อนุญาตให้ user update profile ตัวเองได้ (สำหรับกรณี trigger สร้าง profile แล้วต้อง update)
CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- อนุญาตให้ insert (เผื่อกรณี trigger ไม่ทำงานหรือ manual insert)
CREATE POLICY "Users can insert their own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- ============================================
-- 3. เสริมความปลอดภัย: Trigger สำหรับสร้าง Subscription อัตโนมัติ (ถ้ายังไม่มี)
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_organization()
RETURNS TRIGGER AS $$
BEGIN
  -- สร้าง Subscription ฟรีให้ Organization ใหม่
  INSERT INTO subscriptions (organization_id, plan, status, start_date)
  VALUES (NEW.id, 'Free', 'active', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_organization_created ON organizations;
CREATE TRIGGER on_organization_created
AFTER INSERT ON organizations
FOR EACH ROW
EXECUTE FUNCTION handle_new_organization();
